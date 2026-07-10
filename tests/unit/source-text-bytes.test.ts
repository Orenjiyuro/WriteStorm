import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSourceTextBytes } from '../../src/main/source-text/source-text-bytes';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('bounded source text reads', () => {
  it('returns the complete file when it is within the configured limit', () => {
    const sourcePath = fixtureFile('small.txt', Buffer.from('hello'));

    expect(readSourceTextBytes(sourcePath, { maxSizeBytes: 5 })).toEqual({
      ok: true,
      bytes: Buffer.from('hello'),
    });
  });

  it('reports a file that exceeds the limit without returning unbounded contents', () => {
    const sourcePath = fixtureFile('large.txt', Buffer.from('12345'));

    expect(readSourceTextBytes(sourcePath, { maxSizeBytes: 4 })).toEqual({
      ok: false,
      reason: 'file_too_large',
      message: 'Source file exceeds the 20 MiB import limit.',
      sizeBytes: 5,
      maxSizeBytes: 4,
    });
  });

  it('maps a source that disappears before the actual read to not_readable', () => {
    expect(readSourceTextBytes(path.join(os.tmpdir(), 'missing-writestorm-source.txt'), {
      maxSizeBytes: 5,
    })).toEqual({
      ok: false,
      reason: 'not_readable',
      message: 'Source file cannot be read.',
    });
  });
});

function fixtureFile(fileName: string, bytes: Buffer): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-bytes-'));
  tempDirs.push(tempDir);
  const sourcePath = path.join(tempDir, fileName);
  writeFileSync(sourcePath, bytes);

  return sourcePath;
}
