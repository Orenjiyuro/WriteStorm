import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCodexCliEnvironment,
  classifyCodexFailure,
} from '../../src/main/codex-feasibility/utility-entry';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.5 cwd, Git, environment and auth boundary', () => {
  it('locks the sanitized real-SDK cwd/Git/auth evidence and its provenance', () => {
    const evidence = JSON.parse(readFileSync(
      path.join(
        rootDir,
        'docs/engineering/evidence/block6a-task6a5-cwd-git-env-auth.json',
      ),
      'utf8',
    )) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      scenarios: Array<Record<string, unknown>>;
    };

    expect(evidence.source).toBe('real_sdk');
    expect(evidence.classification).toBe('cwd_git_env_auth_probe_completed');
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(evidence.scenarios).toHaveLength(5);
    expect(evidence.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scenario: 'explicit-non-git-isolated-auth',
        outcome: 'git_repo_required',
        skipGitRepoCheck: false,
      }),
      expect.objectContaining({
        scenario: 'skip-non-git-isolated-auth',
        outcome: 'auth_failed',
        skipGitRepoCheck: true,
      }),
      expect.objectContaining({
        scenario: 'current-auth-explicit-git',
        outcome: 'success',
        authClassification: 'authenticated',
        finalResponseMatched: true,
      }),
    ]));
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('WRITESTORM_PROBE_OK');
    expect(serialized).not.toMatch(/[A-Z]:\\\\/);
    expect(serialized).not.toMatch(/"(?:prompt|stdout|stderr|credential|token|cookie|authorization|environmentValue|utilityPid)"\s*:/i);
  });

  it('validates capability requests without admitting prompt or environment values', () => {
    const request = {
      version: 1,
      origin: 'main',
      requestId: 'capability-1',
      command: 'run-capability-probe',
      input: {
        scenario: 'explicit-git-isolated-auth',
        expectedUtilityWorkingDirectory: 'C:\\probe\\non-git',
        workingDirectory: 'C:\\probe\\explicit-git',
        skipGitRepoCheck: false,
        authMode: 'isolated-empty',
        isolatedCodexHome: 'C:\\probe\\codex-home-empty',
      },
    };

    expect(isCodexFeasibilityRequest(request)).toBe(true);
    expect(isCodexFeasibilityRequest({ ...request, prompt: 'rejected' })).toBe(false);
    expect(isCodexFeasibilityRequest({
      ...request,
      input: { ...request.input, env: { TOKEN: 'rejected' } },
    })).toBe(false);
    expect(isCodexFeasibilityResponse({
      version: 1,
      requestId: 'capability-1',
      command: 'run-capability-probe',
      ok: true,
      utilityPid: 1,
      result: {
        scenario: 'explicit-git-isolated-auth',
        outcome: 'login_required',
        authClassification: 'login_required',
        utilityCwdMatchedExpected: true,
        explicitWorkingDirectoryRequested: true,
        skipGitRepoCheck: false,
        envPolicy: 'explicit_allowlist_no_api_credentials',
        finalResponseMatched: null,
      },
    })).toBe(true);
  });

  it('builds an explicit CLI environment while excluding API credentials and probe controls', () => {
    const inherited: NodeJS.ProcessEnv = {
      Path: 'C:\\Windows\\System32',
      USERPROFILE: 'C:\\Users\\fixture',
      TEMP: 'C:\\Temp',
      HTTPS_PROXY: 'http://proxy.invalid',
      CODEX_HOME: 'C:\\Users\\fixture\\.codex',
      OPENAI_API_KEY: 'redacted-fixture',
      CODEX_API_KEY: 'redacted-fixture',
      CODEX_ACCESS_TOKEN: 'redacted-fixture',
      WRITESTORM_CODEX_SYNTHETIC_INPUT: 'redacted-fixture',
    };
    const current = buildCodexCliEnvironment(inherited, { authMode: 'current' });
    const isolated = buildCodexCliEnvironment(inherited, {
      authMode: 'isolated-empty',
      isolatedCodexHome: 'C:\\probe\\codex-home-empty',
    });

    expect(current).toMatchObject({ Path: inherited.Path, USERPROFILE: inherited.USERPROFILE });
    expect(current.CODEX_HOME).toBe(inherited.CODEX_HOME);
    expect(isolated.CODEX_HOME).toBe('C:\\probe\\codex-home-empty');
    for (const key of [
      'OPENAI_API_KEY',
      'CODEX_API_KEY',
      'CODEX_ACCESS_TOKEN',
      'WRITESTORM_CODEX_SYNTHETIC_INPUT',
    ]) {
      expect(current).not.toHaveProperty(key);
      expect(isolated).not.toHaveProperty(key);
    }
  });

  it('maps raw SDK failures to closed cwd/auth classifications without retaining the raw message', () => {
    expect(classifyCodexFailure(new Error('not inside a trusted directory'))).toEqual({
      outcome: 'git_repo_required',
      authClassification: 'unverified',
    });
    expect(classifyCodexFailure(new Error('not logged in; run login'))).toEqual({
      outcome: 'login_required',
      authClassification: 'login_required',
    });
    expect(classifyCodexFailure(new Error('401 unauthorized'))).toEqual({
      outcome: 'auth_failed',
      authClassification: 'auth_failed',
    });
    expect(classifyCodexFailure(new Error('unrecognized failure details'))).toEqual({
      outcome: 'runtime_failed',
      authClassification: 'unverified',
    });
  });

  it('keeps the no-window Electron probe isolated and free of a committed synthetic prompt', () => {
    const probeMainPath = path.join(rootDir, 'src/main/codex-feasibility/probe-main.ts');
    expect(existsSync(probeMainPath)).toBe(true);
    if (!existsSync(probeMainPath)) return;
    const source = readFileSync(probeMainPath, 'utf8');
    const utilitySource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
      'utf8',
    );

    expect(source).toContain('mkdtempSync');
    expect(source).toContain("execFileSync('git'");
    expect(source).toContain("path.join(probeRoot, 'library')");
    expect(source).toContain("path.join(probeRoot, 'workspaces'");
    expect(utilitySource).toContain('WRITESTORM_CODEX_SYNTHETIC_INPUT');
    expect(source).not.toMatch(/Reply with|WRITESTORM_PROBE_OK|Thread\.run\(['\"]/);
    expect(source).not.toContain('BrowserWindow');
  });
});
