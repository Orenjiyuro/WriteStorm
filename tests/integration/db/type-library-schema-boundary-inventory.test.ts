import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { bookClassificationTargetSchema } from '../../../src/shared/domain';

const inventory = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-SCHEMA-INVENTORY.md',
  'utf8',
);
const tempDirs: string[] = [];
const NOW = '2026-07-17T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('TypeLibrary schema boundary inventory', () => {
  it('enumerates every migration-owned semantic boundary', () => {
    const migration006 = APP_MIGRATIONS.find(({ id }) => id === 6);
    const migration007 = APP_MIGRATIONS.find(({ id }) => id === 7);
    expect(migration006?.semanticBoundaries?.map(({ id }) => id).sort()).toEqual([
      '006.type_library.archive_no_rewrite',
      '006.type_library.archive_no_unarchive',
      '006.type_library.archive_non_blank',
      '006.type_library.built_in_identity',
      '006.type_library.definition_identity_immutable',
      '006.type_library.definition_kind',
      '006.type_library.definition_no_delete',
      '006.type_library.definition_origin_key',
      '006.type_library.definition_version_copy',
      '006.type_library.definition_version_immutable',
      '006.type_library.definition_version_no_delete',
      '006.type_library.definition_version_positive',
      '006.type_library.entry_kind_matches_definition',
      '006.type_library.entry_sort_order',
      '006.type_library.entry_version_matches_definition',
      '006.type_library.release_entry_capacity',
      '006.type_library.release_entry_count',
      '006.type_library.release_entry_immutable',
      '006.type_library.release_entry_no_update',
      '006.type_library.release_immutable',
      '006.type_library.release_no_update',
      '006.type_library.release_positive',
    ]);
    expect(migration007?.semanticBoundaries?.map(({ id }) => id).sort()).toEqual([
      '007.type_library_binding.focus_kind',
      '007.type_library_binding.focus_priority',
      '007.type_library_binding.focus_release',
      '007.type_library_binding.initial_revision',
      '007.type_library_binding.main_kind',
      '007.type_library_binding.main_pair',
      '007.type_library_binding.no_direct_delete',
      '007.type_library_binding.parent_release_preserves_focuses',
      '007.type_library_binding.revision_increment',
    ]);
  });

  it('records all six table owners and the service-owned gaps', () => {
    for (const table of [
      'type_definitions',
      'type_definition_versions',
      'type_library_versions',
      'type_library_version_entries',
      'book_type_bindings',
      'book_content_focus_bindings',
    ]) {
      expect(inventory).toContain(`\`${table}\``);
    }
    expect(inventory).toContain('map no binding row to revision 0 without inserting data');
    expect(inventory).toContain('return `revision_conflict` on zero affected rows');
    expect(inventory).toContain('reject any gap as `invalid_persisted_book_type_binding`');
    expect(inventory).toContain('D060 adds source-import and renderer paths');
    expect(inventory).toContain('D061 certifies the natural Electron path');
    expect(inventory).toContain('The renderer still has no SQLite, filesystem, shell');
  });

  it('passes runtime schema validation and empty replay twice', () => {
    const database = migratedDatabase();
    try {
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
      runMigrations(database, APP_MIGRATIONS);
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
      expect(database.prepare(`
        SELECT entry_count FROM type_library_versions WHERE version = 1
      `).pluck().get()).toBe(14);
      expect(database.prepare(`
        SELECT COUNT(*) FROM type_library_version_entries WHERE type_library_version = 1
      `).pluck().get()).toBe(14);
    } finally {
      database.close();
    }
  });

  it('treats a persisted priority gap as corruption instead of renumbering', () => {
    const database = migratedDatabase();
    try {
      database.prepare(`
        INSERT INTO books (id, title, created_at, updated_at) VALUES ('gap-book', 'Gap', ?, ?)
      `).run(NOW, NOW);
      database.prepare(`
        INSERT INTO book_type_bindings VALUES ('gap-book', 1, NULL, NULL, 1, ?)
      `).run(NOW);
      database.prepare(`
        INSERT INTO book_content_focus_bindings VALUES (
          'gap-book', 2, 'builtin_focus_001', 'builtin_focus_001_v1'
        )
      `).run();

      const parent = database.prepare(`
        SELECT book_id AS bookId, type_library_version AS typeLibraryVersion,
          revision, updated_at AS updatedAt
        FROM book_type_bindings WHERE book_id = 'gap-book'
      `).get() as { bookId: string; typeLibraryVersion: number; revision: number; updatedAt: string };
      const contentFocuses = database.prepare(`
        SELECT priority, type_definition_id AS typeDefinitionId,
          type_definition_version_id AS typeDefinitionVersionId
        FROM book_content_focus_bindings WHERE book_id = 'gap-book' ORDER BY priority
      `).all();

      expect(bookClassificationTargetSchema.safeParse({
        ...parent,
        mainType: null,
        contentFocuses,
      }).success).toBe(false);
    } finally {
      database.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-type-library-inventory-'));
  tempDirs.push(tempDir);
  const database = openSqliteDatabase(path.join(tempDir, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}
