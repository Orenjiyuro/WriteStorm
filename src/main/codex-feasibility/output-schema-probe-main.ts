import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
} from './runner';
import type { CodexOutputSchemaProbeResult } from './protocol';

const resultPath = process.env.WRITESTORM_CODEX_OUTPUT_SCHEMA_RESULT;
const utilityModulePath = process.env.WRITESTORM_CODEX_UTILITY_PATH;
const sourceRoot = process.env.WRITESTORM_CODEX_SOURCE_ROOT;

void app.whenReady().then(async () => {
  if (!resultPath || !utilityModulePath || !sourceRoot) {
    process.exit(31);
    return;
  }

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-codex-output-schema-'));
  const workspace = path.join(probeRoot, 'workspace-git');
  const runner = new CodexFeasibilityRunner({ modulePath: utilityModulePath });

  try {
    mkdirSync(workspace, { recursive: true });
    execFileSync('git', ['init', '--quiet', workspace], { stdio: 'ignore' });
    const utilityEnvironment = createUtilityEnvironment(process.env);
    const scenarios: CodexOutputSchemaProbeResult[] = [];
    for (const scenario of ['valid-minimal', 'invalid-schema'] as const) {
      writeSanitizedProgress(scenario, scenarios.length);
      const outcome = await runner.runOutputSchemaProbe({ scenario, workingDirectory: workspace }, 60_000, {
        utilityWorkingDirectory: workspace,
        utilityEnvironment,
      });
      scenarios.push(outcome.result);
      writeSanitizedProgress(null, scenarios.length);
    }

    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: 'block6a-6a6-real-sdk-output-schema-001',
      task: '6A.6',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-output-schema-probe',
      classification: 'output_schema_probe_completed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: {
        probeRootOutsideSourceRepository: !isInside(probeRoot, sourceRoot),
        workspaceIsTemporaryGitRepository: true,
        apiCredentialEnvironmentExcludedFromUtility: true,
        promptAndSchemaNotPassedInProtocol: true,
        scenarioCount: scenarios.length === 2,
      },
      scenarios,
      limitations: [
        'No prompt, response body, path, environment value, credential, PID or raw SDK error is retained.',
        'The invalid schema scenario proves the installed SDK plain-object guard, not a remote model-generated invalid object.',
        'Missing-field and extra-field behavior is recorded separately as local_validator_fixture.',
      ],
    });
  } catch (error) {
    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: 'block6a-6a6-real-sdk-output-schema-001',
      task: '6A.6',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-output-schema-probe',
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
        : { code: 'UNCLASSIFIED_PROBE_FAILURE' },
    });
  } finally {
    exitAfterBestEffortCleanup(probeRoot);
  }
});

function createUtilityEnvironment(inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = { ...inherited };
  for (const key of Object.keys(environment)) {
    if (/^(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN)$/i.test(key)) {
      delete environment[key];
    }
  }
  return environment;
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

function writeSanitizedResult(value: unknown): void {
  mkdirSync(path.dirname(resultPath as string), { recursive: true });
  writeFileSync(resultPath as string, JSON.stringify(value, null, 2), 'utf8');
}

function writeSanitizedProgress(currentScenario: string | null, completedScenarioCount: number): void {
  writeSanitizedResult({
    schemaVersion: 1,
    task: '6A.6',
    source: 'real_sdk',
    recordedAt: new Date().toISOString(),
    commandName: 'block6a-electron-utility-output-schema-probe',
    classification: 'probe_in_progress',
    assertions: { promptResponseAndRawErrorsExcluded: true },
    progress: { completedScenarioCount, currentScenario },
  });
}
