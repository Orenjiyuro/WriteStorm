import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  copySourceTextToLibrarySource,
  type SourceTextCopyFileSystem,
} from '../../src/main/source-text/source-text-copy';
import type { SourceTextId } from '../../src/shared/domain';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('source text library copy', () => {
  it('copies source bytes into the library source directory through a staging file', () => {
    const libraryRootPath = fixtureLibraryRoot();
    const sourcePath = fixtureSourceFile('Outside Example.md', 'Chapter 1\n');

    const result = copySourceTextToLibrarySource({
      libraryRootPath,
      sourcePath,
      sourceTextId: 'source-1' as SourceTextId,
      originalFileName: 'Outside Example.md',
      createTempFileName: () => '.copy.tmp',
    });

    const expectedTargetPath = path.join(libraryRootPath, 'source', 'source-1', 'Outside Example.md');
    expect(result).toEqual({
      ok: true,
      relativePath: 'source/source-1/Outside Example.md',
      targetPath: expectedTargetPath,
      sizeBytes: 10,
      contentHash: `sha256:${sha256(Buffer.from('Chapter 1\n'))}`,
    });
    expect(readFileSync(expectedTargetPath, 'utf8')).toBe('Chapter 1\n');
    expect(readdirSync(path.dirname(expectedTargetPath))).not.toContain('.copy.tmp');
  });

  it('does not overwrite an existing copied source target', () => {
    const libraryRootPath = fixtureLibraryRoot();
    const sourcePath = fixtureSourceFile('outside.md', 'new content');
    const targetPath = path.join(libraryRootPath, 'source', 'source-1', 'outside.md');
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, 'existing content');

    expect(copySourceTextToLibrarySource({
      libraryRootPath,
      sourcePath,
      sourceTextId: 'source-1' as SourceTextId,
      originalFileName: 'outside.md',
      createTempFileName: () => '.copy.tmp',
    })).toEqual({
      ok: false,
      reason: 'target_conflict',
      message: 'Copied source target already exists.',
      relativePath: 'source/source-1/outside.md',
    });
    expect(readFileSync(targetPath, 'utf8')).toBe('existing content');
    expect(existsSync(path.join(path.dirname(targetPath), '.copy.tmp'))).toBe(false);
  });

  it('cleans the staging file when final placement fails', () => {
    const libraryRootPath = fixtureLibraryRoot();
    const sourcePath = fixtureSourceFile('outside.md', 'new content');
    const removedPaths: string[] = [];
    const fileSystem: SourceTextCopyFileSystem = {
      readFileSync: () => Buffer.from('new content'),
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      linkSync: () => {
        throw new Error('final placement failed');
      },
      rmSync: (targetPath) => {
        removedPaths.push(targetPath);
      },
      existsSync: () => false,
    };

    expect(copySourceTextToLibrarySource({
      libraryRootPath,
      sourcePath,
      sourceTextId: 'source-1' as SourceTextId,
      originalFileName: 'outside.md',
      createTempFileName: () => '.copy.tmp',
      fileSystem,
    })).toEqual({
      ok: false,
      reason: 'copy_failed',
      message: 'Source file could not be copied into the library.',
    });
    expect(removedPaths).toEqual([
      path.join(libraryRootPath, 'source', 'source-1', '.copy.tmp'),
    ]);
  });

  it('does not overwrite when the target appears after the initial existence check', () => {
    const libraryRootPath = fixtureLibraryRoot();
    const sourcePath = fixtureSourceFile('outside.md', 'new content');
    const removedPaths: string[] = [];
    const fileSystem: SourceTextCopyFileSystem = {
      readFileSync: () => Buffer.from('new content'),
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      linkSync: () => {
        const error = new Error('target exists') as NodeJS.ErrnoException;
        error.code = 'EEXIST';
        throw error;
      },
      rmSync: (targetPath) => {
        removedPaths.push(targetPath);
      },
      existsSync: () => false,
    };

    expect(copySourceTextToLibrarySource({
      libraryRootPath,
      sourcePath,
      sourceTextId: 'source-1' as SourceTextId,
      originalFileName: 'outside.md',
      createTempFileName: () => '.copy.tmp',
      fileSystem,
    })).toEqual({
      ok: false,
      reason: 'target_conflict',
      message: 'Copied source target already exists.',
      relativePath: 'source/source-1/outside.md',
    });
    expect(removedPaths).toEqual([
      path.join(libraryRootPath, 'source', 'source-1', '.copy.tmp'),
    ]);
  });
});

function fixtureLibraryRoot(): string {
  const rootPath = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-copy-library-'));
  tempDirs.push(rootPath);
  mkdirSync(path.join(rootPath, 'source'), { recursive: true });

  return rootPath;
}

function fixtureSourceFile(fileName: string, content: string): string {
  const rootPath = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-copy-original-'));
  tempDirs.push(rootPath);
  const sourcePath = path.join(rootPath, fileName);
  writeFileSync(sourcePath, content);

  return sourcePath;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
