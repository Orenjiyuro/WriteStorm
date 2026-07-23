import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CodexScratchWorkspaceManager } from '../../src/main/ai/providers/codex/codex-scratch-workspace';

const rootDir = path.resolve(__dirname, '../..');

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

  it('owns the OS temporary root and rejects an absolute path outside it', () => {
    const workspace = new CodexScratchWorkspaceManager().create();
    expect(path.relative(os.tmpdir(), workspace.directory)).not.toMatch(/^\.\.(?:[\\/]|$)/);
    workspace.cleanup();

    expect(() => new CodexScratchWorkspaceManager(rootDir)).toThrow(
      'AI scratch root must be inside the operating-system temporary directory.',
    );
  });

  it('keeps cleanup retryable until owned-directory removal succeeds', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-retry-'));
    const removeOwnedDirectory = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error('simulated removal failure');
      })
      .mockImplementationOnce((directory: string) => {
        rmSync(directory, { recursive: true, force: true });
      });
    const manager = new CodexScratchWorkspaceManager(temporaryRoot, {
      removeOwnedDirectory,
    });
    const workspace = manager.create();

    expect(() => workspace.cleanup()).toThrow('simulated removal failure');
    expect(existsSync(workspace.directory)).toBe(true);
    expect(() => workspace.cleanup()).not.toThrow();
    workspace.cleanup();

    expect(removeOwnedDirectory).toHaveBeenCalledTimes(2);
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
