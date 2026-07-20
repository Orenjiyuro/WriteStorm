import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
  type CodexFeasibilityLifecycleOutcome,
  type CodexTimeoutCleanupSummary,
} from './runner';
import { createCodexUtilityEnvironment } from './environment';
import {
  createIdempotentLifecycleTrigger,
  WindowsOwnedProcessGuard,
  WindowsProcessObserverError,
} from './lifecycle';
import type { CodexLifecycleScenario, CodexLifecycleTrigger } from './protocol';
import {
  BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
  createBlock6aAssertion,
} from './assertion-provenance';

const resultPath = process.env.WRITESTORM_CODEX_LIFECYCLE_RESULT;
const utilityModulePath = process.env.WRITESTORM_CODEX_UTILITY_PATH;
const sourceRoot = process.env.WRITESTORM_CODEX_SOURCE_ROOT;
const expectedCliPath = process.env.WRITESTORM_CODEX_CLI_PATH;
const scenario = parseScenario(process.env.WRITESTORM_CODEX_LIFECYCLE_SCENARIO);

void app.whenReady().then(async () => {
  if (!resultPath || !utilityModulePath || !sourceRoot || !expectedCliPath || !scenario) {
    process.exit(31);
    return;
  }

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-codex-lifecycle-'));
  const workspace = path.join(probeRoot, 'workspace-git');
  const runner = new CodexFeasibilityRunner({ modulePath: utilityModulePath });
  const ownedProcesses = new WindowsOwnedProcessGuard({
    utilityExecutablePath: process.execPath,
    cliExecutablePath: expectedCliPath,
    observationStartedAt: Date.now() - 1_000,
  });
  let probeWindow: BrowserWindow | undefined;
  let allowFinalQuit = false;
  const events = {
    windowCloseObserved: false,
    windowAllClosedObserved: false,
    beforeQuitObserved: false,
  };
  let resolveTrigger!: (trigger: CodexLifecycleTrigger) => void;
  const triggerPromise = new Promise<CodexLifecycleTrigger>((resolve) => {
    resolveTrigger = resolve;
  });
  const triggerGate = createIdempotentLifecycleTrigger(async (trigger) => {
    resolveTrigger(trigger);
    return trigger;
  });

  try {
    mkdirSync(workspace, { recursive: true });
    execFileSync('git', ['init', '--quiet', workspace], { stdio: 'ignore' });
    if (scenario === 'window-close' || scenario === 'app-quit') {
      probeWindow = new BrowserWindow({ show: false, width: 320, height: 240 });
      probeWindow.on('close', () => {
        events.windowCloseObserved = true;
        if (scenario === 'window-close') void triggerGate.request('window-close');
      });
    }
    app.on('window-all-closed', () => {
      events.windowAllClosedObserved = true;
      app.quit();
    });
    app.on('before-quit', (event) => {
      events.beforeQuitObserved = true;
      if (!allowFinalQuit) {
        event.preventDefault();
        void triggerGate.request('app-quit');
      }
    });

    let outcome: CodexFeasibilityLifecycleOutcome | undefined;
    let timeoutCleanup: CodexTimeoutCleanupSummary | undefined;
    try {
      outcome = await runner.runLifecycleProbe(
        { scenario, workingDirectory: workspace },
        scenario === 'app-timeout' ? 4_000 : 75_000,
        {
          utilityWorkingDirectory: workspace,
          utilityEnvironment: createCodexUtilityEnvironment(process.env),
          terminationOwnership: ownedProcesses,
          waitForTrigger: () => {
            if (scenario !== 'app-timeout') {
              void waitForOwnedProcessObservation(ownedProcesses).finally(() => {
                if (scenario === 'explicit-cancel') void triggerGate.request('explicit-cancel');
                if (scenario === 'window-close') probeWindow?.close();
                if (scenario === 'app-quit') app.quit();
              });
            }
            return triggerPromise;
          },
        },
      );
    } catch (error) {
      if (
        scenario !== 'app-timeout'
        || !(error instanceof CodexFeasibilityRunnerError)
        || error.reason !== 'timeout'
        || !error.timeoutCleanup
      ) {
        throw error;
      }
      timeoutCleanup = error.timeoutCleanup;
      await triggerGate.request('app-timeout');
    }
    const residualAssertions = await ownedProcesses.scanResiduals();
    const triggerSnapshot = triggerGate.snapshot();
    const ownershipAssertions = ownedProcesses.evidenceAssertions();
    const result = outcome?.result ?? {
      scenario: 'app-timeout' as const,
      trigger: 'app-timeout' as const,
      outcome: timeoutCleanup?.abortObserved ? 'aborted' as const : 'runtime_failed' as const,
      authClassification: 'unverified' as const,
      abortRequested: timeoutCleanup?.abortRequested === true,
      abortObserved: timeoutCleanup?.abortObserved === true,
      sdkPromiseSettled: timeoutCleanup?.sdkPromiseSettled === true,
    };
    const evidenceId = `block6a-6a7-real-sdk-${scenario}-001`;
    const lifecycleAssertion = (value: boolean) => createBlock6aAssertion(
      value, 'real_sdk', evidenceId, 'lifecycle_probe_passed',
    );
    const processAssertion = (value: boolean) => createBlock6aAssertion(
      value, 'real_sdk', evidenceId, 'owned_process_observation_completed',
    );
    const lifecycleAssertions = {
      triggerMatchedScenario: lifecycleAssertion(result.trigger === scenario),
      abortRequested: lifecycleAssertion(
        result.abortRequested && (timeoutCleanup?.abortRequested ?? true),
      ),
      abortObserved: lifecycleAssertion(result.abortObserved),
      sdkPromiseSettled: lifecycleAssertion(
        result.sdkPromiseSettled && (timeoutCleanup?.sdkPromiseSettled ?? true),
      ),
      cleanupAcknowledged: lifecycleAssertion(
        outcome?.cleanupAcknowledged ?? timeoutCleanup?.cleanupAcknowledged === true,
      ),
      timeoutSupervisorObserved: lifecycleAssertion(
        scenario !== 'app-timeout' || timeoutCleanup !== undefined,
      ),
      timeoutUtilityExitObserved: lifecycleAssertion(
        scenario !== 'app-timeout' || timeoutCleanup?.utilityExitObserved === true,
      ),
      timeoutCleanupClassified: lifecycleAssertion(
        scenario !== 'app-timeout'
          || timeoutCleanup?.classification === 'graceful'
          || timeoutCleanup?.classification === 'forced',
      ),
      cleanupExecutedOnce: lifecycleAssertion(triggerSnapshot.executionCount === 1),
    };
    const processAssertions = {
      utilityProcessAttributed: processAssertion(ownershipAssertions.utilityIdentityBound),
      cliObservedBeforeTrigger: processAssertion(ownershipAssertions.cliIdentityBound),
      cliOwnedByUtilityParentChain: processAssertion(
        ownershipAssertions.observedParentRelationshipBound,
      ),
      pidCreationTimeExecutablePathBound: processAssertion(
        ownershipAssertions.pidCreationTimeExecutablePathBound,
      ),
      observedParentRelationshipBound: processAssertion(
        ownershipAssertions.observedParentRelationshipBound,
      ),
      ownershipFrozenForSession: processAssertion(ownershipAssertions.ownershipFrozenForSession),
      residualScanCompleted: processAssertion(residualAssertions.residualScanCompleted),
      utilityResidualAbsent: processAssertion(residualAssertions.utilityResidualAbsent),
      cliResidualAbsent: processAssertion(residualAssertions.cliResidualAbsent),
    };
    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId,
      task: '6A.7',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: `block6a-electron-lifecycle-${scenario}-probe`,
      classification: Object.values(lifecycleAssertions).every(Boolean)
        && Object.values(processAssertions).every(Boolean)
        && result.outcome === 'aborted'
        ? 'lifecycle_probe_passed'
        : 'lifecycle_probe_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: lifecycleAssertions,
      processAssertions,
      result,
      timeoutCleanup: timeoutCleanup ?? null,
      lifecycleEvents: {
        initialTrigger: triggerSnapshot.initialTrigger,
        cleanupRequestCount: triggerSnapshot.requestCount,
        cleanupExecutionCount: triggerSnapshot.executionCount,
        hiddenWindowUsed: scenario === 'window-close' || scenario === 'app-quit',
        ...events,
      },
      limitations: [
        'Process identities are used ephemerally and no path, PID, process list, prompt or raw SDK error is retained.',
        'The observer correlates only exact utility ancestry, start time and the project-local CLI executable path.',
        'No CLI process is terminated directly; an unowned Codex process is never touched.',
      ],
    });
  } catch (error) {
    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: `block6a-6a7-real-sdk-${scenario}-001`,
      task: '6A.7',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: `block6a-electron-lifecycle-${scenario}-probe`,
      classification: 'probe_infrastructure_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: {
        sanitizedFailureRecorded: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'sanitized_failure_boundary',
        ),
      },
      failure: error instanceof CodexFeasibilityRunnerError
        ? {
            code: error.code,
            reason: error.reason,
            utilityErrorCode: error.utilityErrorCode ?? null,
            protocolDiagnostic: error.protocolDiagnostic ?? null,
            terminationCleanup: error.terminationCleanup ?? null,
          }
        : error instanceof WindowsProcessObserverError
          ? { code: error.code }
          : { code: 'UNCLASSIFIED_PROBE_FAILURE' },
    });
  } finally {
    allowFinalQuit = true;
    ownedProcesses.dispose();
    probeWindow?.destroy();
    exitAfterBestEffortCleanup(probeRoot);
  }
});

async function waitForOwnedProcessObservation(guard: WindowsOwnedProcessGuard): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (guard.evidenceAssertions().ownershipFrozenForSession) return;
    await delay(100);
  }
}

function exitAfterBestEffortCleanup(directory: string): never {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } finally {
    process.exit(0);
  }
}

function parseScenario(value: string | undefined): CodexLifecycleScenario | undefined {
  return value === 'app-timeout'
    || value === 'explicit-cancel'
    || value === 'window-close'
    || value === 'app-quit'
    ? value
    : undefined;
}

function writeSanitizedResult(value: unknown): void {
  mkdirSync(path.dirname(resultPath as string), { recursive: true });
  writeFileSync(resultPath as string, JSON.stringify(value, null, 2), 'utf8');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
