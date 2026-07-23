import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CodexScratchWorkspaceManager } from '../../src/main/ai/providers/codex/codex-scratch-workspace';

describe('Block 13.5 Codex scratch workspace', () => {
  it('creates an isolated non-Git workspace with the SDK Git check disabled', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-test-'));
    const manager = new CodexScratchWorkspaceManager(temporaryRoot);
    const workspace = manager.create();

    expect(path.dirname(workspace.directory)).toBe(path.join(temporaryRoot, 'writestorm-ai-scratch'));
    expect(existsSync(path.join(workspace.directory, '.git'))).toBe(false);
    expect(workspace.threadOptions).toEqual({
      workingDirectory: workspace.directory,
      skipGitRepoCheck: true,
    });

    writeFileSync(path.join(workspace.directory, 'owned.tmp'), 'owned', 'utf8');
    workspace.cleanup();
    workspace.cleanup();
    expect(existsSync(workspace.directory)).toBe(false);
  });

  it('contains no Git executable, shell, PATH or repository initialization dependency', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/main/ai/providers/codex/codex-scratch-workspace.ts'),
      'utf8',
    );

    expect(source).not.toMatch(
      /child_process|execFile|spawn\(|git init|process\.env|process\.getenv|["']PATH["']/i,
    );
    expect(source).toContain('skipGitRepoCheck: true');
  });
});
