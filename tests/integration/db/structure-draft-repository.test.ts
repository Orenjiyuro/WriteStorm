import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { StructureCandidateRepository } from '../../../src/main/structure/persistence/structure-candidate-repository';
import {
  StructureDraftRepository,
  StructureDraftRepositoryError,
} from '../../../src/main/structure/persistence/structure-draft-repository';
import { StructureScopeResolver } from '../../../src/main/structure/structure-scope-resolver';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const candidateSetId = 'candidate-1' as StructureSetId;
const now = '2026-07-14T00:00:00.000Z';

describe('StructureDraftRepository transaction boundaries', () => {
  it('creates a revision-1 manual draft with only a new book root and no detection lineage', () => {
    withDatabase((database) => {
      seedCandidate(database);
      database.prepare("UPDATE structure_detection_runs SET state = 'failed', failure_reason = 'structure_detection_failed'").run();
      database.prepare("UPDATE structure_sets SET is_current = 0 WHERE stage = 'candidate'").run();
      const repository = new StructureDraftRepository(database);
      const draft = write(database, () => repository.createManual({
        bookId, bookTitle: 'Manual Book',
        expectedFailedDetectionRunId: 'run-1' as StructureDetectionRunId,
        sourceSnapshot: {
          sourceTextId: 'source-1' as import('../../../src/shared/domain').SourceTextId,
          sourceTextEdition: 1, contentHash: 'sha256:source', decodedTextLength: 100,
          offsetUnit: 'utf16_code_unit',
        },
        createSetId: () => 'manual-draft' as StructureSetId,
        createNodeId: () => 'manual-root' as StructureNodeId,
        now,
      }));
      expect(draft).toMatchObject({
        id: 'manual-draft', originSetId: null, stage: 'draft', detectionRunId: null,
        draftRevision: 1, storyRanges: [], storyRangeMode: 'included',
      });
      expect(draft.nodes).toEqual([expect.objectContaining({
        id: 'manual-root', originId: null, kind: 'book', title: 'Manual Book',
        parentId: null, order: 0, startOffset: 0, endOffset: 100,
      })]);
    });
  });

  it('rejects manual draft without the expected latest failed run or while a fresh candidate exists', () => {
    withDatabase((database) => {
      seedCandidate(database);
      const repository = new StructureDraftRepository(database);
      const input = {
        bookId, bookTitle: 'Manual Book',
        expectedFailedDetectionRunId: 'run-1' as StructureDetectionRunId,
        sourceSnapshot: candidate().sourceSnapshot,
        createSetId: () => 'manual-blocked' as StructureSetId,
        createNodeId: () => 'manual-blocked-root' as StructureNodeId,
        now,
      };
      expectRepositoryError(
        () => write(database, () => repository.createManual(input)),
        'structure_reference_blocked', ['manual_draft_requires_failed_detection'],
      );
      database.prepare("UPDATE structure_detection_runs SET state = 'failed', failure_reason = 'structure_detection_failed'").run();
      expectRepositoryError(
        () => write(database, () => repository.createManual(input)),
        'structure_reference_blocked', ['fresh_candidate_requires_draft'],
      );
    });
  });
  it('adds one manual node atomically and allocates an id only after blockers pass', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-add-node');
      const root = draft.nodes.find(({ kind }) => kind === 'book')!;
      let ids = 0;
      const updated = write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'add-node', kind: 'volume', title: 'Manual volume', parentId: root.id,
          order: 0, startOffset: 0, endOffset: 100 },
        createNodeId: () => { ids += 1; return 'manual-volume' as StructureNodeId; }, now,
      }));
      expect(updated.draftRevision).toBe(2);
      expect(updated.nodes.find(({ id }) => id === 'manual-volume')).toMatchObject({
        title: 'Manual volume', originId: null, parentId: root.id, order: 0,
      });
      expect(ids).toBe(1);
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: { type: 'add-node', kind: 'chapter', title: 'Blocked chapter', parentId: root.id,
          order: 0, startOffset: 0, endOffset: 50 },
        createNodeId: () => { ids += 1; return 'must-not-allocate' as StructureNodeId; }, now,
      })), 'structure_reference_blocked', ['story_range_coverage_requires_geometry_update']);
      expect(ids).toBe(1);
      expect(revision(database, draft.id)).toBe(2);
    });
  });
  it('rolls back set and child rows when a generated global id collides', () => {
    withDatabase((database) => {
      seedCandidate(database);
      const repository = new StructureDraftRepository(database);
      expect(() => write(database, () => repository.createFromCandidate({
        bookId,
        candidateSetId,
        ids: {
          createSetId: () => 'draft-collision' as StructureSetId,
          createNodeId: () => 'duplicate-node' as StructureNodeId,
          createRangeId: () => 'draft-range' as StorySegmentRangeId,
        },
        now,
      }))).toThrow();
      expect(count(database, "structure_sets WHERE id = 'draft-collision'")).toBe(0);
      expect(count(database, "structure_nodes WHERE structure_set_id = 'draft-collision'")).toBe(0);
      expect(count(database, "story_segment_ranges WHERE structure_set_id = 'draft-collision'")).toBe(0);
      expect(currentCandidate(database)).toBe(candidateSetId);
    });
  });

  it('keeps revision and node metadata unchanged on mismatch and missing-node errors', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-revision');
      expect(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: { type: 'rename-node', nodeId: draft.nodes[1].id, title: 'No write' }, now,
      }))).toThrowError(expect.objectContaining({
        reason: 'draft_revision_mismatch',
        revision: { expected: 2, actual: 1 },
      }));
      expect(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'remove-node', nodeId: 'missing-node' as StructureNodeId }, now,
      }))).toThrowError(expect.objectContaining({ reason: 'node_not_found' }));
      expect(revision(database, draft.id)).toBe(1);
      expect(title(database, draft.nodes[1].id)).toBe(draft.nodes[1].title);
    });
  });

  it('maps a whitespace-only node title to a stable blocker without changing revision', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-node-title');
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'rename-node', nodeId: draft.nodes[1].id, title: '   ' }, now,
      })), 'structure_reference_blocked', ['node_title_blank']);
      expect(revision(database, draft.id)).toBe(1);
    });
  });

  it('returns deterministic blockers without cascading children or range coverage', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-blockers');
      const root = draft.nodes.find(({ kind }) => kind === 'book')!;
      const covered = draft.storyRanges[0].coveredChapterIds[0];
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'remove-node', nodeId: root.id }, now,
      })), 'structure_reference_blocked', ['book_root', `child:${draft.nodes[1].id}`]);
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'remove-node', nodeId: covered }, now,
      })), 'structure_reference_blocked', [`story-range:${draft.storyRanges[0].id}`]);
      expect(count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`)).toBe(draft.nodes.length);
      expect(count(database, `story_segment_range_chapters WHERE story_segment_range_id = '${draft.storyRanges[0].id}'`)).toBe(2);
      expect(revision(database, draft.id)).toBe(1);
    });
  });

  it('rejects stale edits but allows explicit discard and retains the historical aggregate', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-stale-discard');
      database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
      expect(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'rename-node', nodeId: draft.nodes[1].id, title: 'No write' }, now,
      }))).toThrowError(expect.objectContaining({ reason: 'draft_stale' }));
      expect(write(database, () => repository.discardCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1, now,
      }))).toEqual({ bookId, discardedDraftSetId: draft.id });
      expect(database.prepare('SELECT is_current FROM structure_sets WHERE id = ?').pluck().get(draft.id)).toBe(0);
      expect(count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`)).toBe(draft.nodes.length);
      expect(count(database, `story_segment_ranges WHERE structure_set_id = '${draft.id}'`)).toBe(draft.storyRanges.length);
    });
  });

  it('rolls back a successful child mutation when the outer transaction aborts', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-outer-rollback');
      expect(() => write(database, () => {
        repository.updateNodeMetadata({
          bookId, draftSetId: draft.id, expectedDraftRevision: 1,
          command: { type: 'rename-node', nodeId: draft.nodes[1].id, title: 'Temporary' }, now,
        });
        throw new Error('later aggregate step failed');
      })).toThrow('later aggregate step failed');
      expect(revision(database, draft.id)).toBe(1);
      expect(title(database, draft.nodes[1].id)).toBe(draft.nodes[1].title);
    });
  });

  it('updates one valid node span and increments revision exactly once', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-span');
      const chapter = draft.nodes.find(({ title }) => title === 'candidate-chapter-1')!;
      const updated = write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-node-span', nodeId: chapter.id, startOffset: 1, endOffset: 49 }, now,
      }));
      expect(updated.draftRevision).toBe(2);
      expect(updated.nodes.find(({ id }) => id === chapter.id)).toMatchObject({ startOffset: 1, endOffset: 49 });
      expect(revision(database, draft.id)).toBe(2);
    });
  });

  it('returns span blockers without changing node offsets or revision', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-span-blocked');
      const root = draft.nodes.find(({ kind }) => kind === 'book')!;
      const first = draft.nodes.find(({ title }) => title === 'candidate-chapter-1')!;
      database.prepare(`UPDATE structure_nodes SET raw_heading_text = 'Heading',
        heading_start_offset = 0, heading_end_offset = 7 WHERE id = ?`).run(first.id);

      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-node-span', nodeId: root.id, startOffset: 0, endOffset: 60 }, now,
      })), 'structure_reference_blocked', ['root_coverage', `child:${draft.nodes[2].id}`]);
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-node-span', nodeId: first.id, startOffset: 10, endOffset: 40 }, now,
      })), 'structure_reference_blocked', ['heading']);
      expect(revision(database, draft.id)).toBe(1);
      expect(database.prepare('SELECT start_offset, end_offset FROM structure_nodes WHERE id = ?').get(first.id))
        .toEqual({ start_offset: 0, end_offset: 50 });
    });
  });

  it('blocks a span change that would alter story-range chapter coverage', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-span-range');
      const second = draft.nodes.find(({ title }) => title === 'candidate-chapter-2')!;
      database.prepare("UPDATE story_segment_ranges SET end_offset = 50, boundary_evidence_json = '[{\"kind\":\"chapter_window\",\"startOffset\":0,\"endOffset\":50}]' WHERE id = ?")
        .run(draft.storyRanges[0].id);
      database.prepare('DELETE FROM story_segment_range_chapters WHERE story_segment_range_id = ? AND chapter_id = ?')
        .run(draft.storyRanges[0].id, second.id);
      expectRepositoryError(() => write(database, () => repository.updateNodeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-node-span', nodeId: second.id, startOffset: 40, endOffset: 50 }, now,
      })), 'structure_reference_blocked', [`story-range:${draft.storyRanges[0].id}`]);
      expect(revision(database, draft.id)).toBe(1);
      expect(database.prepare('SELECT start_offset, end_offset FROM structure_nodes WHERE id = ?').get(second.id))
        .toEqual({ start_offset: 50, end_offset: 100 });
    });
  });

  it('updates range title and function tags with one revision per strict command', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-metadata');
      const range = draft.storyRanges[0];
      database.prepare(`UPDATE story_segment_ranges SET confidence_level = 'low',
        low_confidence_resolution = 'unresolved' WHERE id = ?`).run(range.id);
      const renamed = write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'rename-range', rangeId: range.id, title: 'Corrected range' }, now,
      }));
      expect(renamed).toMatchObject({ draftRevision: 2 });
      expect(renamed.storyRanges[0]).toMatchObject({
        title: 'Corrected range',
        confidence: { level: 'low', lowConfidenceResolution: 'corrected' },
      });
      const tagged = write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: { type: 'set-range-function-tags', rangeId: range.id, functionTags: ['setup', 'turn'] }, now,
      }));
      expect(tagged).toMatchObject({ draftRevision: 3 });
      expect(tagged.storyRanges[0].suggestedFunctionTags).toEqual(['setup', 'turn']);
    });
  });

  it('accepts an unresolved low-confidence range without changing metadata', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-accept');
      const range = draft.storyRanges[0];
      database.prepare(`UPDATE story_segment_ranges SET confidence_level = 'low',
        low_confidence_resolution = 'unresolved' WHERE id = ?`).run(range.id);
      const accepted = write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'accept-range-low-confidence', rangeId: range.id }, now,
      }));
      expect(accepted).toMatchObject({ draftRevision: 2 });
      expect(accepted.storyRanges[0]).toMatchObject({
        title: range.title,
        suggestedFunctionTags: range.suggestedFunctionTags,
        confidence: { level: 'low', lowConfidenceResolution: 'accepted' },
      });
    });
  });

  it('rejects stale, missing-range and revision-conflicted range metadata without mutation', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-guarded');
      const range = draft.storyRanges[0];
      expect(() => write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: { type: 'rename-range', rangeId: range.id, title: 'No write' }, now,
      }))).toThrowError(expect.objectContaining({ reason: 'draft_revision_mismatch' }));
      expect(() => write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'rename-range', rangeId: 'missing-range' as StorySegmentRangeId, title: 'No write' }, now,
      }))).toThrowError(expect.objectContaining({ reason: 'range_not_found' }));
      database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
      expect(() => write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-function-tags', rangeId: range.id, functionTags: ['no-write'] }, now,
      }))).toThrowError(expect.objectContaining({ reason: 'draft_stale' }));
      expect(revision(database, draft.id)).toBe(1);
      expect(database.prepare('SELECT title FROM story_segment_ranges WHERE id = ?').pluck().get(range.id)).toBe(range.title);
    });
  });

  it('updates a range span only when evidence and exact chapter coverage remain valid', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-span');
      const range = draft.storyRanges[0];
      const second = draft.nodes.find(({ title }) => title === 'candidate-chapter-2')!;
      database.prepare(`UPDATE story_segment_ranges SET end_offset = 75,
        boundary_evidence_json = '[{"kind":"chapter_window","startOffset":0,"endOffset":50}]'
        WHERE id = ?`).run(range.id);
      database.prepare('DELETE FROM story_segment_range_chapters WHERE story_segment_range_id = ? AND chapter_id = ?')
        .run(range.id, second.id);
      const updated = write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-span', rangeId: range.id, startOffset: 0, endOffset: 60 }, now,
      }));
      expect(updated).toMatchObject({ draftRevision: 2 });
      expect(updated.storyRanges[0]).toMatchObject({ startOffset: 0, endOffset: 60 });
      expect(updated.storyRanges[0].coveredChapterIds).toEqual([draft.nodes[1].id]);
    });
  });

  it('atomically replaces range coverage with the exact source-ordered chapter set', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-coverage');
      const range = draft.storyRanges[0];
      database.prepare('DELETE FROM story_segment_range_chapters WHERE story_segment_range_id = ? AND sort_order = 1')
        .run(range.id);
      const updated = write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-coverage', rangeId: range.id, coveredChapterIds: draft.nodes
          .filter(({ kind }) => kind === 'chapter').map(({ id }) => id) }, now,
      }));
      expect(updated).toMatchObject({ draftRevision: 2 });
      expect(updated.storyRanges[0].coveredChapterIds).toEqual(
        draft.nodes.filter(({ kind }) => kind === 'chapter').map(({ id }) => id),
      );
    });
  });

  it('atomically changes span, coverage, and boundary evidence between legal geometries', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-atomic-geometry');
      const range = draft.storyRanges[0];
      const chapters = draft.nodes.filter(({ kind }) => kind === 'chapter');
      const narrowed = write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'set-range-geometry', rangeId: range.id, startOffset: 0, endOffset: 50,
          coveredChapterIds: [chapters[0].id],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 50 }],
        }, now,
      }));
      expect(narrowed.storyRanges[0]).toMatchObject({
        startOffset: 0, endOffset: 50, coveredChapterIds: [chapters[0].id],
      });
      const expanded = write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: {
          type: 'set-range-geometry', rangeId: range.id, startOffset: 0, endOffset: 100,
          coveredChapterIds: chapters.map(({ id }) => id),
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
        }, now,
      }));
      expect(expanded).toMatchObject({ draftRevision: 3 });
      expect(expanded.storyRanges[0]).toMatchObject({
        startOffset: 0, endOffset: 100,
        coveredChapterIds: chapters.map(({ id }) => id),
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
      });
    });
  });

  it('rejects invalid range span evidence, overlap and coverage without mutation', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-geometry-blocked');
      const range = draft.storyRanges[0];
      const chapters = draft.nodes.filter(({ kind }) => kind === 'chapter');
      database.prepare(`INSERT INTO story_segment_ranges (
        id, structure_set_id, origin_id, title, start_offset, end_offset,
        suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
        confidence_score, confidence_level, created_at, updated_at
      ) VALUES ('other-range', ?, NULL, 'Other', 80, 100, '[]',
        '[{"kind":"chapter_window","startOffset":80,"endOffset":100}]',
        'start', 'end', 1, 'high', ?, ?)`).run(draft.id, now, now);

      expectRepositoryError(() => write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-span', rangeId: range.id, startOffset: 10, endOffset: 90 }, now,
      })), 'structure_reference_blocked', ['boundary-evidence:0', 'range-overlap:other-range']);
      expectRepositoryError(() => write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-coverage', rangeId: range.id,
          coveredChapterIds: [chapters[1].id, chapters[0].id] }, now,
      })), 'structure_reference_blocked', ['chapter_order']);
      expectRepositoryError(() => write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'set-range-coverage', rangeId: range.id,
          coveredChapterIds: [chapters[0].id, chapters[0].id] }, now,
      })), 'structure_reference_blocked', [`duplicate-chapter:${chapters[0].id}`, 'coverage_mismatch']);
      expectRepositoryError(() => write(database, () => repository.updateRangeGeometry({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'set-range-geometry', rangeId: range.id, startOffset: 10, endOffset: 90,
          coveredChapterIds: [chapters[1].id, chapters[0].id],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
        }, now,
      })), 'structure_reference_blocked', [
        'boundary-evidence:0', 'range-overlap:other-range', 'chapter_order', 'coverage_mismatch',
      ]);
      expect(revision(database, draft.id)).toBe(1);
      expect(database.prepare('SELECT start_offset, end_offset FROM story_segment_ranges WHERE id = ?').get(range.id))
        .toEqual({ start_offset: 0, end_offset: 100 });
      expect(database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
        WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck().all(range.id)).toEqual(chapters.map(({ id }) => id));
    });
  });

  it('adds a valid non-overlapping range with a main-generated global id', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-add');
      const existing = draft.storyRanges[0];
      const chapters = draft.nodes.filter(({ kind }) => kind === 'chapter');
      database.prepare(`UPDATE story_segment_ranges SET end_offset = 50,
        boundary_evidence_json = '[{"kind":"chapter_window","startOffset":0,"endOffset":50}]'
        WHERE id = ?`).run(existing.id);
      database.prepare('DELETE FROM story_segment_range_chapters WHERE story_segment_range_id = ? AND chapter_id = ?')
        .run(existing.id, chapters[1].id);
      const updated = write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'add-range', title: 'Second half', startOffset: 50, endOffset: 100,
          coveredChapterIds: [chapters[1].id], functionTags: ['resolution'],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 50, endOffset: 100 }],
          startReason: 'chapter_start', endReason: 'source_end',
        },
        createRangeId: () => 'draft-range-added' as StorySegmentRangeId,
        now,
      }));
      expect(updated).toMatchObject({ draftRevision: 2 });
      expect(updated.storyRanges.find(({ id }) => id === 'draft-range-added')).toMatchObject({
        title: 'Second half', startOffset: 50, endOffset: 100,
        coveredChapterIds: [chapters[1].id], suggestedFunctionTags: ['resolution'],
        confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
      });
    });
  });

  it('removes only the range aggregate and preserves every chapter node', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-remove');
      const range = draft.storyRanges[0];
      const nodeCount = count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`);
      const updated = write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'remove-range', rangeId: range.id },
        createRangeId: () => 'unused-range' as StorySegmentRangeId,
        now,
      }));
      expect(updated).toMatchObject({ draftRevision: 2, storyRanges: [] });
      expect(count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`)).toBe(nodeCount);
      expect(count(database, `story_segment_range_chapters WHERE story_segment_range_id = '${range.id}'`)).toBe(0);
    });
  });

  it('rolls back invalid or colliding range creation without changing revision', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-add-blocked');
      const range = draft.storyRanges[0];
      const chapters = draft.nodes.filter(({ kind }) => kind === 'chapter');
      expectRepositoryError(() => write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'add-range', title: 'Overlap', startOffset: 25, endOffset: 75,
          coveredChapterIds: [chapters[0].id], functionTags: [],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 25, endOffset: 75 }],
          startReason: 'start', endReason: 'end',
        }, createRangeId: () => 'blocked-range' as StorySegmentRangeId, now,
      })), 'structure_reference_blocked', [`range-overlap:${range.id}`, 'coverage_mismatch']);
      expect(() => write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'add-range', title: 'Collision', startOffset: 0, endOffset: 100,
          coveredChapterIds: chapters.map(({ id }) => id), functionTags: [],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
          startReason: 'start', endReason: 'end',
        }, createRangeId: () => range.id, now,
      }))).toThrow();
      expect(revision(database, draft.id)).toBe(1);
      expect(count(database, "story_segment_ranges WHERE id = 'blocked-range'")).toBe(0);
      expect(count(database, `story_segment_ranges WHERE structure_set_id = '${draft.id}'`)).toBe(1);
    });
  });

  it('blocks add-range while skipped before generating an id or reaching SQLite', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-add-skipped');
      write(database, () => repository.setStoryRangeMode({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        mode: 'skipped_by_user', now,
      }));
      let idCalls = 0;
      expectRepositoryError(() => write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        command: {
          type: 'add-range', title: 'Blocked', startOffset: 0, endOffset: 100,
          coveredChapterIds: draft.nodes.filter(({ kind }) => kind === 'chapter').map(({ id }) => id),
          functionTags: [],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
          startReason: 'start', endReason: 'end',
        },
        createRangeId: () => {
          idCalls += 1;
          return 'must-not-be-created' as StorySegmentRangeId;
        },
        now,
      })), 'structure_reference_blocked', ['story_range_mode_skipped']);
      expect(idCalls).toBe(0);
      expect(revision(database, draft.id)).toBe(2);
      expect(count(database, `story_segment_ranges WHERE structure_set_id = '${draft.id}'`)).toBe(0);
    });
  });

  it('maps whitespace-only range text to stable repository blockers', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-text-blocked');
      const range = draft.storyRanges[0];
      expectRepositoryError(() => write(database, () => repository.updateRangeMetadata({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: { type: 'rename-range', rangeId: range.id, title: '   ' }, now,
      })), 'structure_reference_blocked', ['range_title_blank']);
      expectRepositoryError(() => write(database, () => repository.updateRangeCrud({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        command: {
          type: 'add-range', title: '\t', startOffset: 0, endOffset: 100,
          coveredChapterIds: draft.nodes.filter(({ kind }) => kind === 'chapter').map(({ id }) => id),
          functionTags: [],
          boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
          startReason: ' ', endReason: '\n',
        }, createRangeId: () => 'blank-range' as StorySegmentRangeId, now,
      })), 'structure_reference_blocked', [
        'range_title_blank', 'range_start_reason_blank', 'range_end_reason_blank',
      ]);
      expect(revision(database, draft.id)).toBe(1);
      expect(count(database, "story_segment_ranges WHERE id = 'blank-range'")).toBe(0);
    });
  });

  it('atomically skips story ranges without changing candidate or chapter nodes', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-skip');
      const nodeCount = count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`);
      const candidateRangeCount = count(database, `story_segment_ranges WHERE structure_set_id = '${candidateSetId}'`);
      const updated = write(database, () => repository.setStoryRangeMode({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        mode: 'skipped_by_user', now,
      }));
      expect(updated).toMatchObject({
        draftRevision: 2, storyRangeMode: 'skipped_by_user', storyRanges: [],
      });
      expect(count(database, `structure_nodes WHERE structure_set_id = '${draft.id}'`)).toBe(nodeCount);
      expect(count(database, `story_segment_ranges WHERE structure_set_id = '${candidateSetId}'`))
        .toBe(candidateRangeCount);
    });
  });

  it('does not restore deleted ranges when story ranges are included again', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-reinclude');
      write(database, () => repository.setStoryRangeMode({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        mode: 'skipped_by_user', now,
      }));
      const updated = write(database, () => repository.setStoryRangeMode({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        mode: 'included', now,
      }));
      expect(updated).toMatchObject({
        draftRevision: 3, storyRangeMode: 'included', storyRanges: [],
      });
    });
  });

  it('rolls back story range mode cleanup on revision mismatch', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-range-mode-mismatch');
      expectRepositoryError(() => write(database, () => repository.setStoryRangeMode({
        bookId, draftSetId: draft.id, expectedDraftRevision: 2,
        mode: 'skipped_by_user', now,
      })), 'draft_revision_mismatch', []);
      expect(revision(database, draft.id)).toBe(1);
      expect(count(database, `story_segment_ranges WHERE structure_set_id = '${draft.id}'`)).toBe(1);
    });
  });

  it('freezes in place, closes the old frozen set, and increments the positive book edition', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-freeze-1');
      const first = write(database, () => repository.freezeCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: draft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      }));
      expect(first).toMatchObject({
        id: draft.id, stage: 'frozen', draftRevision: null, structureEdition: 1,
      });
      expect(database.prepare('SELECT structure_edition FROM books WHERE id = ?').pluck().get(bookId)).toBe(1);

      let nodeIndex = 100;
      let blockedIds = 0;
      expectRepositoryError(() => write(database, () => repository.createFromCandidate({
        bookId, candidateSetId,
        ids: {
          createSetId: () => { blockedIds += 1; return 'blocked-candidate-draft' as StructureSetId; },
          createNodeId: () => { blockedIds += 1; return 'blocked-candidate-node' as StructureNodeId; },
          createRangeId: () => { blockedIds += 1; return 'blocked-candidate-range' as StorySegmentRangeId; },
        }, now,
      })), 'structure_reference_blocked', ['current_frozen_requires_unfreeze']);
      expect(blockedIds).toBe(0);

      const secondDraft = write(database, () => repository.createFromFrozen({
        bookId, frozenSetId: first.id,
        ids: {
          createSetId: () => 'draft-freeze-2' as StructureSetId,
          createNodeId: () => `draft-node-${++nodeIndex}` as StructureNodeId,
          createRangeId: () => 'draft-range-2' as StorySegmentRangeId,
        }, now,
      }));
      const second = write(database, () => repository.freezeCurrent({
        bookId, draftSetId: secondDraft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: secondDraft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      }));
      expect(second).toMatchObject({ id: secondDraft.id, structureEdition: 2 });
      expect(database.prepare(`SELECT id, is_current FROM structure_sets
        WHERE stage = 'frozen' ORDER BY structure_edition`).all()).toEqual([
        { id: draft.id, is_current: 0 }, { id: secondDraft.id, is_current: 1 },
      ]);
      expect(repository.getFrozenById(draft.id)).toMatchObject({
        id: draft.id, structureEdition: 1,
      });
      const resolver = new StructureScopeResolver({
        getUnitOfWork: () => ({
          read: <T>(operation: (session: { database: SqliteDatabase }) => T) => operation({ database }),
        }),
      } as never);
      const historicalChapter = first.nodes.find(({ kind }) => kind === 'chapter')!;
      expect(resolver.resolve({ kind: 'chapter', nodeId: historicalChapter.id }, bookId))
        .toMatchObject({ frozenSet: { id: draft.id, structureEdition: 1 }, target: { id: historicalChapter.id } });
      expect(resolver.resolve({ kind: 'story_segment_range', rangeId: first.storyRanges[0].id }, bookId))
        .toMatchObject({ frozenSet: { id: draft.id }, target: { id: first.storyRanges[0].id } });
      expect(() => resolver.resolve({ kind: 'volume', nodeId: historicalChapter.id }, bookId))
        .toThrowError(expect.objectContaining({ reason: 'scope_kind_mismatch' }));
      const candidateChapterId = database.prepare(`SELECT id FROM structure_nodes
        WHERE structure_set_id = ? AND kind = 'chapter' LIMIT 1`).pluck().get(candidateSetId) as StructureNodeId;
      expect(() => resolver.resolve({ kind: 'chapter', nodeId: candidateChapterId }, bookId))
        .toThrowError(expect.objectContaining({ reason: 'scope_not_frozen' }));
    });
  });

  it('creates an explicit replacement draft from a fresh post-frozen candidate while keeping the stale frozen current', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'frozen-before-source-change');
      const frozen = write(database, () => repository.freezeCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: draft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      }));
      const replacementTime = now;
      database.exec(`
        INSERT INTO source_texts (id, book_id, original_file_name, size_bytes, format,
          content_hash, encoding, source_edition, relative_path, imported_at)
          VALUES ('source-2', 'book-1', 'book-2.md', 100, 'md', 'sha256:source-2',
            'utf-8', 2, 'source/source-2/book-2.md', '${replacementTime}');
        UPDATE books SET current_source_text_id = 'source-2' WHERE id = 'book-1';
        INSERT INTO jobs (id, book_id, kind, state, completed_units, total_units,
          payload_schema_version, payload_json, created_at, updated_at)
          VALUES ('job-2', 'book-1', 'structure_detection', 'completed', 1, 1, 1,
            '{"title":"Detect structure","sourceTextId":"source-2","sourceTextEdition":2,"contentHash":"sha256:source-2"}',
            '${replacementTime}', '${replacementTime}');
        INSERT INTO structure_detection_runs (id, job_id, book_id, source_text_id,
          source_text_edition, source_content_hash, decoded_text_length, offset_unit,
          state, failure_reason, created_at, updated_at, run_sequence)
          VALUES ('run-2', 'job-2', 'book-1', 'source-2', 2, 'sha256:source-2', 100,
            'utf16_code_unit', 'completed', NULL, '${replacementTime}', '${replacementTime}', 2);
      `);
      const nextCandidate = {
        ...candidate(), id: 'candidate-2' as StructureSetId,
        sourceSnapshot: {
          ...candidate().sourceSnapshot,
          sourceTextId: 'source-2' as CandidateStructureSet['sourceSnapshot']['sourceTextId'],
          sourceTextEdition: 2, contentHash: 'sha256:source-2',
        },
        nodes: candidate().nodes.map((candidateNode) => ({
          ...candidateNode,
          id: `candidate-2-${candidateNode.kind}-${candidateNode.order}` as StructureNodeId,
          parentId: candidateNode.parentId === null
            ? null : 'candidate-2-book-0' as StructureNodeId,
        })),
        storyRanges: candidate().storyRanges.map((range) => ({
          ...range,
          id: 'candidate-2-range' as StorySegmentRangeId,
          coveredChapterIds: [
            'candidate-2-chapter-0' as StructureNodeId,
            'candidate-2-chapter-1' as StructureNodeId,
          ],
        })),
        detectionRunId: 'run-2' as StructureDetectionRunId,
        createdAt: replacementTime, updatedAt: replacementTime,
      };
      new StructureCandidateRepository(database).replaceCurrentCandidate(nextCandidate);

      const blockedIds = {
        createSetId: () => 'must-not-create-set' as StructureSetId,
        createNodeId: () => 'must-not-create-node' as StructureNodeId,
        createRangeId: () => 'must-not-create-range' as StorySegmentRangeId,
      };
      database.prepare("UPDATE structure_detection_runs SET state = 'failed', failure_reason = 'failed' WHERE id = 'run-2'").run();
      database.prepare("UPDATE jobs SET state = 'failed', error_code = 'failed' WHERE id = 'job-2'").run();
      expectRepositoryError(() => write(database, () => repository.createFromCandidate({
        bookId, candidateSetId: nextCandidate.id, replacementFrozenSetId: frozen.id,
        ids: blockedIds, now: replacementTime,
      })), 'structure_reference_blocked', ['replacement_candidate_run_not_completed']);
      database.prepare("UPDATE structure_detection_runs SET state = 'completed', failure_reason = NULL, source_content_hash = 'sha256:mismatch' WHERE id = 'run-2'").run();
      database.prepare("UPDATE jobs SET state = 'completed', error_code = NULL WHERE id = 'job-2'").run();
      expectRepositoryError(() => write(database, () => repository.createFromCandidate({
        bookId, candidateSetId: nextCandidate.id, replacementFrozenSetId: frozen.id,
        ids: blockedIds, now: replacementTime,
      })), 'structure_reference_blocked', ['replacement_candidate_run_snapshot_mismatch']);
      database.prepare("UPDATE structure_detection_runs SET source_content_hash = 'sha256:source-2' WHERE id = 'run-2'").run();

      let nodeIndex = 0;
      const replacement = write(database, () => repository.createFromCandidate({
        bookId, candidateSetId: nextCandidate.id, replacementFrozenSetId: frozen.id,
        ids: {
          createSetId: () => 'replacement-draft' as StructureSetId,
          createNodeId: () => `replacement-node-${++nodeIndex}` as StructureNodeId,
          createRangeId: () => 'replacement-range' as StorySegmentRangeId,
        }, now: replacementTime,
      }));

      expect(replacement).toMatchObject({
        id: 'replacement-draft', originSetId: 'candidate-2', stage: 'draft',
        draftRevision: 1, sourceSnapshot: { sourceTextId: 'source-2', sourceTextEdition: 2 },
      });
      expect(database.prepare('SELECT is_current FROM structure_sets WHERE id = ?')
        .pluck().get(frozen.id)).toBe(1);
    });
  });

  it('rolls back freeze when pure validation rejects unresolved low confidence', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-freeze-invalid');
      database.prepare(`UPDATE structure_nodes SET confidence_level = 'low',
        confidence_score = 0.4, low_confidence_resolution = 'unresolved'
        WHERE id = ?`).run(draft.nodes[1].id);
      expectRepositoryError(() => write(database, () => repository.freezeCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: draft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      })), 'draft_validation_failed', ['unresolved_low_confidence']);
      expect(revision(database, draft.id)).toBe(1);
      expect(database.prepare('SELECT structure_edition FROM books WHERE id = ?').pluck().get(bookId)).toBeNull();
      expect(count(database, "structure_sets WHERE stage = 'frozen'")).toBe(0);
    });
  });

  it('unfreezes the current fresh edition into revision 1 with globally new lineage ids', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-to-unfreeze');
      const frozen = write(database, () => repository.freezeCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: draft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      }));
      let nodeIndex = 0;
      let rangeIndex = 0;
      const reopened = write(database, () => repository.createFromFrozen({
        bookId, frozenSetId: frozen.id,
        ids: {
          createSetId: () => 'unfrozen-draft' as StructureSetId,
          createNodeId: () => `unfrozen-node-${++nodeIndex}` as StructureNodeId,
          createRangeId: () => `unfrozen-range-${++rangeIndex}` as StorySegmentRangeId,
        }, now,
      }));
      expect(reopened).toMatchObject({
        id: 'unfrozen-draft', originSetId: frozen.id, stage: 'draft', draftRevision: 1,
      });
      expect(new Set(reopened.nodes.map(({ id }) => id))).not.toContain(frozen.nodes[0].id);
      expect(reopened.nodes.map(({ originId }) => originId)).toEqual(frozen.nodes.map(({ id }) => id));
      expect(reopened.storyRanges.map(({ originId }) => originId)).toEqual(frozen.storyRanges.map(({ id }) => id));
      expect(database.prepare('SELECT is_current FROM structure_sets WHERE id = ?').pluck().get(frozen.id)).toBe(1);
    });
  });

  it('rejects unfreeze when a draft exists or the selected frozen edition is stale', () => {
    withDatabase((database) => {
      const { repository, draft } = seededDraft(database, 'draft-unfreeze-guards');
      const frozen = write(database, () => repository.freezeCurrent({
        bookId, draftSetId: draft.id, expectedDraftRevision: 1,
        currentSourceSnapshot: draft.sourceSnapshot, sourceText: 'x'.repeat(100), now,
      }));
      let guardNodeIndex = 0;
      let guardRangeIndex = 0;
      const ids = {
        createSetId: () => 'guard-draft' as StructureSetId,
        createNodeId: () => `guard-node-${++guardNodeIndex}` as StructureNodeId,
        createRangeId: () => `guard-range-${++guardRangeIndex}` as StorySegmentRangeId,
      };
      write(database, () => repository.createFromFrozen({ bookId, frozenSetId: frozen.id, ids, now }));
      expectRepositoryError(() => write(database, () => repository.createFromFrozen({
        bookId, frozenSetId: frozen.id, ids, now,
      })), 'draft_already_exists', []);
      database.prepare("UPDATE structure_sets SET is_current = 0 WHERE stage = 'draft'").run();
      database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
      expectRepositoryError(() => write(database, () => repository.createFromFrozen({
        bookId, frozenSetId: frozen.id, ids, now,
      })), 'frozen_stale', []);
    });
  });
});

function withDatabase(run: (database: SqliteDatabase) => void): void {
  const database = openSqliteDatabase(':memory:');
  try {
    runMigrations(database, APP_MIGRATIONS);
    run(database);
  } finally {
    database.close();
  }
}

function write<T>(database: SqliteDatabase, operation: () => T): T {
  return database.transaction(operation)();
}

function seededDraft(database: SqliteDatabase, id: string) {
  seedCandidate(database);
  let nodeIndex = 0;
  const repository = new StructureDraftRepository(database);
  const draft = write(database, () => repository.createFromCandidate({
    bookId,
    candidateSetId,
    ids: {
      createSetId: () => id as StructureSetId,
      createNodeId: () => `draft-node-${++nodeIndex}` as StructureNodeId,
      createRangeId: () => 'draft-range-1' as StorySegmentRangeId,
    },
    now,
  }));
  return { repository, draft };
}

function seedCandidate(database: SqliteDatabase): void {
  database.exec(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
      VALUES (1, 'library-1', 'Library', '0.1.0', '${now}', '${now}');
    INSERT INTO books (id, title, created_at, updated_at)
      VALUES ('book-1', 'Book', '${now}', '${now}');
    INSERT INTO source_texts (id, book_id, original_file_name, size_bytes, format,
      content_hash, encoding, source_edition, relative_path, imported_at)
      VALUES ('source-1', 'book-1', 'book.md', 100, 'md', 'sha256:source',
        'utf-8', 1, 'source/source-1/book.md', '${now}');
    UPDATE books SET current_source_text_id = 'source-1' WHERE id = 'book-1';
    INSERT INTO jobs (id, book_id, kind, state, completed_units, total_units,
      payload_schema_version, payload_json, created_at, updated_at)
      VALUES ('job-1', 'book-1', 'structure_detection', 'completed', 1, 1, 1,
        '{"title":"Detect structure","sourceTextId":"source-1","sourceTextEdition":1,"contentHash":"sha256:source"}',
        '${now}', '${now}');
    INSERT INTO structure_detection_runs (id, job_id, book_id, source_text_id,
      source_text_edition, source_content_hash, decoded_text_length, offset_unit,
      state, failure_reason, created_at, updated_at, run_sequence)
      VALUES ('run-1', 'job-1', 'book-1', 'source-1', 1, 'sha256:source', 100,
        'utf16_code_unit', 'completed', NULL, '${now}', '${now}', 1);
  `);
  new StructureCandidateRepository(database).replaceCurrentCandidate(candidate());
}

function candidate(): CandidateStructureSet {
  const rootId = 'candidate-root' as StructureNodeId;
  const firstId = 'candidate-chapter-1' as StructureNodeId;
  const secondId = 'candidate-chapter-2' as StructureNodeId;
  return {
    id: candidateSetId, originSetId: null, bookId,
    sourceSnapshot: { sourceTextId: 'source-1' as CandidateStructureSet['sourceSnapshot']['sourceTextId'],
      sourceTextEdition: 1, contentHash: 'sha256:source', decodedTextLength: 100,
      offsetUnit: 'utf16_code_unit' },
    nodes: [
      node(rootId, null, 'book', 0, 0, 100),
      node(firstId, rootId, 'chapter', 0, 0, 50),
      node(secondId, rootId, 'chapter', 1, 50, 100),
    ],
    storyRanges: [{
      id: 'candidate-range-1' as StorySegmentRangeId, originId: null, title: 'Whole story',
      startOffset: 0, endOffset: 100, coveredChapterIds: [firstId, secondId],
      suggestedFunctionTags: [], boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 100 }],
      startReason: 'start', endReason: 'end',
      confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
    }],
    storyRangeMode: 'included', createdAt: now, updatedAt: now, stage: 'candidate',
    detectionRunId: 'run-1' as StructureDetectionRunId, draftRevision: null, structureEdition: null,
  };
}

function node(id: StructureNodeId, parentId: StructureNodeId | null, kind: 'book' | 'chapter', order: number, startOffset: number, endOffset: number) {
  return { id, originId: null, kind, title: id, parentId, order, startOffset, endOffset,
    heading: null, confidence: { score: 1, level: 'high' as const, lowConfidenceResolution: null } };
}

function expectRepositoryError(operation: () => unknown, reason: string, blockers: string[]): void {
  try {
    operation();
    throw new Error('Expected StructureDraftRepositoryError.');
  } catch (error) {
    expect(error).toBeInstanceOf(StructureDraftRepositoryError);
    expect(error).toMatchObject({ reason, blockers: expect.arrayContaining(blockers) });
  }
}

function count(database: SqliteDatabase, suffix: string): number {
  return database.prepare(`SELECT COUNT(*) FROM ${suffix}`).pluck().get() as number;
}
function revision(database: SqliteDatabase, id: StructureSetId): number {
  return database.prepare('SELECT draft_revision FROM structure_sets WHERE id = ?').pluck().get(id) as number;
}
function title(database: SqliteDatabase, id: StructureNodeId): string {
  return database.prepare('SELECT title FROM structure_nodes WHERE id = ?').pluck().get(id) as string;
}
function currentCandidate(database: SqliteDatabase): unknown {
  return database.prepare("SELECT id FROM structure_sets WHERE stage = 'candidate' AND is_current = 1").pluck().get();
}
