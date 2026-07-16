import { describe, expect, it } from 'vitest';
import {
  createAnalysisModuleInstancesMigration,
} from '../../../src/main/db/migrations/004_analysis_module_instances';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import type { AnalysisModuleInstanceNaturalIdentity } from '../../../src/main/modules/analysis-module-instance-id';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  type AnalysisModuleInstanceId,
} from '../../../src/shared/domain';

const V3_MIGRATIONS = APP_MIGRATIONS.slice(0, 3);

describe('analysis module instances migration 004', () => {
  it('backfills seven book-scope shells for an existing frozen Book with an injected ID factory', () => {
    const database = openSqliteDatabase(':memory:');
    const identities: AnalysisModuleInstanceNaturalIdentity[] = [];
    try {
      runMigrations(database, V3_MIGRATIONS);
      seedFrozenBook(database);
      const migration = createAnalysisModuleInstancesMigration({
        createInstanceId(identity) {
          identities.push(identity);
          return `instance-${identities.length}` as AnalysisModuleInstanceId;
        },
        now: () => '2026-07-15T00:00:00.000Z',
      });

      runMigrations(database, [...V3_MIGRATIONS, migration]);

      expect(getCurrentSchemaVersion(database)).toBe(4);
      expect(identities).toEqual(ANALYSIS_MODULE_DEFINITIONS.map((definition) => ({
        bookId: 'book-1',
        moduleId: definition.id,
        scope: { kind: 'book', bookId: 'book-1' },
      })));
      expect(database.prepare(`
        SELECT id, module_id AS moduleId, scope_kind AS scopeKind,
          book_scope_book_id AS bookScopeBookId,
          source_structure_set_id AS sourceStructureSetId,
          structure_edition AS structureEdition,
          analysis_revision AS analysisRevision, status
        FROM analysis_module_instances ORDER BY module_id
      `).all()).toEqual([...ANALYSIS_MODULE_DEFINITIONS]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((definition, index) => ({
          id: `instance-${ANALYSIS_MODULE_DEFINITIONS.indexOf(definition) + 1}`,
          moduleId: definition.id,
          scopeKind: 'book',
          bookScopeBookId: 'book-1',
          sourceStructureSetId: 'frozen-1',
          structureEdition: 1,
          analysisRevision: 0,
          status: 'not_generated',
        })));
      expect(database.prepare("PRAGMA table_xinfo('analysis_module_instances')").all())
        .not.toContainEqual(expect.objectContaining({ name: 'body_markdown' }));
    } finally {
      database.close();
    }
  });

  it('rejects an incomplete module snapshot, rolls back, and succeeds after repair', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, V3_MIGRATIONS);
      seedFrozenBook(database);
      const missing = ANALYSIS_MODULE_DEFINITIONS[2];
      database.prepare('DELETE FROM analysis_modules WHERE id = ?').run(missing.id);

      expect(() => runMigrations(database, APP_MIGRATIONS)).toThrow(/module contract snapshot/i);
      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(tableExists(database, 'analysis_module_instances')).toBe(false);

      insertModuleDefinition(database, missing, 2);
      runMigrations(database, APP_MIGRATIONS);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(7);
    } finally {
      database.close();
    }
  });

  it('rejects a semantically tampered module snapshot and rolls back migration 004', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, V3_MIGRATIONS);
      seedFrozenBook(database);
      database.prepare(`UPDATE analysis_modules SET name = 'Tampered' WHERE sort_order = 0`).run();

      expect(() => runMigrations(database, APP_MIGRATIONS)).toThrow(/module contract snapshot/i);
      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(tableExists(database, 'analysis_module_instances')).toBe(false);
    } finally {
      database.close();
    }
  });

  it('rolls back a failed backfill and retries atomically without duplicate shells', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, V3_MIGRATIONS);
      seedFrozenBook(database);
      let attempts = 0;
      const failingMigration = createAnalysisModuleInstancesMigration({
        createInstanceId() {
          attempts += 1;
          if (attempts === 4) throw new Error('synthetic id factory failure');
          return `failed-${attempts}` as AnalysisModuleInstanceId;
        },
      });

      expect(() => runMigrations(database, [...V3_MIGRATIONS, failingMigration]))
        .toThrow('synthetic id factory failure');
      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(tableExists(database, 'analysis_module_instances')).toBe(false);

      const successfulMigration = createAnalysisModuleInstancesMigration({
        createInstanceId: (_identity) => `retry-${++attempts}` as AnalysisModuleInstanceId,
      });
      runMigrations(database, [...V3_MIGRATIONS, successfulMigration]);

      expect(database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(7);
      expect(database.prepare(`
        SELECT COUNT(*) FROM (
          SELECT book_id, module_id, scope_kind, COUNT(*) AS count
          FROM analysis_module_instances GROUP BY book_id, module_id, scope_kind
          HAVING count > 1
        )
      `).pluck().get()).toBe(0);
    } finally {
      database.close();
    }
  });

  it('stores valid book, volume, chapter, and story-range identities without creating fake scoped shells', () => {
    withV4Database((database) => {
      seedScopeMembers(database);
      insertScopedInstance(database, 'volume-instance', 'plot_causality', 'volume', {
        volumeNodeId: 'volume-1',
      });
      insertScopedInstance(database, 'chapter-instance', 'narrative_pacing', 'chapter', {
        chapterNodeId: 'chapter-1',
      });
      insertScopedInstance(database, 'range-instance', 'world_rules', 'story_segment_range', {
        storySegmentRangeId: 'range-1',
      });

      expect(database.prepare(`
        SELECT scope_kind FROM analysis_module_instances
        WHERE id IN ('volume-instance', 'chapter-instance', 'range-instance')
        ORDER BY scope_kind
      `).pluck().all()).toEqual(['chapter', 'story_segment_range', 'volume']);
      expect(database.prepare(`
        SELECT COUNT(*) FROM analysis_module_instances WHERE scope_kind <> 'book'
      `).pluck().get()).toBe(3);
    });
  });

  it('rejects ambiguous, wrong-kind, cross-snapshot, and duplicate scope identities', () => {
    withV4Database((database) => {
      seedScopeMembers(database);
      expect(() => insertScopedInstance(database, 'ambiguous', 'plot_causality', 'chapter', {
        volumeNodeId: 'volume-1', chapterNodeId: 'chapter-1',
      })).toThrow(/CHECK constraint failed/i);
      expect(() => insertScopedInstance(database, 'wrong-kind', 'plot_causality', 'volume', {
        volumeNodeId: 'chapter-1',
      })).toThrow(/scope integrity/i);
      insertScopedInstance(database, 'volume-instance', 'plot_causality', 'volume', {
        volumeNodeId: 'volume-1',
      });
      expect(() => insertScopedInstance(database, 'volume-duplicate', 'plot_causality', 'volume', {
        volumeNodeId: 'volume-1',
      })).toThrow(/UNIQUE constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_module_instances SET structure_edition = 2
        WHERE id = 'volume-instance'
      `).run()).toThrow(/scope integrity/i);
    });
  });

  it('keeps an instance source edition unchanged when the Book current edition advances', () => {
    withV4Database((database) => {
      database.prepare("UPDATE structure_sets SET is_current = 0 WHERE id = 'frozen-1'").run();
      seedFrozenSet(database, { setId: 'frozen-2', edition: 2 });
      database.prepare("UPDATE books SET structure_edition = 2 WHERE id = 'book-1'").run();

      expect(database.prepare(`
        SELECT DISTINCT structure_edition FROM analysis_module_instances WHERE book_id = 'book-1'
      `).pluck().all()).toEqual([1]);
      expect(database.prepare("SELECT structure_edition FROM books WHERE id = 'book-1'").pluck().get())
        .toBe(2);
    });
  });

  it('rejects mutations that would invalidate an instance source-set identity', () => {
    withV4Database((database) => {
      expect(() => database.prepare(`
        UPDATE structure_sets SET structure_edition = 2 WHERE id = 'frozen-1'
      `).run()).toThrow(/referenced structure snapshot is immutable/i);
    });
  });

  it('rejects mutations that would invalidate referenced node and range identities', () => {
    withV4Database((database) => {
      seedScopeMembers(database);
      insertScopedInstance(database, 'volume-instance', 'plot_causality', 'volume', {
        volumeNodeId: 'volume-1',
      });
      insertScopedInstance(database, 'range-instance', 'world_rules', 'story_segment_range', {
        storySegmentRangeId: 'range-1',
      });

      expect(() => database.prepare(`
        UPDATE structure_nodes SET kind = 'chapter' WHERE id = 'volume-1'
      `).run()).toThrow(/referenced structure node identity is immutable/i);

      seedDraftSet(database, 'draft-2');
      expect(() => database.prepare(`
        UPDATE story_segment_ranges SET structure_set_id = 'draft-2' WHERE id = 'range-1'
      `).run()).toThrow(/referenced story range identity is immutable/i);
    });
  });
});

function withV4Database(assertions: (database: SqliteDatabase) => void): void {
  const database = openSqliteDatabase(':memory:');
  try {
    runMigrations(database, V3_MIGRATIONS);
    seedFrozenBook(database);
    runMigrations(database, APP_MIGRATIONS);
    assertions(database);
  } finally {
    database.close();
  }
}

function seedFrozenBook(database: SqliteDatabase): void {
  database.prepare(`INSERT INTO books
    (id, title, current_source_text_id, structure_edition, created_at, updated_at)
    VALUES ('book-1', 'Book', NULL, NULL, 'now', 'now')`).run();
  database.prepare(`INSERT INTO source_texts VALUES
    ('source-1', 'book-1', 'source.txt', 1, 'txt', 'hash-1', 'utf8', 1,
      'source/source-1/source.txt', 'now')`).run();
  database.prepare(`UPDATE books SET current_source_text_id = 'source-1', structure_edition = 1
    WHERE id = 'book-1'`).run();
  seedFrozenSet(database, { setId: 'frozen-1', edition: 1 });
}

function seedFrozenSet(
  database: SqliteDatabase,
  input: { readonly setId: string; readonly edition: number },
): void {
  database.prepare(`INSERT INTO structure_sets (
    id, book_id, source_text_id, source_text_edition, source_content_hash,
    decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
    draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
  ) VALUES (?, 'book-1', 'source-1', 1, 'hash-1', 100, 'utf16_code_unit', 'frozen',
    NULL, 'included', NULL, ?, 'now', 1, 'now', 'now', NULL)`).run(input.setId, input.edition);
}

function seedScopeMembers(database: SqliteDatabase): void {
  database.prepare(`INSERT INTO structure_nodes VALUES
    ('volume-1', 'frozen-1', NULL, 'volume', 'Volume', NULL, 0, 0, 100,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`).run();
  database.prepare(`INSERT INTO structure_nodes VALUES
    ('chapter-1', 'frozen-1', NULL, 'chapter', 'Chapter', 'volume-1', 0, 0, 100,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`).run();
  database.prepare(`INSERT INTO story_segment_ranges (
    id, structure_set_id, origin_id, title, start_offset, end_offset,
    suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
    confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
  ) VALUES ('range-1', 'frozen-1', NULL, 'Range', 0, 100, '[]', '[]',
    'start', 'end', 1, 'high', NULL, 'now', 'now')`).run();
}

function seedDraftSet(database: SqliteDatabase, setId: string): void {
  database.prepare(`INSERT INTO structure_sets (
    id, book_id, source_text_id, source_text_edition, source_content_hash,
    decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
    draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
  ) VALUES (?, 'book-1', 'source-1', 1, 'hash-1', 100, 'utf16_code_unit', 'draft',
    NULL, 'included', 1, NULL, NULL, 1, 'now', 'now', NULL)`).run(setId);
}

function insertModuleDefinition(
  database: SqliteDatabase,
  definition: (typeof ANALYSIS_MODULE_DEFINITIONS)[number],
  sortOrder: number,
): void {
  database.prepare(`INSERT INTO analysis_modules
    (id, key, name, category, creates_module_instance, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    definition.id,
    definition.key,
    definition.name,
    definition.category,
    definition.createsModuleInstance ? 1 : 0,
    sortOrder,
  );
}

function insertScopedInstance(
  database: SqliteDatabase,
  id: string,
  moduleId: string,
  scopeKind: string,
  refs: {
    readonly volumeNodeId?: string;
    readonly chapterNodeId?: string;
    readonly storySegmentRangeId?: string;
  },
): void {
  database.prepare(`INSERT INTO analysis_module_instances (
    id, book_id, module_id, scope_kind, book_scope_book_id,
    volume_node_id, chapter_node_id, story_segment_range_id,
    source_structure_set_id, structure_edition, analysis_revision,
    status, created_at, updated_at
  ) VALUES (?, 'book-1', ?, ?, NULL, ?, ?, ?, 'frozen-1', 1, 0,
    'not_generated', 'now', 'now')`).run(
    id,
    moduleId,
    scopeKind,
    refs.volumeNodeId ?? null,
    refs.chapterNodeId ?? null,
    refs.storySegmentRangeId ?? null,
  );
}

function tableExists(database: SqliteDatabase, table: string): boolean {
  return database.prepare(`
    SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = ?
  `).pluck().get(table) === 1;
}
