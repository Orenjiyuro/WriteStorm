import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { detectSourceTextDuplicateByHash } from '../../../src/main/source-text/source-text-conflicts';
import { importBookWithSourceText } from '../../../src/main/source-text/source-text-import-transaction';
import { buildSourceTextImportMetadata } from '../../../src/main/source-text/source-text-metadata';
import type {
  BreakdownBookId,
  LibraryId,
  SourceTextId,
} from '../../../src/shared/domain';

const tempDirs: string[] = [];
const libraryId = 'library-1' as LibraryId;
const importedAt = '2026-07-09T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('source text import duplicate conflict detection', () => {
  it('blocks duplicate source hashes and returns the existing book and source ids', () => {
    const db = migratedDatabase();

    try {
      importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-1' as BreakdownBookId,
        title: 'Existing Book',
        sourceText: sourceTextMetadata({
          bookId: 'book-1' as BreakdownBookId,
          sourceTextId: 'source-1' as SourceTextId,
          contentHash: 'sha256:duplicate',
        }),
        updatedAt: importedAt,
      });

      expect(detectSourceTextDuplicateByHash(db, {
        contentHash: 'sha256:duplicate',
      })).toEqual({
        ok: false,
        reason: 'duplicate_source_hash',
        message: 'This source text has already been imported.',
        existingBookId: 'book-1',
        existingSourceTextId: 'source-1',
      });
    } finally {
      db.close();
    }
  });

  it('allows new source hashes', () => {
    const db = migratedDatabase();

    try {
      expect(detectSourceTextDuplicateByHash(db, {
        contentHash: 'sha256:new',
      })).toEqual({ ok: true });
    } finally {
      db.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const db = openSqliteDatabase(tempDatabasePath());
  runMigrations(db, APP_MIGRATIONS);

  return db;
}

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-conflicts-'));
  tempDirs.push(tempDir);

  return path.join(tempDir, 'writestorm.sqlite');
}

function sourceTextMetadata(input: {
  readonly bookId: BreakdownBookId;
  readonly sourceTextId: SourceTextId;
  readonly contentHash: string;
}) {
  return buildSourceTextImportMetadata({
    bookId: input.bookId,
    sourceTextId: input.sourceTextId,
    originalFileName: 'Example.md',
    format: 'md',
    sizeBytes: 120,
    encoding: 'utf-8',
    contentHash: input.contentHash,
    relativePath: `source/${input.sourceTextId}/Example.md`,
    importedAt,
  });
}
