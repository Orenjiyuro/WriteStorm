import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

    expect(path.dirname(workspace.directory)).toBe(temporaryRoot);
    expect(path.basename(workspace.directory)).toMatch(/^writestorm-ai-scratch-/);
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

  it('rejects a pre-existing junction instead of escaping the injected temporary root', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-link-'));
    const escapedTarget = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-target-'));
    const sentinel = path.join(escapedTarget, 'library.db');
    writeFileSync(sentinel, 'must-survive', 'utf8');
    symlinkSync(
      escapedTarget,
      path.join(temporaryRoot, 'writestorm-ai-scratch'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const manager = new CodexScratchWorkspaceManager(temporaryRoot);
    const workspace = manager.create();
    expect(path.relative(escapedTarget, workspace.directory)).toMatch(/^\.\.(?:[\\/]|$)/);
    workspace.cleanup();
    expect(readFileSync(sentinel, 'utf8')).toBe('must-survive');

    rmSync(temporaryRoot, { recursive: true, force: true });
    rmSync(escapedTarget, { recursive: true, force: true });
  });

  it('refuses cleanup after an owned directory is replaced by a junction', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-swap-'));
    const escapedTarget = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-swap-target-'));
    const sentinel = path.join(escapedTarget, 'library.db');
    writeFileSync(sentinel, 'must-survive', 'utf8');
    const workspace = new CodexScratchWorkspaceManager(temporaryRoot).create();

    rmSync(workspace.directory, { recursive: true, force: true });
    symlinkSync(
      escapedTarget,
      workspace.directory,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    expect(() => workspace.cleanup()).toThrow(/scratch.*boundary/i);
    expect(readFileSync(sentinel, 'utf8')).toBe('must-survive');
    rmSync(temporaryRoot, { recursive: true, force: true });
    rmSync(escapedTarget, { recursive: true, force: true });
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
