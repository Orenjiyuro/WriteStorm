import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryService } from '../../../src/main/library/library-service';
import { SourceTextService } from '../../../src/main/source-text/source-text-service';
import type { LibraryId } from '../../../src/shared/domain';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('SourceText source health', () => {
  it('distinguishes stale staging, orphan, missing, and hash-mismatched files', async () => {
    const { library, rootPath } = healthLibrary();
    try {
      seedHealthRows(library);
      writeRelative(rootPath, 'source/healthy/healthy.md', 'healthy');
      writeRelative(rootPath, 'source/mismatch/mismatch.md', 'changed');
      writeRelative(rootPath, 'source/orphan/orphan.md', 'manual review');
      mkdirSync(path.join(rootPath, 'source', 'orphan-empty'), { recursive: true });
      const stalePath = writeRelative(rootPath, 'source/.staging/stale.tmp', 'stale');
      writeRelative(rootPath, 'source/.staging/fresh.tmp', 'fresh');
      utimesSync(stalePath, new Date('2026-07-12T00:00:00.000Z'), new Date('2026-07-12T00:00:00.000Z'));

      const service = new SourceTextService({ libraryService: library });
      const issues = await service.inspectHealth({
        staleStagingBefore: new Date('2026-07-13T00:00:00.000Z'),
      });

      expect(issues).toEqual(expect.arrayContaining([
        {
          kind: 'stale_staging',
          relativePath: 'source/.staging/stale.tmp',
          autoRemovable: true,
        },
        {
          kind: 'orphan_source',
          relativePath: 'source/orphan/orphan.md',
          autoRemovable: false,
        },
        {
          kind: 'orphan_source',
          relativePath: 'source/orphan-empty',
          autoRemovable: false,
        },
        {
          kind: 'missing_source',
          sourceTextId: 'missing',
          relativePath: 'source/missing/missing.md',
          autoRemovable: false,
        },
        {
          kind: 'hash_mismatch',
          sourceTextId: 'mismatch',
          relativePath: 'source/mismatch/mismatch.md',
          autoRemovable: false,
        },
      ]));
      expect(issues).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ relativePath: 'source/healthy/healthy.md' }),
        expect.objectContaining({ relativePath: 'source/.staging/fresh.tmp' }),
      ]));
    } finally {
      library.closeCurrent();
    }
  });

  it('automatically removes only stale staging files', async () => {
    const { library, rootPath } = healthLibrary();
    try {
      seedHealthRows(library);
      writeRelative(rootPath, 'source/healthy/healthy.md', 'healthy');
      writeRelative(rootPath, 'source/mismatch/mismatch.md', 'changed');
      const orphanPath = writeRelative(rootPath, 'source/orphan/orphan.md', 'manual review');
      const stalePath = writeRelative(rootPath, 'source/.staging/stale.tmp', 'stale');
      utimesSync(stalePath, new Date('2026-07-12T00:00:00.000Z'), new Date('2026-07-12T00:00:00.000Z'));
      const service = new SourceTextService({ libraryService: library });
      const issues = await service.inspectHealth({
        staleStagingBefore: new Date('2026-07-13T00:00:00.000Z'),
      });

      expect(await service.removeAutoRemovableHealthIssues([
        ...issues,
        {
          kind: 'stale_staging',
          relativePath: 'source/.staging/../orphan/orphan.md',
          autoRemovable: true,
        },
      ])).toEqual([
        'source/.staging/stale.tmp',
      ]);
      expect(existsSync(stalePath)).toBe(false);
      expect(existsSync(orphanPath)).toBe(true);
    } finally {
      library.closeCurrent();
    }
  });
});

function healthLibrary(): { library: LibraryService; rootPath: string } {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-health-'));
  tempDirs.push(tempDir);
  const rootPath = path.join(tempDir, 'library');
  const library = new LibraryService({
    appVersion: '0.1.0-test',
    createLibraryId: () => 'health-library' as LibraryId,
  });
  library.create({ rootPath, name: 'Health Library' });
  return { library, rootPath };
}

function seedHealthRows(library: LibraryService): void {
  const healthyHash = sha256('healthy');
  library.getUnitOfWork().write((session) => session.database.exec(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-health', 'Health', '2026-07-13T00:00:00.000Z', '2026-07-13T00:00:00.000Z');
    INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash,
      encoding, source_edition, relative_path, imported_at
    ) VALUES
      ('healthy', 'book-health', 'healthy.md', 7, 'md', '${healthyHash}',
        'utf-8', 1, 'source/healthy/healthy.md', '2026-07-13T00:00:00.000Z'),
      ('mismatch', 'book-health', 'mismatch.md', 8, 'md', '${sha256('expected')}',
        'utf-8', 2, 'source/mismatch/mismatch.md', '2026-07-13T00:00:00.000Z'),
      ('missing', 'book-health', 'missing.md', 7, 'md', '${sha256('missing')}',
        'utf-8', 3, 'source/missing/missing.md', '2026-07-13T00:00:00.000Z');
  `));
}

function writeRelative(rootPath: string, relativePath: string, content: string): string {
  const filePath = path.join(rootPath, ...relativePath.split('/'));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}
