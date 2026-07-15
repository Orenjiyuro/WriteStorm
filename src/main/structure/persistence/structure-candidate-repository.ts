import type { SqliteDatabase } from '../../db/sqlite';
import { candidateStructureSetSchema } from '../../../shared/contracts/structure';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  StorySegmentRangeId,
  StructureNodeId,
  StructureSetId,
  StructureSetNodeDto,
} from '../../../shared/domain';

type DetectionRunSnapshotRow = {
  book_id: string;
  source_text_id: string;
  source_text_edition: number;
  source_content_hash: string;
  decoded_text_length: number;
  offset_unit: string;
};

type CandidateSetRow = {
  id: string;
  origin_set_id: string | null;
  book_id: string;
  source_text_id: string;
  source_text_edition: number;
  source_content_hash: string;
  decoded_text_length: number;
  offset_unit: 'utf16_code_unit';
  detection_run_id: string;
  story_range_mode: CandidateStructureSet['storyRangeMode'];
  created_at: string;
  updated_at: string;
};

type StructureNodeRow = {
  id: string;
  origin_id: string | null;
  kind: StructureSetNodeDto['kind'];
  title: string;
  parent_id: string | null;
  sort_order: number;
  start_offset: number;
  end_offset: number;
  raw_heading_text: string | null;
  heading_start_offset: number | null;
  heading_end_offset: number | null;
  confidence_score: number;
  confidence_level: StructureSetNodeDto['confidence']['level'];
  low_confidence_resolution: StructureSetNodeDto['confidence']['lowConfidenceResolution'];
};

type StoryRangeRow = {
  id: string;
  origin_id: string | null;
  title: string;
  start_offset: number;
  end_offset: number;
  suggested_function_tags_json: string;
  boundary_evidence_json: string;
  start_reason: string;
  end_reason: string;
  confidence_score: number;
  confidence_level: CandidateStructureSet['storyRanges'][number]['confidence']['level'];
  low_confidence_resolution: CandidateStructureSet['storyRanges'][number]['confidence']['lowConfidenceResolution'];
};

export class StructureCandidateRepository {
  constructor(private readonly database: SqliteDatabase) {}

  replaceCurrentCandidate(candidateInput: CandidateStructureSet): void {
    const candidate = candidateStructureSetSchema.parse(candidateInput);
    const replaceCandidate = this.database.transaction(() => {
      this.assertDetectionRunMatchesCandidate(candidate);
      this.database.prepare(`
        UPDATE structure_sets
        SET is_current = 0, updated_at = ?
        WHERE book_id = ? AND stage = 'candidate' AND is_current = 1
      `).run(candidate.updatedAt, candidate.bookId);
      this.insertCandidateSet(candidate);
      this.insertNodes(candidate);
      this.insertStoryRanges(candidate);
    });

    replaceCandidate();
  }

  getCurrentCandidate(bookId: BreakdownBookId): CandidateStructureSet | null {
    const set = this.database.prepare(`
      SELECT
        id, origin_set_id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, detection_run_id, story_range_mode,
        created_at, updated_at
      FROM structure_sets
      WHERE book_id = ? AND stage = 'candidate' AND is_current = 1
    `).get(bookId) as CandidateSetRow | undefined;

    if (!set) {
      return null;
    }

    const nodes = this.readNodes(set.id);
    const storyRanges = this.readStoryRanges(set.id);
    return candidateStructureSetSchema.parse({
      id: set.id,
      originSetId: set.origin_set_id as StructureSetId | null,
      bookId: set.book_id,
      sourceSnapshot: {
        sourceTextId: set.source_text_id,
        sourceTextEdition: set.source_text_edition,
        contentHash: set.source_content_hash,
        decodedTextLength: set.decoded_text_length,
        offsetUnit: set.offset_unit,
      },
      nodes,
      storyRanges,
      storyRangeMode: set.story_range_mode,
      createdAt: set.created_at,
      updatedAt: set.updated_at,
      stage: 'candidate',
      detectionRunId: set.detection_run_id,
      draftRevision: null,
      structureEdition: null,
    });
  }

  private assertDetectionRunMatchesCandidate(candidate: CandidateStructureSet): void {
    const run = this.database.prepare(`
      SELECT
        book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit
      FROM structure_detection_runs
      WHERE id = ?
    `).get(candidate.detectionRunId) as DetectionRunSnapshotRow | undefined;
    const snapshot = candidate.sourceSnapshot;

    if (!run ||
      run.book_id !== candidate.bookId ||
      run.source_text_id !== snapshot.sourceTextId ||
      run.source_text_edition !== snapshot.sourceTextEdition ||
      run.source_content_hash !== snapshot.contentHash ||
      run.decoded_text_length !== snapshot.decodedTextLength ||
      run.offset_unit !== snapshot.offsetUnit) {
      throw new Error('Candidate source snapshot must match its detection run.');
    }
  }

  private insertCandidateSet(candidate: CandidateStructureSet): void {
    const source = candidate.sourceSnapshot;
    this.database.prepare(`
      INSERT INTO structure_sets (
        id, origin_set_id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
        draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?, NULL, NULL, NULL, 1, ?, ?)
    `).run(
      candidate.id,
      candidate.originSetId,
      candidate.bookId,
      source.sourceTextId,
      source.sourceTextEdition,
      source.contentHash,
      source.decodedTextLength,
      source.offsetUnit,
      candidate.detectionRunId,
      candidate.storyRangeMode,
      candidate.createdAt,
      candidate.updatedAt,
    );
  }

  private insertNodes(candidate: CandidateStructureSet): void {
    const insert = this.database.prepare(`
      INSERT INTO structure_nodes (
        id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
        start_offset, end_offset, raw_heading_text, heading_start_offset,
        heading_end_offset, confidence_score, confidence_level,
        low_confidence_resolution, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const remaining = [...candidate.nodes];
    const insertedIds = new Set<StructureNodeId>();

    while (remaining.length > 0) {
      const insertableIndex = remaining.findIndex((node) =>
        node.parentId === null || insertedIds.has(node.parentId),
      );

      if (insertableIndex < 0) {
        throw new Error('Candidate structure nodes must form a parent-resolvable tree.');
      }

      const [node] = remaining.splice(insertableIndex, 1);
      insert.run(
        node.id,
        candidate.id,
        node.originId,
        node.kind,
        node.title,
        node.parentId,
        node.order,
        node.startOffset,
        node.endOffset,
        node.heading?.rawHeadingText ?? null,
        node.heading?.headingStartOffset ?? null,
        node.heading?.headingEndOffset ?? null,
        node.confidence.score,
        node.confidence.level,
        node.confidence.lowConfidenceResolution,
        candidate.createdAt,
        candidate.updatedAt,
      );
      insertedIds.add(node.id);
    }
  }

  private insertStoryRanges(candidate: CandidateStructureSet): void {
    const insertRange = this.database.prepare(`
      INSERT INTO story_segment_ranges (
        id, structure_set_id, origin_id, title, start_offset, end_offset,
        suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
        confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertChapter = this.database.prepare(`
      INSERT INTO story_segment_range_chapters (
        story_segment_range_id, chapter_id, sort_order
      ) VALUES (?, ?, ?)
    `);

    for (const range of candidate.storyRanges) {
      insertRange.run(
        range.id,
        candidate.id,
        range.originId,
        range.title,
        range.startOffset,
        range.endOffset,
        JSON.stringify(range.suggestedFunctionTags),
        JSON.stringify(range.boundaryEvidence),
        range.startReason,
        range.endReason,
        range.confidence.score,
        range.confidence.level,
        range.confidence.lowConfidenceResolution,
        candidate.createdAt,
        candidate.updatedAt,
      );
      range.coveredChapterIds.forEach((chapterId, order) => {
        insertChapter.run(range.id, chapterId, order);
      });
    }
  }

  private readNodes(structureSetId: string): CandidateStructureSet['nodes'] {
    const rows = this.database.prepare(`
      SELECT
        id, origin_id, kind, title, parent_id, sort_order, start_offset, end_offset,
        raw_heading_text, heading_start_offset, heading_end_offset,
        confidence_score, confidence_level, low_confidence_resolution
      FROM structure_nodes
      WHERE structure_set_id = ?
      ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END, start_offset, sort_order
    `).all(structureSetId) as StructureNodeRow[];

    return rows.map((row) => ({
      id: row.id as StructureNodeId,
      originId: row.origin_id as StructureNodeId | null,
      kind: row.kind,
      title: row.title,
      parentId: row.parent_id as StructureNodeId | null,
      order: row.sort_order,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      heading: readHeading(row),
      confidence: {
        score: row.confidence_score,
        level: row.confidence_level,
        lowConfidenceResolution: row.low_confidence_resolution,
      },
    }));
  }

  private readStoryRanges(structureSetId: string): CandidateStructureSet['storyRanges'] {
    const rows = this.database.prepare(`
      SELECT
        id, origin_id, title, start_offset, end_offset,
        suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
        confidence_score, confidence_level, low_confidence_resolution
      FROM story_segment_ranges
      WHERE structure_set_id = ?
      ORDER BY start_offset, end_offset, id
    `).all(structureSetId) as StoryRangeRow[];
    const readChapterIds = this.database.prepare(`
      SELECT chapter_id
      FROM story_segment_range_chapters
      WHERE story_segment_range_id = ?
      ORDER BY sort_order
    `).pluck();

    return rows.map((row) => ({
      id: row.id as StorySegmentRangeId,
      originId: row.origin_id as StorySegmentRangeId | null,
      title: row.title,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      coveredChapterIds: readChapterIds.all(row.id) as StructureNodeId[],
      suggestedFunctionTags: JSON.parse(row.suggested_function_tags_json) as string[],
      boundaryEvidence: JSON.parse(row.boundary_evidence_json) as CandidateStructureSet['storyRanges'][number]['boundaryEvidence'],
      startReason: row.start_reason,
      endReason: row.end_reason,
      confidence: {
        score: row.confidence_score,
        level: row.confidence_level,
        lowConfidenceResolution: row.low_confidence_resolution,
      },
    }));
  }
}

function readHeading(row: StructureNodeRow): StructureSetNodeDto['heading'] {
  if (row.raw_heading_text === null) {
    return null;
  }

  if (row.heading_start_offset === null || row.heading_end_offset === null) {
    throw new Error('Persisted structure heading offsets must be present with heading text.');
  }

  return {
    rawHeadingText: row.raw_heading_text,
    headingStartOffset: row.heading_start_offset,
    headingEndOffset: row.heading_end_offset,
  };
}
