import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_SOURCE_SIZE_BYTES,
  preflightSourceTextFile,
  type SourceTextPreflightFileSystem,
} from '../../src/main/source-text/source-text-preflight';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('source text import preflight', () => {
  it('accepts readable non-empty txt and md files and returns stable metadata', () => {
    const txtPath = fixtureFile('Example.TXT', 'hello');
    const mdPath = fixtureFile('notes.md', '# title');

    expect(preflightSourceTextFile(txtPath)).toEqual({
      ok: true,
      filePath: txtPath,
      originalFileName: 'Example.TXT',
      format: 'txt',
      sizeBytes: 5,
      bytes: Buffer.from('hello'),
    });
    expect(preflightSourceTextFile(mdPath)).toEqual({
      ok: true,
      filePath: mdPath,
      originalFileName: 'notes.md',
      format: 'md',
      sizeBytes: 7,
      bytes: Buffer.from('# title'),
    });
  });

  it('rejects unsupported extensions before import work starts', () => {
    expect(preflightSourceTextFile(fixtureFile('novel.pdf', 'content'))).toEqual({
      ok: false,
      reason: 'invalid_extension',
      message: 'Only .txt and .md source files can be imported.',
    });
  });

  it('rejects empty files', () => {
    expect(preflightSourceTextFile(fixtureFile('empty.txt', ''))).toEqual({
      ok: false,
      reason: 'empty_file',
      message: 'Source file is empty.',
    });
  });

  it('rejects files larger than the 20 MiB task limit', () => {
    const largeFileSystem = fakeFileSystem({
      size: MAX_IMPORT_SOURCE_SIZE_BYTES + 1,
      readable: true,
      isFile: true,
    });

    expect(preflightSourceTextFile('C:\\Books\\large.md', { fileSystem: largeFileSystem })).toEqual({
      ok: false,
      reason: 'file_too_large',
      message: 'Source file exceeds the 20 MiB import limit.',
      details: {
        maxSizeBytes: MAX_IMPORT_SOURCE_SIZE_BYTES,
        sizeBytes: MAX_IMPORT_SOURCE_SIZE_BYTES + 1,
      },
    });
  });

  it('rejects unreadable or non-file selections without leaking file contents', () => {
    expect(preflightSourceTextFile('C:\\Books\\locked.txt', {
      fileSystem: fakeFileSystem({
        size: 10,
        readable: false,
        isFile: true,
      }),
    })).toEqual({
      ok: false,
      reason: 'not_readable',
      message: 'Source file cannot be read.',
    });
    expect(preflightSourceTextFile('C:\\Books\\directory.md', {
      fileSystem: fakeFileSystem({
        size: 10,
        readable: true,
        isFile: false,
      }),
    })).toEqual({
      ok: false,
      reason: 'not_readable',
      message: 'Source file cannot be read.',
    });
  });
});

function fixtureFile(fileName: string, content: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-preflight-'));
  tempDirs.push(tempDir);
  mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, fileName);
  writeFileSync(filePath, content);

  return filePath;
}

function fakeFileSystem(options: {
  readonly size: number;
  readonly readable: boolean;
  readonly isFile: boolean;
}): SourceTextPreflightFileSystem {
  return {
    accessSync: () => {
      if (!options.readable) {
        throw new Error('not readable');
      }
    },
    statSync: () => ({
      isFile: () => options.isFile,
      size: options.size,
    }),
  };
}
