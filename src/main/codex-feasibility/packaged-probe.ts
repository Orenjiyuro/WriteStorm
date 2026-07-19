import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  CodexFeasibilityRunnerError,
  createElectronCodexFeasibilityRunner,
} from './runner';

export async function runOptionalPackagedCodexProbe(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly mainBundleDirectory: string;
}): Promise<boolean> {
  if (options.env.WRITESTORM_CODEX_PACKAGED_PROBE !== '1') return false;

  const resultPath = options.env.WRITESTORM_CODEX_PACKAGED_RESULT;
  const syntheticInput = options.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
  const expectedResponse = options.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED;
  if (!resultPath || !syntheticInput || !expectedResponse) {
    process.exit(31);
    return true;
  }

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
    const packagedTurnSucceeded = structuredResult.outcome === 'success'
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
        appIsPackaged: app.isPackaged,
        windowsX64Runtime: process.platform === 'win32' && process.arch === 'x64',
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
    rmSync(probeRoot, { recursive: true, force: true });
    process.exit(0);
  }
  return true;
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
