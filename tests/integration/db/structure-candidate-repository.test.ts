import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { StructureCandidateRepository } from '../../../src/main/structure/persistence/structure-candidate-repository';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  SourceTextId,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

describe('StructureCandidateRepository', () => {
  it('round trips a normalized candidate with headings, evidence and covered chapters', () => {
    const database = createDatabase();
    seedDetectionRun(database, 'run-1', 'job-1', 'sha256:source');
    const repository = new StructureCandidateRepository(database);
    const candidate = candidateFixture('candidate-1', 'run-1', 'sha256:source');

    repository.replaceCurrentCandidate(candidate);

    expect(repository.getCurrentCandidate(candidate.bookId)).toEqual(candidate);
    expect(database.prepare('SELECT COUNT(*) FROM structure_nodes').pluck().get()).toBe(3);
    expect(database.prepare('SELECT COUNT(*) FROM story_segment_ranges').pluck().get()).toBe(1);
    expect(database.prepare('SELECT COUNT(*) FROM story_segment_range_chapters').pluck().get()).toBe(2);
  });

  it('replaces only the current candidate while retaining history and current draft/frozen sets', () => {
    const database = createDatabase();
    seedDetectionRun(database, 'run-1', 'job-1', 'sha256:source');
    seedDetectionRun(database, 'run-2', 'job-2', 'sha256:source');
    seedCurrentReviewStages(database);
    const repository = new StructureCandidateRepository(database);
    repository.replaceCurrentCandidate(candidateFixture('candidate-1', 'run-1', 'sha256:source'));

    const replacement = candidateFixture('candidate-2', 'run-2', 'sha256:source', 'replacement');
    repository.replaceCurrentCandidate(replacement);

    expect(repository.getCurrentCandidate(replacement.bookId)).toEqual(replacement);
    expect(database.prepare(`
      SELECT id, stage, is_current
      FROM structure_sets
      ORDER BY stage, id
    `).all()).toEqual([
      { id: 'candidate-1', stage: 'candidate', is_current: 0 },
      { id: 'candidate-2', stage: 'candidate', is_current: 1 },
      { id: 'draft-current', stage: 'draft', is_current: 1 },
      { id: 'frozen-current', stage: 'frozen', is_current: 1 },
    ]);
  });

  it('rejects a candidate whose source snapshot does not match its detection run', () => {
    const database = createDatabase();
    seedDetectionRun(database, 'run-1', 'job-1', 'sha256:source');
    const repository = new StructureCandidateRepository(database);

    expect(() => repository.replaceCurrentCandidate(
      candidateFixture('candidate-1', 'run-1', 'sha256:different'),
    )).toThrow(/candidate source snapshot must match its detection run/i);
    expect(database.prepare('SELECT COUNT(*) FROM structure_sets').pluck().get()).toBe(0);
  });

  it('rolls back current replacement when a child row violates a global identity constraint', () => {
    const database = createDatabase();
    seedDetectionRun(database, 'run-1', 'job-1', 'sha256:source');
    seedDetectionRun(database, 'run-2', 'job-2', 'sha256:source');
    const repository = new StructureCandidateRepository(database);
    const current = candidateFixture('candidate-1', 'run-1', 'sha256:source');
    repository.replaceCurrentCandidate(current);
    const invalidReplacement = candidateFixture('candidate-2', 'run-2', 'sha256:source', 'replacement');
    invalidReplacement.nodes[0].id = current.nodes[0].id;

    expect(() => repository.replaceCurrentCandidate(invalidReplacement)).toThrow(/UNIQUE constraint failed/i);
    expect(repository.getCurrentCandidate(current.bookId)).toEqual(current);
    expect(database.prepare(`
      SELECT id, is_current FROM structure_sets ORDER BY id
    `).all()).toEqual([{ id: 'candidate-1', is_current: 1 }]);
  });
});

function createDatabase(): SqliteDatabase {
  const database = openSqliteDatabase(':memory:');
  databases.push(database);
  runMigrations(database, APP_MIGRATIONS);
  seedBookAndSource(database);
  return database;
}

function seedBookAndSource(database: SqliteDatabase): void {
  const now = '2026-07-10T00:00:00.000Z';
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example', '0.1.0', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    )
    VALUES ('source-1', 'book-1', 'md', 'sha256:source', 'utf-8', 1,
      'source/source-1/example.md', ?, 'example.md', 120)
  `).run(now);
  database.prepare("UPDATE books SET source_text_id = 'source-1' WHERE id = 'book-1'").run();
}

function seedDetectionRun(
  database: SqliteDatabase,
  runId: string,
  jobId: string,
  contentHash: string,
): void {
  const now = '2026-07-10T00:00:00.000Z';
  database.prepare(`
    INSERT INTO jobs (
      id, book_id, type, state, progress, payload_json, error_json, created_at, updated_at
    )
    VALUES (?, 'book-1', 'structure_detection', 'completed', 1, '{}', NULL, ?, ?)
  `).run(jobId, now, now);
  database.prepare(`
    INSERT INTO structure_detection_runs (
      id, job_id, book_id, source_text_id, source_text_edition,
      source_content_hash, decoded_text_length, offset_unit, state,
      failure_reason, created_at, updated_at
    )
    VALUES (?, ?, 'book-1', 'source-1', 1, ?, 120,
      'utf16_code_unit', 'completed', NULL, ?, ?)
  `).run(runId, jobId, contentHash, now, now);
}

function seedCurrentReviewStages(database: SqliteDatabase): void {
  const now = '2026-07-10T00:00:00.000Z';
  database.prepare(`
    INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
    ) VALUES (
      'draft-current', 'book-1', 'source-1', 1, 'sha256:source', 120,
      'utf16_code_unit', 'draft', NULL, 'included', 0, NULL, NULL, 1, ?, ?
    )
  `).run(now, now);
  database.prepare(`
    INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
    ) VALUES (
      'frozen-current', 'book-1', 'source-1', 1, 'sha256:source', 120,
      'utf16_code_unit', 'frozen', NULL, 'included', NULL, 1, ?, 1, ?, ?
    )
  `).run(now, now, now);
}

function candidateFixture(
  setId: string,
  runId: string,
  contentHash: string,
  idPrefix = setId,
): CandidateStructureSet {
  const now = '2026-07-10T00:00:00.000Z';
  const rootId = `${idPrefix}:book` as StructureNodeId;
  const firstChapterId = `${idPrefix}:chapter:1` as StructureNodeId;
  const secondChapterId = `${idPrefix}:chapter:2` as StructureNodeId;

  return {
    id: setId as StructureSetId,
    bookId: 'book-1' as BreakdownBookId,
    sourceSnapshot: {
      sourceTextId: 'source-1' as SourceTextId,
      sourceTextEdition: 1,
      contentHash,
      decodedTextLength: 120,
      offsetUnit: 'utf16_code_unit',
    },
    nodes: [
      {
        id: rootId,
        originId: null,
        kind: 'book',
        title: 'Example Book',
        parentId: null,
        order: 0,
        startOffset: 0,
        endOffset: 120,
        heading: null,
        confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
      },
      {
        id: firstChapterId,
        originId: null,
        kind: 'chapter',
        title: 'Chapter 1',
        parentId: rootId,
        order: 0,
        startOffset: 0,
        endOffset: 60,
        heading: { rawHeadingText: 'Chapter 1', headingStartOffset: 0, headingEndOffset: 9 },
        confidence: { score: 0.9, level: 'high', lowConfidenceResolution: null },
      },
      {
        id: secondChapterId,
        originId: null,
        kind: 'chapter',
        title: 'Chapter 2',
        parentId: rootId,
        order: 1,
        startOffset: 60,
        endOffset: 120,
        heading: { rawHeadingText: 'Chapter 2', headingStartOffset: 60, headingEndOffset: 69 },
        confidence: { score: 0.5, level: 'low', lowConfidenceResolution: 'unresolved' },
      },
    ],
    storyRanges: [{
      id: `${idPrefix}:range:1` as StorySegmentRangeId,
      originId: null,
      title: 'Story segment 1',
      startOffset: 0,
      endOffset: 120,
      coveredChapterIds: [firstChapterId, secondChapterId],
      suggestedFunctionTags: ['transition'],
      boundaryEvidence: [
        { kind: 'chapter_window', startOffset: 0, endOffset: 120 },
        { kind: 'transition_hint', startOffset: 100, endOffset: 110 },
      ],
      startReason: 'signal_group_start',
      endReason: 'signal_group_end:combined_soft_signals',
      confidence: { score: 0.4, level: 'low', lowConfidenceResolution: 'unresolved' },
    }],
    storyRangeMode: 'included',
    createdAt: now,
    updatedAt: now,
    stage: 'candidate',
    detectionRunId: runId as StructureDetectionRunId,
    draftRevision: null,
    structureEdition: null,
  };
}
