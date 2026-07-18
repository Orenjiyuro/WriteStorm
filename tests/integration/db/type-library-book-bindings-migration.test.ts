import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';

const tempDirs: string[] = [];
const NOW = '2026-07-17T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('TypeLibrary Book binding migration', () => {
  it('registers migration 007 and leaves existing Books unassigned', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'book-1');
      expect(APP_MIGRATIONS.at(-1)).toMatchObject({ id: 7, name: 'type_library_book_bindings' });
      expect(getCurrentSchemaVersion(database)).toBe(7);
      expect(database.prepare('SELECT COUNT(*) FROM book_type_bindings').pluck().get()).toBe(0);
      expect(database.prepare('SELECT COUNT(*) FROM book_content_focus_bindings').pluck().get()).toBe(0);
    } finally {
      database.close();
    }
  });

  it('creates revision 1 and requires every later mutation to increment exactly once', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'book-1');
      expect(() => insertBinding(database, { bookId: 'book-1', revision: 0 })).toThrow();
      insertBinding(database, { bookId: 'book-1', revision: 1 });
      expect(() => database.prepare(`
        UPDATE book_type_bindings SET revision = 1, updated_at = ? WHERE book_id = 'book-1'
      `).run(NOW)).toThrow();
      expect(() => database.prepare(`
        UPDATE book_type_bindings SET revision = 3, updated_at = ? WHERE book_id = 'book-1'
      `).run(NOW)).toThrow();
      expect(() => database.prepare(`
        UPDATE book_type_bindings SET revision = 2, updated_at = ? WHERE book_id = 'book-1'
      `).run(NOW)).not.toThrow();
      expect(database.prepare(`
        SELECT revision, main_type_definition_id AS mainTypeDefinitionId
        FROM book_type_bindings WHERE book_id = 'book-1'
      `).get()).toEqual({ revision: 2, mainTypeDefinitionId: null });
    } finally {
      database.close();
    }
  });

  it('accepts only matching MainType versions from the pinned release', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'valid');
      insertBinding(database, {
        bookId: 'valid',
        mainTypeDefinitionId: 'builtin_main_001',
        mainTypeDefinitionVersionId: 'builtin_main_001_v1',
      });

      insertBook(database, 'partial');
      expect(() => insertBinding(database, {
        bookId: 'partial',
        mainTypeDefinitionId: 'builtin_main_001',
      })).toThrow();

      insertBook(database, 'wrong-kind');
      expect(() => insertBinding(database, {
        bookId: 'wrong-kind',
        mainTypeDefinitionId: 'builtin_focus_001',
        mainTypeDefinitionVersionId: 'builtin_focus_001_v1',
      })).toThrow();

      insertReleaseTwoOnlyDefinition(database);
      insertBook(database, 'wrong-release');
      expect(() => insertBinding(database, {
        bookId: 'wrong-release',
        mainTypeDefinitionId: 'user-main',
        mainTypeDefinitionVersionId: 'user-main-v1',
      })).toThrow();
    } finally {
      database.close();
    }
  });

  it('owns zero to three unique ordered ContentFocus versions under the parent release', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'book-1');
      insertBinding(database, { bookId: 'book-1' });
      insertFocus(database, {
        bookId: 'book-1',
        priority: 1,
        definitionId: 'builtin_focus_001',
        definitionVersionId: 'builtin_focus_001_v1',
      });
      expect(() => insertFocus(database, {
        bookId: 'book-1',
        priority: 0,
        definitionId: 'builtin_focus_002',
        definitionVersionId: 'builtin_focus_002_v1',
      })).toThrow();
      expect(() => insertFocus(database, {
        bookId: 'book-1',
        priority: 2,
        definitionId: 'builtin_focus_001',
        definitionVersionId: 'builtin_focus_001_v1',
      })).toThrow();
      expect(() => insertFocus(database, {
        bookId: 'book-1',
        priority: 2,
        definitionId: 'builtin_main_001',
        definitionVersionId: 'builtin_main_001_v1',
      })).toThrow();
      expect(database.prepare(`
        SELECT priority, type_definition_id AS typeDefinitionId
        FROM book_content_focus_bindings WHERE book_id = 'book-1' ORDER BY priority
      `).all()).toEqual([{ priority: 1, typeDefinitionId: 'builtin_focus_001' }]);
    } finally {
      database.close();
    }
  });

  it('rejects parent release changes that invalidate existing focuses', () => {
    const database = migratedDatabase();
    try {
      insertReleaseTwoOnlyDefinition(database);
      insertBook(database, 'book-1');
      insertBinding(database, { bookId: 'book-1' });
      insertFocus(database, {
        bookId: 'book-1',
        priority: 1,
        definitionId: 'builtin_focus_001',
        definitionVersionId: 'builtin_focus_001_v1',
      });
      expect(() => database.prepare(`
        UPDATE book_type_bindings
        SET type_library_version = 2, revision = 2, updated_at = ?
        WHERE book_id = 'book-1'
      `).run(NOW)).toThrow();
    } finally {
      database.close();
    }
  });

  it('cascades Book-owned bindings without deleting reference facts', () => {
    const database = migratedDatabase();
    try {
      insertBook(database, 'book-1');
      insertBinding(database, { bookId: 'book-1' });
      insertFocus(database, {
        bookId: 'book-1',
        priority: 1,
        definitionId: 'builtin_focus_001',
        definitionVersionId: 'builtin_focus_001_v1',
      });
      expect(() => database.prepare(`
        DELETE FROM book_type_bindings WHERE book_id = 'book-1'
      `).run()).toThrow();
      database.prepare("DELETE FROM books WHERE id = 'book-1'").run();
      expect(database.prepare('SELECT COUNT(*) FROM book_type_bindings').pluck().get()).toBe(0);
      expect(database.prepare('SELECT COUNT(*) FROM book_content_focus_bindings').pluck().get()).toBe(0);
      expect(database.prepare('SELECT COUNT(*) FROM type_definitions').pluck().get()).toBe(14);
    } finally {
      database.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-type-library-binding-'));
  tempDirs.push(tempDir);
  const database = openSqliteDatabase(path.join(tempDir, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}

function insertBook(database: SqliteDatabase, id: string): void {
  database.prepare('INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, id, NOW, NOW);
}

function insertBinding(database: SqliteDatabase, input: {
  bookId: string;
  revision?: number;
  mainTypeDefinitionId?: string | null;
  mainTypeDefinitionVersionId?: string | null;
}): void {
  database.prepare(`
    INSERT INTO book_type_bindings (
      book_id, type_library_version, main_type_definition_id,
      main_type_definition_version_id, revision, updated_at
    ) VALUES (?, 1, ?, ?, ?, ?)
  `).run(
    input.bookId,
    input.mainTypeDefinitionId ?? null,
    input.mainTypeDefinitionVersionId ?? null,
    input.revision ?? 1,
    NOW,
  );
}

function insertFocus(database: SqliteDatabase, input: {
  bookId: string;
  priority: number;
  definitionId: string;
  definitionVersionId: string;
}): void {
  database.prepare(`
    INSERT INTO book_content_focus_bindings (
      book_id, priority, type_definition_id, type_definition_version_id
    ) VALUES (?, ?, ?, ?)
  `).run(input.bookId, input.priority, input.definitionId, input.definitionVersionId);
}

function insertReleaseTwoOnlyDefinition(database: SqliteDatabase): void {
  database.prepare(`
    INSERT INTO type_definitions (id, kind, origin, stable_key)
    VALUES ('user-main', 'main_type', 'user_defined', NULL)
  `).run();
  database.prepare(`
    INSERT INTO type_definition_versions (
      id, type_definition_id, version, display_name, selection_description, created_at
    ) VALUES ('user-main-v1', 'user-main', 1, 'User main', 'User main', ?)
  `).run(NOW);
  database.prepare(`
    INSERT INTO type_library_versions (version, entry_count, created_at) VALUES (2, 1, ?)
  `).run(NOW);
  database.prepare(`
    INSERT INTO type_library_version_entries (
      type_library_version, type_definition_id, type_definition_version_id, kind, sort_order
    ) VALUES (2, 'user-main', 'user-main-v1', 'main_type', 0)
  `).run();
}
