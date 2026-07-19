import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
} from './runner';
import type {
  CodexCapabilityProbeInput,
  CodexCapabilityProbeResult,
} from './protocol';
import { validateMinimalStructuredOutput } from './structured-output';

type ScenarioPlan = {
  readonly input: CodexCapabilityProbeInput;
  readonly utilityWorkingDirectory: string;
};

const resultPath = process.env.WRITESTORM_CODEX_CAPABILITY_RESULT;
const utilityModulePath = process.env.WRITESTORM_CODEX_UTILITY_PATH;
const sourceRoot = process.env.WRITESTORM_CODEX_SOURCE_ROOT;

void app.whenReady().then(async () => {
  if (!resultPath || !utilityModulePath || !sourceRoot) {
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
  const utilityEnvironment = createUtilityEnvironment(process.env);
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
      const outcome = await runner.runCapabilityProbe(plan.input, 45_000, {
        utilityWorkingDirectory: plan.utilityWorkingDirectory,
        utilityEnvironment,
      });
      scenarios.push(outcome.result);
      writeSanitizedProgress(null, scenarios.length);
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
        probeRootOutsideSourceRepository: !isInside(probeRoot, sourceRoot),
        workspacesOutsideLibraryRoot: !isInside(workspacesRoot, libraryRoot),
        workspacesOutsidePackagedResources: !isInside(workspacesRoot, process.resourcesPath),
        apiCredentialEnvironmentExcludedFromUtility: true,
        syntheticInputNotPassedInProtocol: true,
        scenarioCount: scenarios.length === 5,
      },
      scenarios,
      limitations: [
        'No prompt, path, environment value, credential, PID or raw SDK error is retained.',
        'The current-auth scenario classifies the existing state but does not create or modify login state.',
        'WriteStorm has no product login UI in Task 6A.5.',
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
        sanitizedFailureRecorded: true,
      },
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
    assertions: { promptResponseAndRawErrorsExcluded: true },
    progress: { completedScenarioCount, currentScenario },
  });
}
