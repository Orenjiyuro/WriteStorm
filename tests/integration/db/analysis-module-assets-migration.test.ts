import { describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';

const MIGRATIONS_THROUGH_005 = APP_MIGRATIONS.slice(0, 5);

describe('analysis module asset placeholders migration 005', () => {
  it('forward-adds an empty body placeholder for existing instances', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, APP_MIGRATIONS.slice(0, 3));
      seedFrozenBook(database);
      runMigrations(database, APP_MIGRATIONS.slice(0, 4));
      expect(columnNames(database)).not.toContain('body_markdown');

      runMigrations(database, MIGRATIONS_THROUGH_005);

      expect(getCurrentSchemaVersion(database)).toBe(5);
      expect(columnNames(database)).toContain('body_markdown');
      expect(database.prepare(`
        SELECT DISTINCT body_markdown FROM analysis_module_instances
      `).pluck().all()).toEqual(['']);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_modules').pluck().get()).toBe(7);
      expect(database.prepare(`
        SELECT COUNT(*) FROM analysis_modules WHERE key = 'ai_constraint_summary'
      `).pluck().get()).toBe(0);
    } finally {
      database.close();
    }
  });

  it('defaults future shell bodies to empty text and rejects non-text storage', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, MIGRATIONS_THROUGH_005);
      seedUnfrozenBook(database);
      seedFrozenSet(database);
      database.prepare(`INSERT INTO analysis_module_instances (
        id, book_id, module_id, scope_kind, book_scope_book_id,
        volume_node_id, chapter_node_id, story_segment_range_id,
        source_structure_set_id, structure_edition, analysis_revision,
        status, created_at, updated_at
      ) VALUES ('instance', 'book', 'plot_causality', 'book', 'book',
        NULL, NULL, NULL, 'frozen', 1, 0, 'not_generated', 'now', 'now')`).run();

      expect(database.prepare(`SELECT body_markdown FROM analysis_module_instances
        WHERE id = 'instance'`).pluck().get()).toBe('');
      expect(() => database.prepare(`UPDATE analysis_module_instances
        SET body_markdown = CAST(X'00' AS BLOB) WHERE id = 'instance'`).run())
        .toThrow(/CHECK constraint failed/i);
    } finally {
      database.close();
    }
  });
});

function seedFrozenBook(database: ReturnType<typeof openSqliteDatabase>): void {
  seedUnfrozenBook(database);
  database.prepare("UPDATE books SET structure_edition = 1 WHERE id = 'book'").run();
  seedFrozenSet(database);
}

function seedUnfrozenBook(database: ReturnType<typeof openSqliteDatabase>): void {
  database.prepare(`INSERT INTO books
    (id, title, current_source_text_id, created_at, updated_at)
    VALUES ('book', 'Book', NULL, 'now', 'now')`).run();
  database.prepare(`INSERT INTO source_texts VALUES
    ('source', 'book', 'source.txt', 1, 'txt', 'hash', 'utf8', 1,
      'source/source.txt', 'now')`).run();
  database.prepare("UPDATE books SET current_source_text_id = 'source' WHERE id = 'book'").run();
}

function seedFrozenSet(database: ReturnType<typeof openSqliteDatabase>): void {
  database.prepare(`INSERT INTO structure_sets (
    id, book_id, source_text_id, source_text_edition, source_content_hash,
    decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
    draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
  ) VALUES ('frozen', 'book', 'source', 1, 'hash', 100, 'utf16_code_unit',
    'frozen', NULL, 'included', NULL, 1, 'now', 1, 'now', 'now', NULL)`).run();
}

function columnNames(database: ReturnType<typeof openSqliteDatabase>): string[] {
  return (database.prepare("PRAGMA table_xinfo('analysis_module_instances')").all() as Array<{ name: string }>)
    .map(({ name }) => name);
}
