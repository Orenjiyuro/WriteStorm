import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { createCodexUtilityEnvironment } from './environment';
import { WindowsOwnedProcessGuard } from './lifecycle';
import { BLOCK6A_FEASIBILITY_MANIFEST } from './manifest';
import {
  CodexFeasibilityRunnerError,
  createElectronCodexFeasibilityRunner,
} from './runner';

const EVIDENCE_ID = 'block13-task13-5-windows-no-global-git-packaged-001';
const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gitHeadPattern = /^[0-9a-f]{40}$/;

export type Task13NoGitPackagedProbeGate = {
  readonly accepted: boolean;
  readonly reason: string;
  readonly resultPath?: string;
};

export function evaluateTask13NoGitPackagedProbeGate(input: {
  readonly trigger: string | undefined;
  readonly runId: string | undefined;
  readonly gitHead: string | undefined;
  readonly syntheticInput: string | undefined;
  readonly syntheticExpected: string | undefined;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly temporaryDirectory: string;
}): Task13NoGitPackagedProbeGate {
  if (input.trigger !== '1') return { accepted: false, reason: 'disabled' };
  if (!input.runId || !runIdPattern.test(input.runId)) {
    return { accepted: false, reason: 'invalid_run_id' };
  }
  const resultPath = path.join(
    input.temporaryDirectory,
    'writestorm-task13-5-no-git',
    input.runId,
    'result.json',
  );
  if (!input.gitHead || !gitHeadPattern.test(input.gitHead)) {
    return { accepted: false, reason: 'invalid_git_head', resultPath };
  }
  if (!input.isPackaged) return { accepted: false, reason: 'not_packaged', resultPath };
  if (input.platform !== 'win32' || input.architecture !== 'x64') {
    return { accepted: false, reason: 'unsupported_runtime', resultPath };
  }
  if (!matchesFixture(input.syntheticInput, BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256, 160)) {
    return { accepted: false, reason: 'unapproved_synthetic_input', resultPath };
  }
  if (!matchesFixture(input.syntheticExpected, BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256, 64)) {
    return { accepted: false, reason: 'unapproved_synthetic_expected', resultPath };
  }
  return { accepted: true, reason: 'accepted', resultPath };
}

export async function runOptionalTask13NoGitPackagedProbe(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly mainBundleDirectory: string;
}): Promise<boolean> {
  const gate = evaluateTask13NoGitPackagedProbeGate({
    trigger: options.env.WRITESTORM_TASK13_5_NO_GIT_PROBE,
    runId: options.env.WRITESTORM_TASK13_5_RUN_ID,
    gitHead: options.env.WRITESTORM_TASK13_5_GIT_HEAD,
    syntheticInput: options.env.WRITESTORM_CODEX_SYNTHETIC_INPUT,
    syntheticExpected: options.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED,
    isPackaged: app.isPackaged,
    platform: process.platform,
    architecture: process.arch,
    temporaryDirectory: os.tmpdir(),
  });
  if (gate.reason === 'disabled') return false;
  if (!gate.resultPath) process.exit(42);
  const resultPath = gate.resultPath!;
  if (!gate.accepted) {
    writeResult(resultPath, failureEvidence(options.env, gate.reason));
    process.exit(43);
  }

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-'));
  const workspace = path.join(probeRoot, 'workspace-non-git');
  const utilityEnvironment = createCodexUtilityEnvironment(options.env);
  const gitObservation = observeGitUnavailable(utilityEnvironment);
  const runner = createElectronCodexFeasibilityRunner(options.mainBundleDirectory);
  const ownership = new WindowsOwnedProcessGuard({
    utilityExecutablePath: process.execPath,
    cliExecutablePath: path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    ),
    observationStartedAt: Date.now() - 1_000,
  });

  try {
    mkdirSync(workspace, { recursive: true });
    const structured = await runner.runOutputSchemaProbe({
      scenario: 'valid-minimal',
      workingDirectory: workspace,
      skipGitRepoCheck: true,
    }, 75_000, {
      utilityWorkingDirectory: workspace,
      utilityEnvironment,
      terminationOwnership: ownership,
    });
    const residuals = await ownership.scanResiduals();
    const result = structured.result;
    const assertions = {
      packagedWindowsX64: app.isPackaged && process.platform === 'win32' && process.arch === 'x64',
      nonGitScratchWorkspace: !existsSync(path.join(workspace, '.git')),
      skipGitRepoCheckEnabled: true,
      whereGitUnavailable: gitObservation.whereGitUnavailable,
      getCommandGitUnavailable: gitObservation.getCommandGitUnavailable,
      utilityPathExcludesGitLocations: gitObservation.pathExcludesGitLocations,
      structuredTurnSucceeded: result.outcome === 'success',
      structuredAuthAuthenticated: result.authClassification === 'authenticated',
      structuredFinalJsonParsed: result.finalJsonParsed === true,
      structuredValidatorAccepted: result.strictValidatorAccepted === true,
      structuredExpectedValueMatched: result.expectedValueMatched === true,
      timeoutGuardApplied: true,
      cleanupAcknowledged: structured.cleanupAcknowledged,
      ownershipObserved: residuals.ownershipObserved,
      residualScanCompleted: residuals.residualScanCompleted,
      utilityResidualAbsent: residuals.utilityResidualAbsent,
      cliResidualAbsent: residuals.cliResidualAbsent,
    };
    const passed = Object.values(assertions).every(Boolean);
    writeResult(resultPath, {
      schemaVersion: 1,
      evidenceId: EVIDENCE_ID,
      task: '13.5',
      source: 'packaged_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'writestorm-task13-5-no-global-git-packaged-probe',
      classification: passed ? 'windows_packaged_no_global_git_verified' : 'windows_packaged_no_global_git_failed',
      gitHeadAtRun: options.env.WRITESTORM_TASK13_5_GIT_HEAD,
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
        codexCli: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexCli,
        platformPackage: BLOCK6A_FEASIBILITY_MANIFEST.versions.platformPackage,
      },
      assertions,
      environmentSummary: {
        pathEntryCount: gitObservation.pathEntryCount,
        valuesRecorded: false,
        credentialsRecorded: false,
      },
      limitations: [
        'Fixed public synthetic input only; no Library, SQLite, source text or user manuscript was read.',
        'Environment values, credentials, prompt text, response body, paths and PIDs are not retained.',
        'Windows x64 packaged evidence only; macOS remains deferred-by-user.',
      ],
    });
  } catch (error) {
    writeResult(resultPath, failureEvidence(
      options.env,
      error instanceof CodexFeasibilityRunnerError
        ? `${error.code}:${error.reason}`
        : 'unclassified_runtime_failure',
    ));
  } finally {
    ownership.dispose();
    rmSync(probeRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  process.exit(0);
}

function observeGitUnavailable(environment: NodeJS.ProcessEnv): {
  readonly whereGitUnavailable: boolean;
  readonly getCommandGitUnavailable: boolean;
  readonly pathExcludesGitLocations: boolean;
  readonly pathEntryCount: number;
} {
  const systemRoot = environment.SystemRoot ?? environment.SYSTEMROOT ?? 'C:\\Windows';
  const where = spawnSync(path.join(systemRoot, 'System32', 'where.exe'), ['git'], {
    env: environment,
    windowsHide: true,
    stdio: 'ignore',
  });
  const powershell = spawnSync(
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-Command git -ErrorAction Stop | Out-Null'],
    { env: environment, windowsHide: true, stdio: 'ignore' },
  );
  const entries = (environment.PATH ?? '').split(path.delimiter).filter(Boolean);
  return {
    whereGitUnavailable: where.error === undefined && where.status === 1,
    getCommandGitUnavailable: powershell.error === undefined && powershell.status === 1,
    pathExcludesGitLocations: entries.length > 0
      && entries.every((entry) => !/(^|[\\/])git(?:[\\/]|$)/i.test(entry)),
    pathEntryCount: entries.length,
  };
}

function failureEvidence(environment: NodeJS.ProcessEnv, code: string): unknown {
  return {
    schemaVersion: 1,
    evidenceId: EVIDENCE_ID,
    task: '13.5',
    source: 'packaged_sdk',
    recordedAt: new Date().toISOString(),
    commandName: 'writestorm-task13-5-no-global-git-packaged-probe',
    classification: 'windows_packaged_no_global_git_failed',
    gitHeadAtRun: environment.WRITESTORM_TASK13_5_GIT_HEAD ?? null,
    failure: { code },
  };
}

function writeResult(resultPath: string, value: unknown): void {
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function matchesFixture(value: string | undefined, hash: string, maximumLength: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\0]/.test(value)
    && createHash('sha256').update(value, 'utf8').digest('hex') === hash;
}
