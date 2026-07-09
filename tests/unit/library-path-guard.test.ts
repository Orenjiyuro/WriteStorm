import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertPathInsideLibraryRoot,
  resolveLibraryRelativePath,
} from '../../src/main/library/path-guard';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('library path guard', () => {
  it('resolves relative library paths inside the canonical root', () => {
    const root = tempDirectory('writestorm-path-guard-root-');

    expect(resolveLibraryRelativePath(root, 'source/book.md')).toBe(
      path.join(root, 'source', 'book.md'),
    );
    expect(assertPathInsideLibraryRoot(root, path.join(root, 'writestorm.sqlite'))).toBe(
      path.join(root, 'writestorm.sqlite'),
    );
  });

  it('rejects traversal, absolute child inputs, and same-prefix sibling escapes', () => {
    const parent = tempDirectory('writestorm-path-guard-parent-');
    const root = path.join(parent, 'library');
    const sibling = path.join(parent, 'library-sibling');

    expect(() => resolveLibraryRelativePath(root, '..')).toThrow(/must stay inside library root/i);
    expect(() => resolveLibraryRelativePath(root, '../outside.txt')).toThrow(
      /must stay inside library root/i,
    );
    expect(() => resolveLibraryRelativePath(root, path.join(parent, 'outside.txt'))).toThrow(
      /must be relative/i,
    );
    expect(() => assertPathInsideLibraryRoot(root, path.join(sibling, 'writestorm.sqlite'))).toThrow(
      /must stay inside library root/i,
    );
  });

  it('rejects symlink or junction paths that escape the library root', () => {
    const root = tempDirectory('writestorm-path-guard-root-');
    const outside = tempDirectory('writestorm-path-guard-outside-');
    const linkPath = path.join(root, 'source-link');

    symlinkSync(outside, linkPath, 'junction');

    expect(existsSync(linkPath)).toBe(true);
    expect(() => resolveLibraryRelativePath(root, 'source-link/escape.txt')).toThrow(
      /symlink escapes library root/i,
    );
  });
});

function tempDirectory(prefix: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}
