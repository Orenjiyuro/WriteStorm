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
import {
  createIdempotentLifecycleTrigger,
  findAttributedProcess,
  findProcessByPidAndPath,
  isSameProcessIdentityPresent,
  readWindowsProcessSnapshots,
  WindowsProcessObserverError,
  type WindowsProcessSnapshot,
} from './lifecycle';
import type { CodexLifecycleScenario, CodexLifecycleTrigger } from './protocol';

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
  let probeWindow: BrowserWindow | undefined;
  let allowFinalQuit = false;
  const events = {
    windowCloseObserved: false,
    windowAllClosedObserved: false,
    beforeQuitObserved: false,
  };
  let utilityIdentity: WindowsProcessSnapshot | undefined;
  let cliIdentity: WindowsProcessSnapshot | undefined;
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

    let observation: Promise<void> = Promise.resolve();
    let outcome: CodexFeasibilityLifecycleOutcome | undefined;
    let timeoutCleanup: CodexTimeoutCleanupSummary | undefined;
    try {
      outcome = await runner.runLifecycleProbe(
        { scenario, workingDirectory: workspace },
        scenario === 'app-timeout' ? 4_000 : 75_000,
        {
          utilityWorkingDirectory: workspace,
          utilityEnvironment: createUtilityEnvironment(process.env),
          waitForTrigger: ({ utilityPid }) => {
            observation = observeOwnedProcesses(utilityPid, expectedCliPath, (utility, cli) => {
              utilityIdentity = utility;
              cliIdentity = cli;
            });
            if (scenario !== 'app-timeout') {
              void observation.finally(() => {
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
    await observation;
    await delay(500);
    const after = readWindowsProcessSnapshots();
    const triggerSnapshot = triggerGate.snapshot();
    const utilityResidualAbsent = utilityIdentity
      ? !isSameProcessIdentityPresent(after, utilityIdentity)
      : false;
    const cliResidualAbsent = cliIdentity
      ? !isSameProcessIdentityPresent(after, cliIdentity)
      : false;
    const result = outcome?.result ?? {
      scenario: 'app-timeout' as const,
      trigger: 'app-timeout' as const,
      outcome: timeoutCleanup?.abortObserved ? 'aborted' as const : 'runtime_failed' as const,
      authClassification: 'unverified' as const,
      abortRequested: timeoutCleanup?.abortRequested === true,
      abortObserved: timeoutCleanup?.abortObserved === true,
      sdkPromiseSettled: timeoutCleanup?.sdkPromiseSettled === true,
    };
    const lifecycleAssertions = {
      triggerMatchedScenario: result.trigger === scenario,
      abortRequested: result.abortRequested && (timeoutCleanup?.abortRequested ?? true),
      abortObserved: result.abortObserved,
      sdkPromiseSettled: result.sdkPromiseSettled && (timeoutCleanup?.sdkPromiseSettled ?? true),
      cleanupAcknowledged: outcome?.cleanupAcknowledged ?? timeoutCleanup?.cleanupAcknowledged === true,
      timeoutSupervisorObserved: scenario !== 'app-timeout' || timeoutCleanup !== undefined,
      timeoutUtilityExitObserved: scenario !== 'app-timeout' || timeoutCleanup?.utilityExitObserved === true,
      timeoutCleanupClassified: scenario !== 'app-timeout'
        || timeoutCleanup?.classification === 'graceful'
        || timeoutCleanup?.classification === 'forced',
      cleanupExecutedOnce: triggerSnapshot.executionCount === 1,
      utilityProcessAttributed: utilityIdentity !== undefined,
      cliObservedBeforeTrigger: cliIdentity !== undefined,
      cliOwnedByUtilityParentChain: cliIdentity !== undefined,
      utilityResidualAbsent,
      cliResidualAbsent,
    };
    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: `block6a-6a7-real-sdk-${scenario}-001`,
      task: '6A.7',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: `block6a-electron-lifecycle-${scenario}-probe`,
      classification: Object.values(lifecycleAssertions).every(Boolean)
        && result.outcome === 'aborted'
        ? 'lifecycle_probe_passed'
        : 'lifecycle_probe_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: lifecycleAssertions,
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
      assertions: { sanitizedFailureRecorded: true },
      failure: error instanceof CodexFeasibilityRunnerError
        ? {
            code: error.code,
            reason: error.reason,
            utilityErrorCode: error.utilityErrorCode ?? null,
            protocolDiagnostic: error.protocolDiagnostic ?? null,
          }
        : error instanceof WindowsProcessObserverError
          ? { code: error.code }
          : { code: 'UNCLASSIFIED_PROBE_FAILURE' },
    });
  } finally {
    allowFinalQuit = true;
    probeWindow?.destroy();
    exitAfterBestEffortCleanup(probeRoot);
  }
});

async function observeOwnedProcesses(
  utilityPid: number,
  cliPath: string,
  record: (utility: WindowsProcessSnapshot | undefined, cli: WindowsProcessSnapshot | undefined) => void,
): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const snapshots = readWindowsProcessSnapshots();
    const utility = findProcessByPidAndPath(snapshots, utilityPid, process.execPath);
    const cli = utility ? findAttributedProcess(snapshots, utility, cliPath) : undefined;
    record(utility, cli);
    if (utility && cli) return;
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

function createUtilityEnvironment(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = { ...inherited };
  for (const key of Object.keys(environment)) {
    if (/^(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN)$/i.test(key)) {
      delete environment[key];
    }
  }
  return environment;
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
