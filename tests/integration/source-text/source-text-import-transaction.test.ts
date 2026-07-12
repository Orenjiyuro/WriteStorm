import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { buildSourceTextImportMetadata } from '../../../src/main/source-text/source-text-metadata';
import { importBookWithSourceText } from '../../../src/main/source-text/source-text-import-transaction';
import type {
  BreakdownBookId,
  JobId,
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

describe('source text import transaction', () => {
  it('delegates Job and checkpoint persistence instead of owning their SQL', () => {
    const source = readFileSync(
      path.resolve('src/main/source-text/source-text-import-transaction.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/INSERT INTO jobs/i);
    expect(source).not.toMatch(/INSERT INTO job_checkpoints/i);
    expect(source).toContain('JobService');
  });

  it('inserts the book and source_text metadata in one transaction', () => {
    const db = migratedDatabase();

    try {
      const sourceText = sourceTextMetadata({
        bookId: 'book-1' as BreakdownBookId,
        sourceTextId: 'source-1' as SourceTextId,
      });

      expect(importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-1' as BreakdownBookId,
        title: 'Imported Book',
        sourceText,
        updatedAt: importedAt,
      })).toEqual({
        book: {
          id: 'book-1',
          libraryId,
          title: 'Imported Book',
          sourceTextId: 'source-1',
          sourceTextEdition: 1,
          structureEdition: null,
          updatedAt: importedAt,
        },
        sourceText: sourceText.dto,
      });
      expect(db.prepare('SELECT id, title, current_source_text_id FROM books').all()).toEqual([
        {
          id: 'book-1',
          title: 'Imported Book',
          current_source_text_id: 'source-1',
        },
      ]);
      expect(db.prepare('SELECT id, book_id, original_file_name, size_bytes FROM source_texts').all()).toEqual([
        {
          id: 'source-1',
          book_id: 'book-1',
          original_file_name: 'Example.md',
          size_bytes: 120,
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('rolls back the book insert when source_text insertion fails', () => {
    const db = migratedDatabase();

    try {
      const firstSourceText = sourceTextMetadata({
        bookId: 'book-1' as BreakdownBookId,
        sourceTextId: 'source-1' as SourceTextId,
      });
      importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-1' as BreakdownBookId,
        title: 'First Book',
        sourceText: firstSourceText,
        updatedAt: importedAt,
      });

      const conflictingSourceText = sourceTextMetadata({
        bookId: 'book-2' as BreakdownBookId,
        sourceTextId: 'source-1' as SourceTextId,
      });

      expect(() => importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-2' as BreakdownBookId,
        title: 'Second Book',
        sourceText: conflictingSourceText,
        updatedAt: importedAt,
      })).toThrow();
      expect(db.prepare('SELECT id FROM books ORDER BY id').pluck().all()).toEqual(['book-1']);
      expect(db.prepare('SELECT id, book_id FROM source_texts ORDER BY book_id').all()).toEqual([
        {
          id: 'source-1',
          book_id: 'book-1',
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('commits Book, SourceText, completed Job, and checkpoint atomically', () => {
    const db = migratedDatabase();

    try {
      importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-atomic' as BreakdownBookId,
        title: 'Atomic Import',
        sourceText: sourceTextMetadata({
          bookId: 'book-atomic' as BreakdownBookId,
          sourceTextId: 'source-atomic' as SourceTextId,
        }),
        job: {
          sourceTextId: 'source-atomic' as SourceTextId,
          summary: {
            id: 'job-atomic' as JobId,
            bookId: 'book-atomic' as BreakdownBookId,
            state: 'completed',
            title: 'Import source',
            completedUnits: 1,
            totalUnits: 1,
            checkpointSummary: 'Source imported.',
            failureReason: null,
            updatedAt: importedAt,
          },
        },
        updatedAt: importedAt,
      });

      expect(db.prepare('SELECT id, current_source_text_id FROM books').get()).toEqual({
        id: 'book-atomic',
        current_source_text_id: 'source-atomic',
      });
      expect(db.prepare('SELECT id, book_id FROM source_texts').get()).toEqual({
        id: 'source-atomic',
        book_id: 'book-atomic',
      });
      expect(db.prepare('SELECT id, kind, state, completed_units FROM jobs').get()).toEqual({
        id: 'job-atomic',
        kind: 'source_import',
        state: 'completed',
        completed_units: 1,
      });
      expect(db.prepare('SELECT job_id, sequence, kind FROM job_checkpoints').get()).toEqual({
        job_id: 'job-atomic',
        sequence: 1,
        kind: 'source_import_completed',
      });
    } finally {
      db.close();
    }
  });

  it('rejects duplicate source_text content hashes and rolls back the second book', () => {
    const db = migratedDatabase();

    try {
      importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-1' as BreakdownBookId,
        title: 'First Book',
        sourceText: sourceTextMetadata({
          bookId: 'book-1' as BreakdownBookId,
          sourceTextId: 'source-1' as SourceTextId,
          contentHash: 'sha256:duplicate',
        }),
        updatedAt: importedAt,
      });

      expect(() => importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-2' as BreakdownBookId,
        title: 'Second Book',
        sourceText: sourceTextMetadata({
          bookId: 'book-2' as BreakdownBookId,
          sourceTextId: 'source-2' as SourceTextId,
          contentHash: 'sha256:duplicate',
        }),
        updatedAt: importedAt,
      })).toThrow();
      expect(db.prepare('SELECT id FROM books ORDER BY id').pluck().all()).toEqual(['book-1']);
      expect(db.prepare('SELECT id, content_hash FROM source_texts ORDER BY id').all()).toEqual([
        {
          id: 'source-1',
          content_hash: 'sha256:duplicate',
        },
      ]);
    } finally {
      db.close();
    }
  });

  it('rolls back book and source_text when the completed import job cannot be inserted', () => {
    const db = migratedDatabase();

    try {
      db.prepare(`
        INSERT INTO jobs (
          id, book_id, kind, state, completed_units, total_units,
          payload_schema_version, payload_json, error_code, error_details_json, created_at, updated_at
        )
        VALUES (?, NULL, 'source_import', 'completed', 1, 1, 1, '{}', NULL, NULL, ?, ?)
      `).run('job-duplicate', importedAt, importedAt);

      expect(() => importBookWithSourceText(db, {
        libraryId,
        bookId: 'book-job-failure' as BreakdownBookId,
        title: 'Job Failure Book',
        sourceText: sourceTextMetadata({
          bookId: 'book-job-failure' as BreakdownBookId,
          sourceTextId: 'source-job-failure' as SourceTextId,
        }),
        job: {
          sourceTextId: 'source-job-failure' as SourceTextId,
          summary: {
            id: 'job-duplicate' as JobId,
            bookId: 'book-job-failure' as BreakdownBookId,
            state: 'completed',
            title: 'Import source',
            completedUnits: 1,
            totalUnits: 1,
            checkpointSummary: 'Source imported.',
            failureReason: null,
            updatedAt: importedAt,
          },
        },
        updatedAt: importedAt,
      })).toThrow();

      expect(db.prepare('SELECT id FROM books').all()).toEqual([]);
      expect(db.prepare('SELECT id FROM source_texts').all()).toEqual([]);
      expect(db.prepare('SELECT id FROM jobs ORDER BY id').pluck().all()).toEqual(['job-duplicate']);
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
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-import-transaction-'));
  tempDirs.push(tempDir);

  return path.join(tempDir, 'writestorm.sqlite');
}

function sourceTextMetadata(input: {
  readonly bookId: BreakdownBookId;
  readonly sourceTextId: SourceTextId;
  readonly contentHash?: string;
}) {
  return buildSourceTextImportMetadata({
    bookId: input.bookId,
    sourceTextId: input.sourceTextId,
    originalFileName: 'Example.md',
    format: 'md',
    sizeBytes: 120,
    encoding: 'utf-8',
    contentHash: input.contentHash ?? `sha256:${input.sourceTextId}`,
    relativePath: `source/${input.sourceTextId}/Example.md`,
    importedAt,
  });
}
