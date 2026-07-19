import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  CodexFeasibilityRunnerError,
  createElectronCodexFeasibilityRunner,
} from './runner';

const approvedSyntheticInputSha256 = '59a9268039bb5bad326151cbe27320c64c89cbf5b054035978c432a4ce5c4a26';
const approvedSyntheticExpectedSha256 = '6fe7aac1e4d9ae4aec0a14e6bfd46af4ee18892c247a2d0aecfa5091f017afab';
const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PackagedProbeGate = {
  readonly accepted: boolean;
  readonly reason: string;
  readonly resultPath?: string;
};

export function evaluatePackagedProbeGate(input: {
  readonly trigger: string | undefined;
  readonly runId: string | undefined;
  readonly syntheticInput: string | undefined;
  readonly syntheticExpected: string | undefined;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly temporaryDirectory: string;
}): PackagedProbeGate {
  if (input.trigger !== '1') return { accepted: false, reason: 'disabled' };
  if (!input.runId || !runIdPattern.test(input.runId)) {
    return { accepted: false, reason: 'invalid_run_id' };
  }
  const resultPath = path.join(
    input.temporaryDirectory,
    'writestorm-block6a-packaged',
    input.runId,
    'result.json',
  );
  if (!input.isPackaged) return { accepted: false, reason: 'not_packaged', resultPath };
  if (input.platform !== 'win32') return { accepted: false, reason: 'unsupported_platform', resultPath };
  if (input.architecture !== 'x64') return { accepted: false, reason: 'unsupported_architecture', resultPath };
  if (!isApprovedSyntheticValue(input.syntheticInput, approvedSyntheticInputSha256, 160)) {
    return { accepted: false, reason: 'unapproved_synthetic_input', resultPath };
  }
  if (!isApprovedSyntheticValue(input.syntheticExpected, approvedSyntheticExpectedSha256, 64)) {
    return { accepted: false, reason: 'unapproved_synthetic_expected', resultPath };
  }
  return { accepted: true, reason: 'accepted', resultPath };
}

export async function runOptionalPackagedCodexProbe(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly mainBundleDirectory: string;
}): Promise<boolean> {
  const gate = evaluatePackagedProbeGate({
    trigger: options.env.WRITESTORM_CODEX_PACKAGED_PROBE,
    runId: options.env.WRITESTORM_CODEX_PROBE_RUN_ID,
    syntheticInput: options.env.WRITESTORM_CODEX_SYNTHETIC_INPUT,
    syntheticExpected: options.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED,
    isPackaged: app.isPackaged,
    platform: process.platform,
    architecture: process.arch,
    temporaryDirectory: os.tmpdir(),
  });
  if (gate.reason === 'disabled') return false;
  if (!gate.accepted || !gate.resultPath) {
    if (gate.resultPath) {
      writeSanitizedResult(gate.resultPath, {
        schemaVersion: 1,
        task: '6A.8a',
        source: 'packaged_sdk',
        recordedAt: new Date().toISOString(),
        commandName: 'writestorm-packaged-codex-sdk-probe',
        classification: 'packaged_probe_gate_rejected',
        assertions: { realSdkTurnStarted: false },
        failure: { code: gate.reason },
      });
    }
    process.exit(32);
    return true;
  }

  const resultPath = gate.resultPath;
  const syntheticInput = options.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
  const expectedResponse = options.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED;
  if (!syntheticInput || !expectedResponse) throw new Error('Packaged probe gate invariant failed.');

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-codex-packaged-'));
  const workspace = path.join(probeRoot, 'workspace-git');
  const runner = createElectronCodexFeasibilityRunner(options.mainBundleDirectory);
  const utilityEnvironment = createUtilityEnvironment(options.env);
  const stage = 'structured' as const;

  try {
    mkdirSync(workspace, { recursive: true });
    execFileSync('git', ['init', '--quiet', workspace], { stdio: 'ignore' });
    const structured = await runner.runOutputSchemaProbe({
      scenario: 'valid-minimal',
      workingDirectory: workspace,
    }, 75_000, {
      utilityWorkingDirectory: workspace,
      utilityEnvironment,
    });
    const structuredResult = structured.result;
    const packagedTurnSucceeded = gate.accepted
      && app.isPackaged
      && process.platform === 'win32'
      && process.arch === 'x64'
      && structuredResult.outcome === 'success'
      && structuredResult.authClassification === 'authenticated'
      && structuredResult.finalJsonParsed === true
      && structuredResult.strictValidatorAccepted === true
      && structuredResult.expectedValueMatched === true;
    writeSanitizedResult(resultPath, {
      schemaVersion: 1,
      evidenceId: 'block6a-6a8a-packaged-sdk-windows-001',
      task: '6A.8a',
      source: 'packaged_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'writestorm-packaged-codex-sdk-probe',
      classification: packagedTurnSucceeded
        ? 'packaged_sdk_probe_completed'
        : 'packaged_sdk_probe_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
        codexCli: '0.144.6',
        platformPackage: '0.144.6-win32-x64',
      },
      assertions: {
        packagedProbeGateAccepted: gate.accepted,
        appIsPackaged: app.isPackaged,
        windowsX64Runtime: process.platform === 'win32' && process.arch === 'x64',
        approvedSyntheticInputHashMatched: true,
        approvedSyntheticExpectedHashMatched: true,
        resultPathDerivedFromValidatedRunIdUnderOsTemp: true,
        packagedSdkImportConstructAndCliExecutionProvedByTurn:
          packagedTurnSucceeded,
        structuredTurnSucceeded: structuredResult.outcome === 'success',
        structuredAuthAuthenticated: structuredResult.authClassification === 'authenticated',
        structuredFinalJsonParsed: structuredResult.finalJsonParsed === true,
        structuredValidatorAccepted: structuredResult.strictValidatorAccepted === true,
        structuredExpectedValueMatched: structuredResult.expectedValueMatched === true,
        structuredCleanupAcknowledged: structured.cleanupAcknowledged,
        workspaceOutsidePackagedResources: !isInside(workspace, process.resourcesPath),
        apiCredentialEnvironmentExcludedFromUtility: true,
        promptAndSchemaNotPassedInProtocol: true,
      },
      runtime: { platform: process.platform, architecture: process.arch },
      structuredResult,
      limitations: [
        'No prompt, response body, path, environment value, credential, PID or raw SDK error is retained.',
        'This is Windows x64 packaged runtime evidence only.',
        'A separate packaged manifest-inspection command timed out; executable provenance is instead established by the real SDK turn plus the package guard.',
        'macOS packaged runtime remains deferred-by-user.',
      ],
    });
  } catch (error) {
    writeSanitizedResult(resultPath, {
      schemaVersion: 1,
      evidenceId: 'block6a-6a8a-packaged-sdk-windows-001',
      task: '6A.8a',
      source: 'packaged_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'writestorm-packaged-codex-sdk-probe',
      classification: 'packaged_sdk_probe_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: { sanitizedFailureRecorded: true },
      failure: error instanceof CodexFeasibilityRunnerError
        ? {
            stage,
            code: error.code,
            reason: error.reason,
            utilityErrorCode: error.utilityErrorCode ?? null,
            protocolDiagnostic: error.protocolDiagnostic ?? null,
          }
        : { stage, code: 'UNCLASSIFIED_PACKAGED_PROBE_FAILURE' },
    });
  } finally {
    exitAfterBestEffortCleanup(probeRoot);
  }
  return true;
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

function isInside(candidate: string, parent: string): boolean {
  const relativePath = path.relative(parent, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function writeSanitizedResult(resultPath: string, value: unknown): void {
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(value, null, 2), 'utf8');
}

function isApprovedSyntheticValue(
  value: string | undefined,
  expectedHash: string,
  maximumLength: number,
): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\0]/.test(value)
    && createHash('sha256').update(value, 'utf8').digest('hex') === expectedHash;
}
