import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  TypeLibraryRepository,
  TypeLibraryRepositoryError,
} from '../../../src/main/type-library/type-library-repository';
import type { BreakdownBookId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const NOW = '2026-07-17T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('TypeLibraryRepository read mapping', () => {
  it('lists the exact latest release in MainType then ContentFocus order', () => {
    const database = migratedDatabase();
    try {
      const release = new TypeLibraryRepository().listReleaseOptions(database);
      expect(release.version).toBe(1);
      expect(release.options).toHaveLength(14);
      expect(release.options.slice(0, 7).map(({ kind, displayName, sortOrder }) => ({
        kind,
        displayName,
        sortOrder,
      }))).toEqual([
        { kind: 'main_type', displayName: '日轻校园', sortOrder: 0 },
        { kind: 'main_type', displayName: '日轻异界', sortOrder: 1 },
        { kind: 'main_type', displayName: '现代都市', sortOrder: 2 },
        { kind: 'main_type', displayName: '现代幻想', sortOrder: 3 },
        { kind: 'main_type', displayName: '古代幻想', sortOrder: 4 },
        { kind: 'main_type', displayName: '西式幻想', sortOrder: 5 },
        { kind: 'main_type', displayName: '诸天无限', sortOrder: 6 },
      ]);
      expect(release.options.slice(7).every(({ kind }) => kind === 'content_focus')).toBe(true);
    } finally {
      database.close();
    }
  });

  it('returns null for a missing Book and revision 0 for an unassigned existing Book without writing', () => {
    const database = migratedDatabase();
    try {
      const repository = new TypeLibraryRepository();
      expect(repository.getBookBinding(database, 'missing' as BreakdownBookId)).toBeNull();
      insertBook(database, 'book-1');
      const before = database.prepare('SELECT COUNT(*) FROM book_type_bindings').pluck().get();
      expect(repository.getBookBinding(database, 'book-1' as BreakdownBookId)).toEqual({
        bookId: 'book-1',
        typeLibraryVersion: 1,
        revision: 0,
        mainType: null,
        contentFocuses: [],
        updatedAt: null,
      });
      expect(database.prepare('SELECT COUNT(*) FROM book_type_bindings').pluck().get()).toBe(before);
    } finally {
      database.close();
    }
  });

  it('maps a persisted MainType and ordered ContentFocus aggregate', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'book-1');
      database.prepare(`
        INSERT INTO book_type_bindings VALUES (
          'book-1', 1, 'builtin_main_001', 'builtin_main_001_v1', 1, ?
        )
      `).run(NOW);
      database.prepare(`
        INSERT INTO book_content_focus_bindings VALUES
          ('book-1', 1, 'builtin_focus_002', 'builtin_focus_002_v1'),
          ('book-1', 2, 'builtin_focus_001', 'builtin_focus_001_v1')
      `).run();

      expect(new TypeLibraryRepository().getBookBinding(
        database,
        'book-1' as BreakdownBookId,
      )).toEqual({
        bookId: 'book-1',
        typeLibraryVersion: 1,
        revision: 1,
        mainType: {
          typeDefinitionId: 'builtin_main_001',
          typeDefinitionVersionId: 'builtin_main_001_v1',
        },
        contentFocuses: [
          {
            priority: 1,
            typeDefinitionId: 'builtin_focus_002',
            typeDefinitionVersionId: 'builtin_focus_002_v1',
          },
          {
            priority: 2,
            typeDefinitionId: 'builtin_focus_001',
            typeDefinitionVersionId: 'builtin_focus_001_v1',
          },
        ],
        updatedAt: NOW,
      });
    } finally {
      database.close();
    }
  });

  it('excludes archived definitions from selectors while preserving pinned Book reads', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'archived-book');
      database.prepare(`
        INSERT INTO book_type_bindings VALUES (
          'archived-book', 1, 'builtin_main_001', 'builtin_main_001_v1', 1, ?
        )
      `).run(NOW);
      database.prepare(`
        UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z'
        WHERE id = 'builtin_main_001'
      `).run();

      const repository = new TypeLibraryRepository();
      const release = repository.listReleaseOptions(database, 1);
      expect(release.options).toHaveLength(13);
      expect(release.options.some(({ typeDefinitionId }) =>
        typeDefinitionId === 'builtin_main_001')).toBe(false);
      expect(release.options.filter(({ kind }) => kind === 'main_type')
        .map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(repository.getBookBinding(
        database,
        'archived-book' as BreakdownBookId,
      )?.mainType).toEqual({
        typeDefinitionId: 'builtin_main_001',
        typeDefinitionVersionId: 'builtin_main_001_v1',
      });
      expect(repository.getBookBindingDetail(
        database,
        'archived-book' as BreakdownBookId,
      )).toMatchObject({
        binding: {
          mainType: {
            typeDefinitionId: 'builtin_main_001',
            typeDefinitionVersionId: 'builtin_main_001_v1',
          },
        },
        pinnedOptions: [{
          typeDefinitionId: 'builtin_main_001',
          typeDefinitionVersionId: 'builtin_main_001_v1',
          kind: 'main_type',
          displayName: '日轻校园',
          availability: 'archived',
        }],
      });

      database.prepare(`
        UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z'
        WHERE archived_at IS NULL
      `).run();
      expect(repository.listReleaseOptions(database, 1)).toEqual({ version: 1, options: [] });
      expect(repository.getBookBinding(
        database,
        'archived-book' as BreakdownBookId,
      )?.mainType?.typeDefinitionId).toBe('builtin_main_001');
    } finally {
      database.close();
    }
  });

  it('fails closed on a persisted priority gap or malformed aggregate field', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'gap-book');
      database.prepare(`
        INSERT INTO book_type_bindings VALUES ('gap-book', 1, NULL, NULL, 1, ?)
      `).run(NOW);
      database.prepare(`
        INSERT INTO book_content_focus_bindings VALUES (
          'gap-book', 2, 'builtin_focus_001', 'builtin_focus_001_v1'
        )
      `).run();
      expectRepositoryError(
        () => new TypeLibraryRepository().getBookBinding(database, 'gap-book' as BreakdownBookId),
        'invalid_persisted_book_type_binding',
      );

      database.prepare(`
        DELETE FROM books WHERE id = 'gap-book'
      `).run();
      insertBook(database, 'bad-time');
      database.prepare(`
        INSERT INTO book_type_bindings VALUES ('bad-time', 1, NULL, NULL, 1, 'not-a-time')
      `).run();
      expectRepositoryError(
        () => new TypeLibraryRepository().getBookBinding(database, 'bad-time' as BreakdownBookId),
        'invalid_persisted_book_type_binding',
      );
    } finally {
      database.close();
    }
  });

  it('rejects missing or incomplete release versions as unavailable', () => {
    const database = migratedDatabase();
    try {
      const repository = new TypeLibraryRepository();
      expectRepositoryError(() => repository.listReleaseOptions(database, 99), 'type_library_version_unavailable');

      database.prepare(`
        INSERT INTO type_definitions VALUES ('user-main', 'main_type', 'user_defined', NULL, NULL)
      `).run();
      database.prepare(`
        INSERT INTO type_definition_versions VALUES (
          'user-main-v1', 'user-main', 1, 'User main', 'User main', ?
        )
      `).run(NOW);
      database.prepare(`
        INSERT INTO type_library_versions VALUES (2, 2, ?)
      `).run(NOW);
      database.prepare(`
        INSERT INTO type_library_version_entries VALUES (
          2, 'user-main', 'user-main-v1', 'main_type', 0
        )
      `).run();

      expectRepositoryError(() => repository.listReleaseOptions(database, 2), 'type_library_version_unavailable');
    } finally {
      database.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-type-library-repository-'));
  tempDirs.push(tempDir);
  const database = openSqliteDatabase(path.join(tempDir, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}

function insertBook(database: SqliteDatabase, bookId: string): void {
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(bookId, bookId, NOW, NOW);
}

function expectRepositoryError(
  operation: () => unknown,
  reason: TypeLibraryRepositoryError['reason'],
): void {
  expect(operation).toThrowError(expect.objectContaining({
    name: 'TypeLibraryRepositoryError',
    reason,
  }));
}
