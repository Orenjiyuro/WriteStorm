import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
} from './runner';
import { createCodexUtilityEnvironment } from './environment';
import { WindowsOwnedProcessGuard } from './lifecycle';
import type { CodexOutputSchemaProbeResult } from './protocol';
import {
  BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
  BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
  createBlock6aAssertion,
} from './assertion-provenance';
import { BLOCK6A_FEASIBILITY_MANIFEST } from './manifest';
import { CODEX_FEASIBILITY_SESSION_TIMEOUT_MS } from './turn-deadline';

const resultPath = process.env.WRITESTORM_CODEX_OUTPUT_SCHEMA_RESULT;
const utilityModulePath = process.env.WRITESTORM_CODEX_UTILITY_PATH;
const sourceRoot = process.env.WRITESTORM_CODEX_SOURCE_ROOT;
const expectedCliPath = process.env.WRITESTORM_CODEX_CLI_PATH;

void app.whenReady().then(async () => {
  if (!resultPath || !utilityModulePath || !sourceRoot || !expectedCliPath) {
    process.exit(31);
    return;
  }

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-codex-output-schema-'));
  const workspace = path.join(probeRoot, 'workspace-git');
  const runner = new CodexFeasibilityRunner({ modulePath: utilityModulePath });

  try {
    mkdirSync(workspace, { recursive: true });
    execFileSync('git', ['init', '--quiet', workspace], { stdio: 'ignore' });
    const utilityEnvironment = createCodexUtilityEnvironment(process.env);
    const scenarios: CodexOutputSchemaProbeResult[] = [];
    for (const scenario of ['valid-minimal', 'invalid-schema'] as const) {
      writeSanitizedProgress(scenario, scenarios.length);
      const ownership = new WindowsOwnedProcessGuard({
        utilityExecutablePath: process.execPath,
        cliExecutablePath: expectedCliPath,
        observationStartedAt: Date.now() - 1_000,
      });
      try {
        const outcome = await runner.runOutputSchemaProbe(
          { scenario, workingDirectory: workspace },
          CODEX_FEASIBILITY_SESSION_TIMEOUT_MS,
          {
            utilityWorkingDirectory: workspace,
            utilityEnvironment,
            terminationOwnership: ownership,
          },
        );
        scenarios.push(outcome.result);
        writeSanitizedProgress(null, scenarios.length);
      } finally {
        ownership.dispose();
      }
    }

    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.outputSchema,
      task: '6A.6',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-output-schema-probe',
      classification: 'output_schema_probe_completed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
      },
      assertions: {
        probeRootOutsideSourceRepository: createBlock6aAssertion(
          !isInside(probeRoot, sourceRoot), 'static_manifest',
          BLOCK6A_R6_PROVENANCE_EVIDENCE_ID, 'local_probe_boundary_observed',
        ),
        workspaceIsTemporaryGitRepository: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'local_probe_boundary_observed',
        ),
        apiCredentialEnvironmentExcludedFromUtility: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
          'utility_environment_boundary_frozen',
        ),
        promptAndSchemaNotPassedInProtocol: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'typed_protocol_boundary_frozen',
        ),
        scenarioCount: createBlock6aAssertion(
          scenarios.length === 2, 'real_sdk',
          BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.outputSchema,
          'output_schema_probe_completed',
        ),
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
      evidenceId: BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.outputSchema,
      task: '6A.6',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-output-schema-probe',
      classification: 'probe_infrastructure_failed',
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
            code: error.code,
            reason: error.reason,
            utilityErrorCode: error.utilityErrorCode ?? null,
            protocolDiagnostic: error.protocolDiagnostic ?? null,
            terminationCleanup: error.terminationCleanup ?? null,
          }
        : { code: 'UNCLASSIFIED_PROBE_FAILURE' },
    });
  } finally {
    exitAfterBestEffortCleanup(probeRoot);
  }
});

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
    assertions: {
      promptResponseAndRawErrorsExcluded: createBlock6aAssertion(
        true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
        'sanitized_progress_boundary',
      ),
    },
    progress: { completedScenarioCount, currentScenario },
  });
}
