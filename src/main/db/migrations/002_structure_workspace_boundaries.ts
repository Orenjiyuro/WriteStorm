import type { SchemaSemanticBoundary, SqliteConstraintCode } from '../schema-semantic-witness';

const BASE = `
  INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now');
  INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 1, 'txt', 'hash', 'utf8', 1, 'source.txt', 'now');
  INSERT INTO jobs VALUES ('job', 'book', 'structure_detection', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')
`;
const DRAFT = `INSERT INTO structure_sets VALUES ('set', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 1, NULL, NULL, 1, 'now', 'now')`;
const FROZEN = `INSERT INTO structure_sets VALUES ('set', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'frozen', NULL, 'included', NULL, 1, 'now', 1, 'now', 'now')`;

function boundary(
  id: string,
  kind: SchemaSemanticBoundary['kind'],
  acceptSql: string,
  rejectSql: string,
  setupSql: string,
  code: SqliteConstraintCode = 'SQLITE_CONSTRAINT_CHECK',
): SchemaSemanticBoundary {
  return {
    id: `002.${id}`, migrationId: 2, kind,
    accept: { setupSql, sql: acceptSql },
    reject: { setupSql, sql: rejectSql, code },
  };
}

function separateBoundary(
  id: string,
  kind: SchemaSemanticBoundary['kind'],
  accept: SchemaSemanticBoundary['accept'],
  reject: SchemaSemanticBoundary['reject'],
): SchemaSemanticBoundary {
  return { id: `002.${id}`, migrationId: 2, kind, accept, reject };
}

function detection(values: {
  edition?: number; hash?: string; length?: number; unit?: string; state?: string; reason?: string;
}): string {
  return `INSERT INTO structure_detection_runs VALUES ('run', 'job', 'book', 'source', ${values.edition ?? 1}, '${values.hash ?? 'hash'}', ${values.length ?? 1}, '${values.unit ?? 'utf16_code_unit'}', '${values.state ?? 'queued'}', ${values.reason ?? 'NULL'}, 'now', 'now')`;
}

function structureSet(values: {
  edition?: number; hash?: string; length?: number; unit?: string; stage?: string;
  storyMode?: string; draftRevision?: string; structureEdition?: string; frozenAt?: string; current?: number;
}): string {
  return `INSERT INTO structure_sets VALUES ('set', 'book', 'source', ${values.edition ?? 1}, '${values.hash ?? 'hash'}', ${values.length ?? 20}, '${values.unit ?? 'utf16_code_unit'}', '${values.stage ?? 'draft'}', NULL, '${values.storyMode ?? 'included'}', ${values.draftRevision ?? '1'}, ${values.structureEdition ?? 'NULL'}, ${values.frozenAt ?? 'NULL'}, ${values.current ?? 1}, 'now', 'now')`;
}

function node(values: {
  kind?: string; title?: string; sort?: number; start?: number; end?: number; raw?: string;
  headingStart?: string; headingEnd?: string; score?: number; level?: string; resolution?: string;
}): string {
  return `INSERT INTO structure_nodes VALUES ('node', 'set', NULL, '${values.kind ?? 'chapter'}', '${values.title ?? 'Chapter'}', NULL, ${values.sort ?? 0}, ${values.start ?? 0}, ${values.end ?? 10}, ${values.raw ?? 'NULL'}, ${values.headingStart ?? 'NULL'}, ${values.headingEnd ?? 'NULL'}, ${values.score ?? 1}, '${values.level ?? 'high'}', ${values.resolution ?? 'NULL'}, 'now', 'now')`;
}

function range(values: {
  title?: string; start?: number; end?: number; startReason?: string; endReason?: string;
  score?: number; level?: string; resolution?: string;
}): string {
  return `INSERT INTO story_segment_ranges (id, structure_set_id, title, start_offset, end_offset, start_reason, end_reason, confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at) VALUES ('range', 'set', '${values.title ?? 'Range'}', ${values.start ?? 0}, ${values.end ?? 10}, '${values.startReason ?? 'start'}', '${values.endReason ?? 'end'}', ${values.score ?? 1}, '${values.level ?? 'high'}', ${values.resolution ?? 'NULL'}, 'now', 'now')`;
}

const validDetection = detection({});
const validSet = structureSet({});
const validNode = node({});
const validRange = range({});

export const STRUCTURE_WORKSPACE_SEMANTIC_BOUNDARIES = [
  boundary('detection.source_text_edition', 'check', validDetection, detection({ edition: 0 }), BASE),
  boundary('detection.source_content_hash', 'check', validDetection, detection({ hash: ' ' }), BASE),
  boundary('detection.decoded_text_length', 'check', validDetection, detection({ length: -1 }), BASE),
  boundary('detection.offset_unit', 'check', validDetection, detection({ unit: 'bytes' }), BASE),
  boundary('detection.state', 'check', validDetection, detection({ state: 'paused' }), BASE),
  boundary('detection.state_failure_reason', 'check',
    detection({ state: 'failed', reason: `'failed'` }), detection({ state: 'failed' }), BASE),

  boundary('structure_set.source_text_edition', 'check', validSet, structureSet({ edition: 0 }), BASE),
  boundary('structure_set.source_content_hash', 'check', validSet, structureSet({ hash: ' ' }), BASE),
  boundary('structure_set.decoded_text_length', 'check', validSet, structureSet({ length: -1 }), BASE),
  boundary('structure_set.offset_unit', 'check', validSet, structureSet({ unit: 'bytes' }), BASE),
  boundary('structure_set.stage', 'check', validSet, structureSet({ stage: 'editing' }), BASE),
  boundary('structure_set.story_range_mode', 'check', validSet, structureSet({ storyMode: 'unknown' }), BASE),
  boundary('structure_set.is_current', 'check', validSet, structureSet({ current: 2 }), BASE),
  boundary('structure_set.stage_shape', 'check', validSet, structureSet({ draftRevision: 'NULL' }), BASE),

  boundary('node.kind', 'check', validNode, node({ kind: 'scene' }), `${BASE}; ${DRAFT}`),
  boundary('node.title', 'check', validNode, node({ title: ' ' }), `${BASE}; ${DRAFT}`),
  boundary('node.sort_order', 'check', validNode, node({ sort: -1 }), `${BASE}; ${DRAFT}`),
  boundary('node.start_offset', 'check', validNode, node({ start: -1 }), `${BASE}; ${DRAFT}`),
  boundary('node.end_offset', 'check', validNode, node({ start: 10, end: 10 }), `${BASE}; ${DRAFT}`),
  boundary('node.confidence_score', 'check', validNode, node({ score: 2 }), `${BASE}; ${DRAFT}`),
  boundary('node.confidence_level', 'check', validNode, node({ level: 'unknown' }), `${BASE}; ${DRAFT}`),
  boundary('node.heading_tuple', 'check',
    node({ raw: `'Heading'`, headingStart: '0', headingEnd: '7' }),
    node({ raw: `'Heading'` }), `${BASE}; ${DRAFT}`),
  boundary('node.low_confidence_resolution', 'check',
    node({ score: 0.5, level: 'low', resolution: `'unresolved'` }),
    node({ score: 0.5, level: 'low' }), `${BASE}; ${DRAFT}`),

  boundary('range.title', 'check', validRange, range({ title: ' ' }), `${BASE}; ${DRAFT}`),
  boundary('range.start_offset', 'check', validRange, range({ start: -1 }), `${BASE}; ${DRAFT}`),
  boundary('range.end_offset', 'check', validRange, range({ start: 10, end: 10 }), `${BASE}; ${DRAFT}`),
  boundary('range.start_reason', 'check', validRange, range({ startReason: ' ' }), `${BASE}; ${DRAFT}`),
  boundary('range.end_reason', 'check', validRange, range({ endReason: ' ' }), `${BASE}; ${DRAFT}`),
  boundary('range.confidence_score', 'check', validRange, range({ score: 2 }), `${BASE}; ${DRAFT}`),
  boundary('range.confidence_level', 'check', validRange, range({ level: 'unknown' }), `${BASE}; ${DRAFT}`),
  boundary('range.low_confidence_resolution', 'check',
    range({ score: 0.5, level: 'low', resolution: `'accepted'` }),
    range({ score: 0.5, level: 'low' }), `${BASE}; ${DRAFT}`),
  boundary('range_chapter.sort_order', 'check',
    `INSERT INTO story_segment_range_chapters VALUES ('range', 'chapter', 0)`,
    `INSERT INTO story_segment_range_chapters VALUES ('range', 'chapter', -1)`,
    `${BASE}; ${DRAFT}; ${node({}) .replace("'node'", "'chapter'")}; ${validRange}`),

  boundary('trigger.node_parent_same_set_insert', 'trigger',
    `INSERT INTO structure_nodes VALUES ('child', 'set', NULL, 'chapter', 'Child', 'parent-local', 1, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`,
    `INSERT INTO structure_nodes VALUES ('child', 'set', NULL, 'chapter', 'Child', 'parent-other', 1, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`,
    `${BASE}; ${DRAFT}; INSERT INTO structure_sets VALUES ('other', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 2, NULL, NULL, 0, 'now', 'now'); INSERT INTO structure_nodes VALUES ('parent-local', 'set', NULL, 'chapter', 'Local', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now'); INSERT INTO structure_nodes VALUES ('parent-other', 'other', NULL, 'chapter', 'Other', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`, 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.node_parent_same_set_update', 'trigger',
    `UPDATE structure_nodes SET parent_id = 'parent-local' WHERE id = 'child'`,
    `UPDATE structure_nodes SET parent_id = 'parent-other' WHERE id = 'child'`,
    `${BASE}; ${DRAFT}; INSERT INTO structure_sets VALUES ('other', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 2, NULL, NULL, 0, 'now', 'now'); INSERT INTO structure_nodes VALUES ('parent-local', 'set', NULL, 'chapter', 'Local', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now'); INSERT INTO structure_nodes VALUES ('parent-other', 'other', NULL, 'chapter', 'Other', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now'); INSERT INTO structure_nodes VALUES ('child', 'set', NULL, 'chapter', 'Child', NULL, 1, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now')`, 'SQLITE_CONSTRAINT_TRIGGER'),
  separateBoundary('trigger.range_skip_insert', 'trigger',
    { setupSql: `${BASE}; ${DRAFT}`, sql: validRange },
    {
      setupSql: `${BASE}; INSERT INTO structure_sets VALUES ('set', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'skipped_by_user', 1, NULL, NULL, 1, 'now', 'now')`,
      sql: validRange, code: 'SQLITE_CONSTRAINT_TRIGGER',
    }),
  boundary('trigger.range_skip_update', 'trigger',
    `UPDATE story_segment_ranges SET structure_set_id = 'set' WHERE id = 'range'`,
    `UPDATE story_segment_ranges SET structure_set_id = 'skipped' WHERE id = 'range'`,
    `${BASE}; ${DRAFT}; INSERT INTO structure_sets VALUES ('skipped', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'skipped_by_user', 2, NULL, NULL, 0, 'now', 'now'); ${validRange}`, 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.set_skip_with_ranges', 'trigger',
    `UPDATE structure_sets SET story_range_mode = 'included' WHERE id = 'set'`,
    `UPDATE structure_sets SET story_range_mode = 'skipped_by_user' WHERE id = 'set'`,
    `${BASE}; ${DRAFT}; ${validRange}`, 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.range_chapter_same_set_insert', 'trigger',
    `INSERT INTO story_segment_range_chapters VALUES ('range', 'chapter-local', 0)`,
    `INSERT INTO story_segment_range_chapters VALUES ('range', 'chapter-other', 0)`,
    rangeChapterTriggerSetup(), 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.range_chapter_same_set_update', 'trigger',
    `UPDATE story_segment_range_chapters SET chapter_id = 'chapter-local' WHERE story_segment_range_id = 'range'`,
    `UPDATE story_segment_range_chapters SET chapter_id = 'chapter-other' WHERE story_segment_range_id = 'range'`,
    `${rangeChapterTriggerSetup()}; INSERT INTO story_segment_range_chapters VALUES ('range', 'chapter-local', 0)`, 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.frozen_range_overlap_insert', 'trigger',
    range({ start: 10, end: 20 }).replace("'range'", "'range-2'"),
    range({ start: 5, end: 15 }).replace("'range'", "'range-2'"),
    `${BASE}; ${FROZEN}; ${range({ start: 0, end: 10 }).replace("'range'", "'range-1'")}`, 'SQLITE_CONSTRAINT_TRIGGER'),
  boundary('trigger.frozen_range_overlap_update', 'trigger',
    `UPDATE story_segment_ranges SET start_offset = 10 WHERE id = 'range-2'`,
    `UPDATE story_segment_ranges SET start_offset = 5 WHERE id = 'range-2'`,
    `${BASE}; ${FROZEN}; ${range({ start: 0, end: 10 }).replace("'range'", "'range-1'")}; ${range({ start: 10, end: 20 }).replace("'range'", "'range-2'")}`, 'SQLITE_CONSTRAINT_TRIGGER'),
  separateBoundary('trigger.freeze_with_overlap', 'trigger',
    {
      setupSql: `${BASE}; ${DRAFT}; ${range({ start: 0, end: 10 }).replace("'range'", "'range-1'")}; ${range({ start: 10, end: 20 }).replace("'range'", "'range-2'")}`,
      sql: `UPDATE structure_sets SET stage = 'frozen', draft_revision = NULL, structure_edition = 1, frozen_at = 'now' WHERE id = 'set'`,
    },
    {
      setupSql: `${BASE}; ${DRAFT}; ${range({ start: 0, end: 10 }).replace("'range'", "'range-1'")}; ${range({ start: 5, end: 15 }).replace("'range'", "'range-2'")}`,
      sql: `UPDATE structure_sets SET stage = 'frozen', draft_revision = NULL, structure_edition = 1, frozen_at = 'now' WHERE id = 'set'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    }),

  boundary('partial_index.current_structure_set', 'partial-index',
    `INSERT INTO structure_sets VALUES ('historical', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 2, NULL, NULL, 0, 'now', 'now')`,
    `INSERT INTO structure_sets VALUES ('current-2', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 2, NULL, NULL, 1, 'now', 'now')`,
    `${BASE}; ${DRAFT}`, 'SQLITE_CONSTRAINT_UNIQUE'),
] as const satisfies readonly SchemaSemanticBoundary[];

function rangeChapterTriggerSetup(): string {
  return `${BASE}; ${DRAFT}; INSERT INTO structure_sets VALUES ('other', 'book', 'source', 1, 'hash', 20, 'utf16_code_unit', 'draft', NULL, 'included', 2, NULL, NULL, 0, 'now', 'now'); INSERT INTO structure_nodes VALUES ('chapter-local', 'set', NULL, 'chapter', 'Local', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now'); INSERT INTO structure_nodes VALUES ('chapter-other', 'other', NULL, 'chapter', 'Other', NULL, 0, 0, 10, NULL, NULL, NULL, 1, 'high', NULL, 'now', 'now'); ${validRange}`;
}
