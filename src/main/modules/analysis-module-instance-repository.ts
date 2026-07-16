import type { ModuleInstanceSummary } from '../../shared/contracts';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  ModuleInstanceStatus,
  StructureNodeId,
  StructureSetId,
  StorySegmentRangeId,
} from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type PersistedModuleWorkspacePrerequisites = {
  readonly book: {
    readonly id: BreakdownBookId;
    readonly structureEdition: number | null;
  } | null;
  readonly structure: {
    readonly bookId: BreakdownBookId;
    readonly frozenSetId: StructureSetId | null;
    readonly stage: 'missing' | 'frozen';
    readonly structureEdition: number | null;
  };
};

type PersistedModuleInstanceRow = {
  readonly id: AnalysisModuleInstanceId;
  readonly bookId: BreakdownBookId;
  readonly moduleId: AnalysisModuleId;
  readonly scopeKind: 'book' | 'volume' | 'chapter' | 'story_segment_range';
  readonly bookScopeBookId: BreakdownBookId | null;
  readonly volumeNodeId: StructureNodeId | null;
  readonly chapterNodeId: StructureNodeId | null;
  readonly storySegmentRangeId: StorySegmentRangeId | null;
  readonly status: ModuleInstanceStatus;
  readonly structureEdition: number;
  readonly analysisRevision: number;
  readonly updatedAt: string;
};

export class AnalysisModuleInstanceRepository {
  getPrerequisites(
    database: SqliteDatabase,
    bookId: BreakdownBookId,
  ): PersistedModuleWorkspacePrerequisites {
    const book = database.prepare(`
      SELECT id, structure_edition AS structureEdition
      FROM books WHERE id = ?
    `).get(bookId) as PersistedModuleWorkspacePrerequisites['book'] | undefined;
    const frozen = database.prepare(`
      SELECT id AS frozenSetId, book_id AS bookId,
        structure_edition AS structureEdition
      FROM structure_sets
      WHERE book_id = ? AND stage = 'frozen' AND is_current = 1
      LIMIT 1
    `).get(bookId) as {
      readonly frozenSetId: StructureSetId;
      readonly bookId: BreakdownBookId;
      readonly structureEdition: number;
    } | undefined;

    return {
      book: book ?? null,
      structure: frozen ? {
        bookId: frozen.bookId,
        frozenSetId: frozen.frozenSetId,
        stage: 'frozen',
        structureEdition: frozen.structureEdition,
      } : {
        bookId,
        frozenSetId: null,
        stage: 'missing',
        structureEdition: null,
      },
    };
  }

  listByBook(database: SqliteDatabase, bookId: BreakdownBookId): ModuleInstanceSummary[] {
    const rows = database.prepare(`
      SELECT instance.id AS id,
        instance.book_id AS bookId,
        instance.module_id AS moduleId,
        instance.scope_kind AS scopeKind,
        instance.book_scope_book_id AS bookScopeBookId,
        instance.volume_node_id AS volumeNodeId,
        instance.chapter_node_id AS chapterNodeId,
        instance.story_segment_range_id AS storySegmentRangeId,
        instance.status AS status,
        instance.structure_edition AS structureEdition,
        instance.analysis_revision AS analysisRevision,
        instance.updated_at AS updatedAt
      FROM analysis_module_instances instance
      INNER JOIN analysis_modules module ON module.id = instance.module_id
      WHERE instance.book_id = ?
      ORDER BY module.sort_order ASC,
        CASE instance.scope_kind
          WHEN 'book' THEN 0 WHEN 'volume' THEN 1
          WHEN 'chapter' THEN 2 ELSE 3
        END ASC,
        COALESCE(instance.volume_node_id, instance.chapter_node_id,
          instance.story_segment_range_id, instance.book_scope_book_id) ASC
    `).all(bookId) as PersistedModuleInstanceRow[];

    return rows.map((row) => ({
      id: row.id,
      bookId: row.bookId,
      moduleId: row.moduleId,
      scope: scopeFromRow(row),
      status: row.status,
      structureEdition: row.structureEdition,
      analysisRevision: row.analysisRevision,
      updatedAt: row.updatedAt,
    }));
  }
}

function scopeFromRow(row: PersistedModuleInstanceRow): ModuleInstanceSummary['scope'] {
  switch (row.scopeKind) {
    case 'book':
      return { kind: 'book', bookId: row.bookScopeBookId! };
    case 'volume':
      return { kind: 'volume', nodeId: row.volumeNodeId! };
    case 'chapter':
      return { kind: 'chapter', nodeId: row.chapterNodeId! };
    case 'story_segment_range':
      return { kind: 'story_segment_range', rangeId: row.storySegmentRangeId! };
  }
}
