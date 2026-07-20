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
import type {
  CodexCapabilityProbeInput,
  CodexCapabilityProbeResult,
} from './protocol';
import { validateMinimalStructuredOutput } from './structured-output';
import {
  BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
  BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
  createBlock6aAssertion,
} from './assertion-provenance';
import { CODEX_FEASIBILITY_SESSION_TIMEOUT_MS } from './turn-deadline';

type ScenarioPlan = {
  readonly input: CodexCapabilityProbeInput;
  readonly utilityWorkingDirectory: string;
};

const resultPath = process.env.WRITESTORM_CODEX_CAPABILITY_RESULT;
const utilityModulePath = process.env.WRITESTORM_CODEX_UTILITY_PATH;
const sourceRoot = process.env.WRITESTORM_CODEX_SOURCE_ROOT;
const expectedCliPath = process.env.WRITESTORM_CODEX_CLI_PATH;

void app.whenReady().then(async () => {
  if (!resultPath || !utilityModulePath || !sourceRoot || !expectedCliPath) {
    process.exit(31);
    return;
  }

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-codex-capability-'));
  const libraryRoot = path.join(probeRoot, 'library');
  const workspacesRoot = path.join(probeRoot, 'workspaces');
  const defaultGit = path.join(workspacesRoot, 'default-git');
  const explicitGit = path.join(workspacesRoot, 'explicit-git');
  const nonGit = path.join(workspacesRoot, 'non-git');
  const emptyCodexHome = path.join(probeRoot, 'codex-home-empty');
  const utilityEnvironment = createCodexUtilityEnvironment(process.env);
  const runner = new CodexFeasibilityRunner({ modulePath: utilityModulePath });

  try {
    for (const directory of [libraryRoot, workspacesRoot, defaultGit, explicitGit, nonGit, emptyCodexHome]) {
      mkdirSync(directory, { recursive: true });
    }
    initializeGitRepository(defaultGit);
    initializeGitRepository(explicitGit);

    const scenarioPlans: ScenarioPlan[] = [
      {
        input: {
          scenario: 'default-git-isolated-auth',
          expectedUtilityWorkingDirectory: defaultGit,
          skipGitRepoCheck: false,
          authMode: 'isolated-empty',
          isolatedCodexHome: emptyCodexHome,
        },
        utilityWorkingDirectory: defaultGit,
      },
      {
        input: {
          scenario: 'explicit-git-isolated-auth',
          expectedUtilityWorkingDirectory: nonGit,
          workingDirectory: explicitGit,
          skipGitRepoCheck: false,
          authMode: 'isolated-empty',
          isolatedCodexHome: emptyCodexHome,
        },
        utilityWorkingDirectory: nonGit,
      },
      {
        input: {
          scenario: 'explicit-non-git-isolated-auth',
          expectedUtilityWorkingDirectory: defaultGit,
          workingDirectory: nonGit,
          skipGitRepoCheck: false,
          authMode: 'isolated-empty',
          isolatedCodexHome: emptyCodexHome,
        },
        utilityWorkingDirectory: defaultGit,
      },
      {
        input: {
          scenario: 'skip-non-git-isolated-auth',
          expectedUtilityWorkingDirectory: defaultGit,
          workingDirectory: nonGit,
          skipGitRepoCheck: true,
          authMode: 'isolated-empty',
          isolatedCodexHome: emptyCodexHome,
        },
        utilityWorkingDirectory: defaultGit,
      },
      {
        input: {
          scenario: 'current-auth-explicit-git',
          expectedUtilityWorkingDirectory: nonGit,
          workingDirectory: explicitGit,
          skipGitRepoCheck: false,
          authMode: 'current',
        },
        utilityWorkingDirectory: nonGit,
      },
    ];

    const scenarios: CodexCapabilityProbeResult[] = [];
    for (const plan of scenarioPlans) {
      writeSanitizedProgress(plan.input.scenario, scenarios.length);
      const ownership = new WindowsOwnedProcessGuard({
        utilityExecutablePath: process.execPath,
        cliExecutablePath: expectedCliPath,
        observationStartedAt: Date.now() - 1_000,
      });
      try {
        const outcome = await runner.runCapabilityProbe(
          plan.input,
          CODEX_FEASIBILITY_SESSION_TIMEOUT_MS,
          {
            utilityWorkingDirectory: plan.utilityWorkingDirectory,
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
      evidenceId: 'block6a-6a5-real-sdk-cwd-git-env-auth-001',
      task: '6A.5',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-cwd-git-env-auth-probe',
      classification: 'cwd_git_env_auth_probe_completed',
      versions: {
        electron: process.versions.electron ?? 'unavailable',
        nodeRuntime: process.versions.node,
        codexSdk: '0.144.6',
      },
      assertions: {
        probeRootOutsideSourceRepository: createBlock6aAssertion(
          !isInside(probeRoot, sourceRoot), 'static_manifest',
          BLOCK6A_R6_PROVENANCE_EVIDENCE_ID, 'local_probe_boundary_observed',
        ),
        workspacesOutsideLibraryRoot: createBlock6aAssertion(
          !isInside(workspacesRoot, libraryRoot), 'static_manifest',
          BLOCK6A_R6_PROVENANCE_EVIDENCE_ID, 'local_probe_boundary_observed',
        ),
        workspacesOutsidePackagedResources: createBlock6aAssertion(
          !isInside(workspacesRoot, process.resourcesPath), 'static_manifest',
          BLOCK6A_R6_PROVENANCE_EVIDENCE_ID, 'local_probe_boundary_observed',
        ),
        apiCredentialEnvironmentExcludedFromUtility: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID,
          'utility_environment_boundary_frozen',
        ),
        syntheticInputNotPassedInProtocol: createBlock6aAssertion(
          true, 'static_manifest', BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
          'typed_protocol_boundary_frozen',
        ),
        scenarioCount: createBlock6aAssertion(
          scenarios.length === 5, 'real_sdk',
          'block6a-6a5-real-sdk-cwd-git-env-auth-001',
          'cwd_git_env_auth_probe_completed',
        ),
      },
      scenarios,
      limitations: [
        'No prompt, path, environment value, credential, PID or raw SDK error is retained.',
        'The current-auth scenario classifies the existing state but does not create or modify login state.',
        'WriteStorm has no product login UI in Task 6A.5.',
        'Unstructured SDK or CLI failures are retained only as runtime_failed / unverified and block recertification.',
      ],
    });
  } catch (error) {
    writeSanitizedResult({
      schemaVersion: 1,
      evidenceId: 'block6a-6a5-real-sdk-cwd-git-env-auth-001',
      task: '6A.5',
      source: 'real_sdk',
      recordedAt: new Date().toISOString(),
      commandName: 'block6a-electron-utility-cwd-git-env-auth-probe',
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
        : { code: 'UNCLASSIFIED_PROBE_FAILURE' },
    });
  } finally {
    exitAfterBestEffortCleanup(probeRoot);
  }
});

function initializeGitRepository(directory: string): void {
  execFileSync('git', ['init', '--quiet', directory], { stdio: 'ignore' });
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
    task: '6A.5',
    source: 'real_sdk',
    recordedAt: new Date().toISOString(),
    commandName: 'block6a-electron-utility-cwd-git-env-auth-probe',
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
