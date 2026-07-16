import type {
  AnalysisModuleId,
  BreakdownBookId,
  StructureSetId,
} from '../../../shared/domain';
import {
  createAnalysisModuleInstanceId,
  type AnalysisModuleInstanceIdFactory,
} from '../../modules/analysis-module-instance-id';
import type { Migration } from '../migration-runner';
import { ANALYSIS_MODULE_DEFINITION_SEED_003 } from './003_analysis_module_definitions';
import {
  ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
  ANALYSIS_MODULE_INSTANCES_SEMANTIC_BOUNDARIES,
  instance,
} from './004_analysis_module_instances_boundaries';

export const MODULE_INSTANCE_STATUS_VOCABULARY_004 = [
  'not_generated',
  'generated_pending_review',
  'confirmed',
  'stale',
  'needs_rebuild',
] as const;

export type AnalysisModuleInstancesMigrationOptions = {
  readonly createInstanceId?: AnalysisModuleInstanceIdFactory;
  readonly now?: () => string;
};

type FrozenBookRow = {
  readonly bookId: BreakdownBookId;
  readonly sourceStructureSetId: StructureSetId;
  readonly structureEdition: number;
};

type PersistedModuleDefinitionRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly createsModuleInstance: number;
  readonly sortOrder: number;
};

export function createAnalysisModuleInstancesMigration(
  options: AnalysisModuleInstancesMigrationOptions = {},
): Migration {
  const createInstanceId = options.createInstanceId ?? createAnalysisModuleInstanceId;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    id: 4,
    name: 'analysis_module_instances',
    up(database) {
      assertAuthoritativeModuleSnapshot(database);
      database.exec(`
        CREATE TABLE analysis_module_instances (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          scope_kind TEXT NOT NULL,
          book_scope_book_id TEXT,
          volume_node_id TEXT,
          chapter_node_id TEXT,
          story_segment_range_id TEXT,
          source_structure_set_id TEXT NOT NULL,
          structure_edition INTEGER NOT NULL CHECK (structure_edition > 0),
          analysis_revision INTEGER NOT NULL DEFAULT 0 CHECK (analysis_revision >= 0),
          status TEXT NOT NULL CHECK (status IN (${MODULE_INSTANCE_STATUS_VOCABULARY_004.map((status) => `'${status}'`).join(', ')})),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (scope_kind = 'book' AND book_scope_book_id IS NOT NULL AND
              book_scope_book_id = book_id AND
              volume_node_id IS NULL AND chapter_node_id IS NULL AND story_segment_range_id IS NULL) OR
            (scope_kind = 'volume' AND book_scope_book_id IS NULL AND
              volume_node_id IS NOT NULL AND chapter_node_id IS NULL AND story_segment_range_id IS NULL) OR
            (scope_kind = 'chapter' AND book_scope_book_id IS NULL AND
              volume_node_id IS NULL AND chapter_node_id IS NOT NULL AND story_segment_range_id IS NULL) OR
            (scope_kind = 'story_segment_range' AND book_scope_book_id IS NULL AND
              volume_node_id IS NULL AND chapter_node_id IS NULL AND story_segment_range_id IS NOT NULL)
          ),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (module_id) REFERENCES analysis_modules(id) ON DELETE RESTRICT,
          FOREIGN KEY (book_scope_book_id) REFERENCES books(id) ON DELETE CASCADE,
          FOREIGN KEY (volume_node_id) REFERENCES structure_nodes(id) ON DELETE RESTRICT,
          FOREIGN KEY (chapter_node_id) REFERENCES structure_nodes(id) ON DELETE RESTRICT,
          FOREIGN KEY (story_segment_range_id) REFERENCES story_segment_ranges(id) ON DELETE RESTRICT,
          FOREIGN KEY (source_structure_set_id) REFERENCES structure_sets(id) ON DELETE RESTRICT
        );

        CREATE INDEX idx_analysis_module_instances_book_id
          ON analysis_module_instances(book_id);
        CREATE INDEX idx_analysis_module_instances_source_structure_set_id
          ON analysis_module_instances(source_structure_set_id);
        CREATE UNIQUE INDEX idx_analysis_module_instances_book_scope
          ON analysis_module_instances(book_id, module_id)
          WHERE scope_kind = 'book';
        CREATE UNIQUE INDEX idx_analysis_module_instances_volume_scope
          ON analysis_module_instances(book_id, module_id, volume_node_id)
          WHERE scope_kind = 'volume';
        CREATE UNIQUE INDEX idx_analysis_module_instances_chapter_scope
          ON analysis_module_instances(book_id, module_id, chapter_node_id)
          WHERE scope_kind = 'chapter';
        CREATE UNIQUE INDEX idx_analysis_module_instances_story_range_scope
          ON analysis_module_instances(book_id, module_id, story_segment_range_id)
          WHERE scope_kind = 'story_segment_range';

        CREATE TRIGGER trg_analysis_module_instances_scope_integrity_insert
        BEFORE INSERT ON analysis_module_instances
        FOR EACH ROW
        WHEN NEW.structure_edition > 0
          AND ${scopeShapeSql('NEW')}
          AND NOT ${scopeIntegritySql('NEW')}
        BEGIN
          SELECT RAISE(ABORT, 'analysis module instance scope integrity failed');
        END;

        CREATE TRIGGER trg_analysis_module_instances_scope_integrity_update
        BEFORE UPDATE OF
          book_id, scope_kind, book_scope_book_id, volume_node_id, chapter_node_id,
          story_segment_range_id, source_structure_set_id, structure_edition
        ON analysis_module_instances
        FOR EACH ROW
        WHEN NEW.structure_edition > 0
          AND ${scopeShapeSql('NEW')}
          AND NOT ${scopeIntegritySql('NEW')}
        BEGIN
          SELECT RAISE(ABORT, 'analysis module instance scope integrity failed');
        END;

        CREATE TRIGGER trg_analysis_module_instance_source_set_immutable
        BEFORE UPDATE OF book_id, stage, structure_edition ON structure_sets
        FOR EACH ROW
        WHEN EXISTS (
          SELECT 1 FROM analysis_module_instances instance
          WHERE instance.source_structure_set_id = OLD.id
        ) AND (
          NEW.book_id IS NOT OLD.book_id OR
          NEW.stage IS NOT OLD.stage OR
          NEW.structure_edition IS NOT OLD.structure_edition
        )
        BEGIN
          SELECT RAISE(ABORT, 'referenced structure snapshot is immutable');
        END;

        CREATE TRIGGER trg_analysis_module_instance_node_identity_immutable
        BEFORE UPDATE OF structure_set_id, kind ON structure_nodes
        FOR EACH ROW
        WHEN EXISTS (
          SELECT 1 FROM analysis_module_instances instance
          WHERE instance.volume_node_id = OLD.id OR instance.chapter_node_id = OLD.id
        ) AND (
          NEW.structure_set_id IS NOT OLD.structure_set_id OR
          NEW.kind IS NOT OLD.kind
        )
        BEGIN
          SELECT RAISE(ABORT, 'referenced structure node identity is immutable');
        END;

        CREATE TRIGGER trg_analysis_module_instance_story_range_identity_immutable
        BEFORE UPDATE OF structure_set_id ON story_segment_ranges
        FOR EACH ROW
        WHEN EXISTS (
          SELECT 1 FROM analysis_module_instances instance
          WHERE instance.story_segment_range_id = OLD.id
        ) AND NEW.structure_set_id IS NOT OLD.structure_set_id
        BEGIN
          SELECT RAISE(ABORT, 'referenced story range identity is immutable');
        END;
      `);

      backfillFrozenBooks(database, createInstanceId, now);
    },
    semanticWitnesses: [
      {
        id: '004.analysis_module_instance.module_foreign_key',
        migrationId: 4,
        setupSql: ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
        sql: instance({ moduleId: 'character_relations' }),
        expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_FOREIGNKEY' },
      },
      {
        id: '004.analysis_module_instance.source_edition_integrity',
        migrationId: 4,
        setupSql: ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
        sql: instance({ structureEdition: 2 }),
        expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_TRIGGER' },
      },
    ],
    semanticBoundaries: ANALYSIS_MODULE_INSTANCES_SEMANTIC_BOUNDARIES,
  };
}

export const ANALYSIS_MODULE_INSTANCES_MIGRATION = createAnalysisModuleInstancesMigration();

function assertAuthoritativeModuleSnapshot(
  database: Parameters<Migration['up']>[0],
): void {
  const rows = database.prepare(`
    SELECT id, key, name, category,
      creates_module_instance AS createsModuleInstance,
      sort_order AS sortOrder
    FROM analysis_modules
    ORDER BY sort_order ASC
  `).all() as PersistedModuleDefinitionRow[];
  const matches = rows.length === ANALYSIS_MODULE_DEFINITION_SEED_003.length &&
    rows.every((row, index) => {
      const expected = ANALYSIS_MODULE_DEFINITION_SEED_003[index];
      return row.id === expected.id &&
        row.key === expected.key &&
        row.name === expected.name &&
        row.category === expected.category &&
        row.createsModuleInstance === expected.createsModuleInstance &&
        row.sortOrder === expected.sortOrder;
    });
  if (!matches) {
    throw new Error('Cannot create analysis module instances: persisted module contract snapshot is not authoritative.');
  }
}

function scopeShapeSql(row: 'NEW'): string {
  return `(
    (${row}.scope_kind = 'book' AND ${row}.book_scope_book_id IS NOT NULL AND
      ${row}.book_scope_book_id = ${row}.book_id AND
      ${row}.volume_node_id IS NULL AND ${row}.chapter_node_id IS NULL AND
      ${row}.story_segment_range_id IS NULL) OR
    (${row}.scope_kind = 'volume' AND ${row}.book_scope_book_id IS NULL AND
      ${row}.volume_node_id IS NOT NULL AND ${row}.chapter_node_id IS NULL AND
      ${row}.story_segment_range_id IS NULL) OR
    (${row}.scope_kind = 'chapter' AND ${row}.book_scope_book_id IS NULL AND
      ${row}.volume_node_id IS NULL AND ${row}.chapter_node_id IS NOT NULL AND
      ${row}.story_segment_range_id IS NULL) OR
    (${row}.scope_kind = 'story_segment_range' AND ${row}.book_scope_book_id IS NULL AND
      ${row}.volume_node_id IS NULL AND ${row}.chapter_node_id IS NULL AND
      ${row}.story_segment_range_id IS NOT NULL)
  )`;
}

function scopeIntegritySql(row: 'NEW'): string {
  return `(
    EXISTS (
      SELECT 1 FROM structure_sets source_set
      WHERE source_set.id = ${row}.source_structure_set_id
        AND source_set.book_id = ${row}.book_id
        AND source_set.stage = 'frozen'
        AND source_set.structure_edition = ${row}.structure_edition
    ) AND (
      ${row}.scope_kind = 'book' OR
      (${row}.scope_kind = 'volume' AND EXISTS (
        SELECT 1 FROM structure_nodes node
        WHERE node.id = ${row}.volume_node_id
          AND node.structure_set_id = ${row}.source_structure_set_id
          AND node.kind = 'volume'
      )) OR
      (${row}.scope_kind = 'chapter' AND EXISTS (
        SELECT 1 FROM structure_nodes node
        WHERE node.id = ${row}.chapter_node_id
          AND node.structure_set_id = ${row}.source_structure_set_id
          AND node.kind = 'chapter'
      )) OR
      (${row}.scope_kind = 'story_segment_range' AND EXISTS (
        SELECT 1 FROM story_segment_ranges range_row
        WHERE range_row.id = ${row}.story_segment_range_id
          AND range_row.structure_set_id = ${row}.source_structure_set_id
      ))
    )
  )`;
}

function backfillFrozenBooks(
  database: Parameters<Migration['up']>[0],
  createInstanceId: AnalysisModuleInstanceIdFactory,
  now: () => string,
): void {
  const frozenBookCount = database.prepare(`
    SELECT COUNT(*) FROM books WHERE structure_edition IS NOT NULL
  `).pluck().get() as number;
  const frozenBooks = database.prepare(`
    SELECT
      books.id AS bookId,
      structure_sets.id AS sourceStructureSetId,
      books.structure_edition AS structureEdition
    FROM books
    JOIN structure_sets
      ON structure_sets.book_id = books.id
      AND structure_sets.stage = 'frozen'
      AND structure_sets.is_current = 1
      AND structure_sets.structure_edition = books.structure_edition
    WHERE books.structure_edition IS NOT NULL
    ORDER BY books.id ASC
  `).all() as FrozenBookRow[];
  if (frozenBooks.length !== frozenBookCount) {
    throw new Error('Cannot backfill analysis module instances: a Book current edition has no matching frozen structure set.');
  }

  const moduleIds = database.prepare(`
    SELECT id FROM analysis_modules ORDER BY sort_order ASC
  `).pluck().all() as AnalysisModuleId[];
  const insertInstance = database.prepare(`
    INSERT INTO analysis_module_instances (
      id, book_id, module_id, scope_kind, book_scope_book_id,
      volume_node_id, chapter_node_id, story_segment_range_id,
      source_structure_set_id, structure_edition, analysis_revision,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, 'book', ?, NULL, NULL, NULL, ?, ?, 0,
      'not_generated', ?, ?)
  `);
  for (const frozenBook of frozenBooks) {
    for (const moduleId of moduleIds) {
      const identity = {
        bookId: frozenBook.bookId,
        moduleId,
        scope: { kind: 'book' as const, bookId: frozenBook.bookId },
      };
      const timestamp = now();
      insertInstance.run(
        createInstanceId(identity),
        frozenBook.bookId,
        moduleId,
        frozenBook.bookId,
        frozenBook.sourceStructureSetId,
        frozenBook.structureEdition,
        timestamp,
        timestamp,
      );
    }
  }
}
