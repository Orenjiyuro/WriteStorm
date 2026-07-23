import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCodexFeasibilityRequest } from '../../src/main/codex-feasibility/protocol';
import { evaluateTask13NoGitPackagedProbeGate } from '../../src/main/codex-feasibility/task13-no-git-packaged-probe';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.5 packaged no-global-Git probe', () => {
  it('admits only the explicit packaged Windows x64 trigger and fixed synthetic hashes', () => {
    expect(evaluateTask13NoGitPackagedProbeGate({
      trigger: '1',
      runId: '123e4567-e89b-42d3-a456-426614174000',
      gitHead: '2bdd7b1665bff59fbc0f65f5532787b045ea1805',
      syntheticInput: 'Return only one JSON object with exactly this shape: {"status":"WS6A"}. Do not add markdown or any other text.',
      syntheticExpected: 'WS6A',
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      temporaryDirectory: 'C:\\Temp',
    }).accepted).toBe(true);
  });

  it('allows output-schema probe requests to require non-Git operation explicitly', () => {
    expect(isCodexFeasibilityRequest({
      version: 1,
      origin: 'main',
      requestId: 'task13-5-output-schema',
      command: 'run-output-schema-probe',
      input: {
        scenario: 'valid-minimal',
        workingDirectory: 'C:\\Temp\\writestorm-non-git',
        skipGitRepoCheck: true,
      },
    })).toBe(true);
  });

  it('keeps the probe explicit, sanitized and outside product services', () => {
    const probe = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/task13-no-git-packaged-probe.ts'),
      'utf8',
    );
    const runner = readFileSync(
      path.join(rootDir, 'scripts/run-task13-5-no-git-packaged-probe.mjs'),
      'utf8',
    );

    expect(probe).toContain('skipGitRepoCheck: true');
    expect(probe).toContain('whereGitUnavailable');
    expect(probe).toContain('getCommandGitUnavailable');
    expect(probe).toContain('cliResidualAbsent');
    expect(runner).toContain('PATH: createNoGitPath(systemRoot)');
    expect(runner).toContain('readSanitizedResultSummary(resultPath)');
    expect(runner).toContain('failedAssertions=${resultSummary.failedAssertions');
    expect(runner).not.toMatch(/OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/);
  });
});
