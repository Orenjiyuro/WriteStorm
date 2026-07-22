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
import { createCodexUtilityEnvironment } from './environment';
import { WindowsOwnedProcessGuard } from './lifecycle';
import {
  BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
  BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
  createBlock6aAssertion,
} from './assertion-provenance';
import { BLOCK6A_FEASIBILITY_MANIFEST } from './manifest';

const approvedSyntheticInputSha256 =
  BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256;
const approvedSyntheticExpectedSha256 =
  BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256;
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
        evidenceId: BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.packaged,
        task: '6A.8a',
        source: 'packaged_sdk',
        recordedAt: new Date().toISOString(),
        commandName: 'writestorm-packaged-codex-sdk-probe',
        classification: 'packaged_probe_gate_rejected',
        assertions: {
          realSdkTurnStarted: createBlock6aAssertion(
            false, 'packaged_sdk', BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.packaged,
            'packaged_probe_gate_rejected',
          ),
        },
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
  const utilityEnvironment = createCodexUtilityEnvironment(options.env);
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
      terminationOwnership: ownership,
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
    const evidenceId = BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.packaged;
    const classification = packagedTurnSucceeded
      ? 'packaged_sdk_probe_completed'
      : 'packaged_sdk_probe_failed';
    const packagedAssertion = (value: boolean) => createBlock6aAssertion(
      value, 'packaged_sdk', evidenceId, classification,
    );
    writeSanitizedResult(resultPath, {
      schemaVersion: 1,
      evidenceId,
      task: '6A.8a',
      source: 'packaged_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'writestorm-packaged-codex-sdk-probe',
      classification,
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
        codexCli: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexCli,
        platformPackage: BLOCK6A_FEASIBILITY_MANIFEST.versions.platformPackage,
      },
      assertions: {
        packagedProbeGateAccepted: packagedAssertion(gate.accepted),
        appIsPackaged: packagedAssertion(app.isPackaged),
        windowsX64Runtime: packagedAssertion(
          process.platform === 'win32' && process.arch === 'x64',
        ),
        approvedSyntheticInputHashMatched: packagedAssertion(true),
        approvedSyntheticExpectedHashMatched: packagedAssertion(true),
        resultPathDerivedFromValidatedRunIdUnderOsTemp: packagedAssertion(true),
        packagedSdkImportConstructAndCliExecutionProvedByTurn:
          packagedAssertion(packagedTurnSucceeded),
        structuredTurnSucceeded: packagedAssertion(structuredResult.outcome === 'success'),
        structuredAuthAuthenticated: packagedAssertion(
          structuredResult.authClassification === 'authenticated',
        ),
        structuredFinalJsonParsed: packagedAssertion(structuredResult.finalJsonParsed === true),
        structuredValidatorAccepted: packagedAssertion(
          structuredResult.strictValidatorAccepted === true,
        ),
        structuredExpectedValueMatched: packagedAssertion(
          structuredResult.expectedValueMatched === true,
        ),
        structuredCleanupAcknowledged: packagedAssertion(structured.cleanupAcknowledged),
        workspaceOutsidePackagedResources: packagedAssertion(
          !isInside(workspace, process.resourcesPath),
        ),
        apiCredentialEnvironmentExcludedFromUtility: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
          'utility_environment_boundary_frozen',
        ),
        promptAndSchemaNotPassedInProtocol: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'typed_protocol_boundary_frozen',
        ),
      },
      syntheticBoundary: {
        inputSha256: approvedSyntheticInputSha256,
        expectedSha256: approvedSyntheticExpectedSha256,
        resultPathPolicy: 'os_temp_validated_uuid_v4',
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
      evidenceId: BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.packaged,
      task: '6A.8a',
      source: 'packaged_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'writestorm-packaged-codex-sdk-probe',
      classification: 'packaged_sdk_probe_failed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
      },
      assertions: {
        sanitizedFailureRecorded: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'sanitized_failure_boundary',
        ),
      },
      failure: error instanceof CodexFeasibilityRunnerError
        ? {
            stage,
            code: error.code,
            reason: error.reason,
            utilityErrorCode: error.utilityErrorCode ?? null,
            protocolDiagnostic: error.protocolDiagnostic ?? null,
            terminationCleanup: error.terminationCleanup ?? null,
          }
        : { stage, code: 'UNCLASSIFIED_PACKAGED_PROBE_FAILURE' },
    });
  } finally {
    ownership.dispose();
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
