import type { SchemaSemanticBoundary } from '../schema-semantic-witness';

export const ANALYSIS_MODULE_INSTANCE_BASE_SETUP = `
  INSERT INTO books (id, title, current_source_text_id, structure_edition, created_at, updated_at)
    VALUES ('book', 'Book', NULL, 1, 'now', 'now');
  INSERT INTO source_texts VALUES
    ('source', 'book', 'source.txt', 100, 'txt', 'hash', 'utf8', 1, 'source/source.txt', 'now');
  UPDATE books SET current_source_text_id = 'source' WHERE id = 'book';
  INSERT INTO structure_sets (
    id, book_id, source_text_id, source_text_edition, source_content_hash,
    decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
    draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
  ) VALUES (
    'frozen', 'book', 'source', 1, 'hash', 100, 'utf16_code_unit', 'frozen',
    NULL, 'included', NULL, 1, 'now', 1, 'now', 'now', NULL
  );
  INSERT INTO analysis_modules VALUES
    ('plot_causality', 'plot_causality', 'Plot', 'analysis', 1, 0);
  INSERT INTO analysis_modules VALUES
    ('world_rules', 'world_rules', 'World', 'analysis', 1, 1);
`;

export const ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP = `${ANALYSIS_MODULE_INSTANCE_BASE_SETUP}
  INSERT INTO structure_nodes VALUES
    ('volume-1', 'frozen', NULL, 'volume', 'Volume 1', NULL, 0, 0, 40,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now');
  INSERT INTO structure_nodes VALUES
    ('volume-2', 'frozen', NULL, 'volume', 'Volume 2', NULL, 1, 40, 100,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now');
  INSERT INTO structure_nodes VALUES
    ('chapter-1', 'frozen', NULL, 'chapter', 'Chapter 1', 'volume-1', 0, 0, 20,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now');
  INSERT INTO structure_nodes VALUES
    ('chapter-2', 'frozen', NULL, 'chapter', 'Chapter 2', 'volume-2', 0, 40, 60,
      NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now');
  INSERT INTO story_segment_ranges (
    id, structure_set_id, origin_id, title, start_offset, end_offset,
    suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
    confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
  ) VALUES ('range-1', 'frozen', NULL, 'Range 1', 0, 20, '[]', '[]',
    'start', 'end', 1, 'high', NULL, 'now', 'now');
  INSERT INTO story_segment_ranges (
    id, structure_set_id, origin_id, title, start_offset, end_offset,
    suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
    confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
  ) VALUES ('range-2', 'frozen', NULL, 'Range 2', 40, 60, '[]', '[]',
    'start', 'end', 1, 'high', NULL, 'now', 'now');
`;

type ScopeValues = {
  readonly id?: string;
  readonly moduleId?: string;
  readonly scopeKind?: string;
  readonly bookScopeBookId?: string | null;
  readonly volumeNodeId?: string | null;
  readonly chapterNodeId?: string | null;
  readonly storySegmentRangeId?: string | null;
  readonly structureEdition?: number;
  readonly analysisRevision?: number;
  readonly status?: string;
};

function literal(value: string | null): string {
  return value === null ? 'NULL' : `'${value}'`;
}

export function instance(values: ScopeValues = {}): string {
  return `INSERT INTO analysis_module_instances (
    id, book_id, module_id, scope_kind, book_scope_book_id,
    volume_node_id, chapter_node_id, story_segment_range_id,
    source_structure_set_id, structure_edition, analysis_revision,
    status, created_at, updated_at
  ) VALUES (
    '${values.id ?? 'instance'}', 'book', '${values.moduleId ?? 'plot_causality'}',
    '${values.scopeKind ?? 'book'}', ${literal(values.bookScopeBookId === undefined ? 'book' : values.bookScopeBookId)},
    ${literal(values.volumeNodeId ?? null)}, ${literal(values.chapterNodeId ?? null)},
    ${literal(values.storySegmentRangeId ?? null)}, 'frozen', ${values.structureEdition ?? 1},
    ${values.analysisRevision ?? 0}, '${values.status ?? 'not_generated'}', 'now', 'now'
  )`;
}

function boundary(
  id: string,
  kind: SchemaSemanticBoundary['kind'],
  setupSql: string,
  acceptSql: string,
  rejectSql: string,
  code: SchemaSemanticBoundary['reject']['code'],
): SchemaSemanticBoundary {
  return {
    id: `004.analysis_module_instance.${id}`,
    migrationId: 4,
    kind,
    accept: { setupSql, sql: acceptSql },
    reject: { setupSql, sql: rejectSql, code },
  };
}

export const ANALYSIS_MODULE_INSTANCES_SEMANTIC_BOUNDARIES = [
  boundary('scope_identity', 'check', ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
    instance(), instance({ bookScopeBookId: null }), 'SQLITE_CONSTRAINT_CHECK'),
  boundary('structure_edition', 'check', ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
    instance(), instance({ structureEdition: 0 }), 'SQLITE_CONSTRAINT_CHECK'),
  boundary('analysis_revision', 'check', ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
    instance(), instance({ analysisRevision: -1 }), 'SQLITE_CONSTRAINT_CHECK'),
  boundary('status', 'check', ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
    instance(), instance({ status: 'running' }), 'SQLITE_CONSTRAINT_CHECK'),
  boundary('scope_integrity_insert', 'trigger', ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP,
    instance({ scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-1' }),
    instance({ scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'chapter-1' }),
    'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('scope_integrity_update', 'trigger',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-1' })}`,
    `UPDATE analysis_module_instances SET volume_node_id = 'volume-2' WHERE id = 'instance'`,
    `UPDATE analysis_module_instances SET volume_node_id = 'chapter-1' WHERE id = 'instance'`,
    'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('referenced_source_set_immutable', 'trigger',
    `${ANALYSIS_MODULE_INSTANCE_BASE_SETUP}; ${instance()}`,
    `UPDATE structure_sets SET structure_edition = 1 WHERE id = 'frozen'`,
    `UPDATE structure_sets SET structure_edition = 2 WHERE id = 'frozen'`,
    'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('referenced_node_identity_immutable', 'trigger',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-1' })}`,
    `UPDATE structure_nodes SET kind = 'volume' WHERE id = 'volume-1'`,
    `UPDATE structure_nodes SET kind = 'chapter' WHERE id = 'volume-1'`,
    'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('referenced_story_range_identity_immutable', 'trigger',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'story_segment_range', bookScopeBookId: null, storySegmentRangeId: 'range-1' })}`,
    `UPDATE story_segment_ranges SET structure_set_id = 'frozen' WHERE id = 'range-1'`,
    `UPDATE story_segment_ranges SET structure_set_id = NULL WHERE id = 'range-1'`,
    'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('unique_book_scope', 'partial-index',
    `${ANALYSIS_MODULE_INSTANCE_BASE_SETUP}; ${instance()}`,
    instance({ id: 'accepted', moduleId: 'world_rules' }),
    instance({ id: 'rejected' }), 'SQLITE_CONSTRAINT_UNIQUE'),
  boundary('unique_volume_scope', 'partial-index',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-1' })}`,
    instance({ id: 'accepted', scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-2' }),
    instance({ id: 'rejected', scopeKind: 'volume', bookScopeBookId: null, volumeNodeId: 'volume-1' }),
    'SQLITE_CONSTRAINT_UNIQUE'),
  boundary('unique_chapter_scope', 'partial-index',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'chapter', bookScopeBookId: null, chapterNodeId: 'chapter-1' })}`,
    instance({ id: 'accepted', scopeKind: 'chapter', bookScopeBookId: null, chapterNodeId: 'chapter-2' }),
    instance({ id: 'rejected', scopeKind: 'chapter', bookScopeBookId: null, chapterNodeId: 'chapter-1' }),
    'SQLITE_CONSTRAINT_UNIQUE'),
  boundary('unique_story_range_scope', 'partial-index',
    `${ANALYSIS_MODULE_INSTANCE_SCOPE_SETUP}; ${instance({ scopeKind: 'story_segment_range', bookScopeBookId: null, storySegmentRangeId: 'range-1' })}`,
    instance({ id: 'accepted', scopeKind: 'story_segment_range', bookScopeBookId: null, storySegmentRangeId: 'range-2' }),
    instance({ id: 'rejected', scopeKind: 'story_segment_range', bookScopeBookId: null, storySegmentRangeId: 'range-1' }),
    'SQLITE_CONSTRAINT_UNIQUE'),
] as const satisfies readonly SchemaSemanticBoundary[];
