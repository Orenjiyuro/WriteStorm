import { draftStructureSetSchema, frozenStructureSetSchema } from '../../../shared/contracts/structure';
import type {
  BreakdownBookId,
  DraftStructureSet,
  FrozenStructureSet,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSourceSnapshot,
  StructureSetId,
} from '../../../shared/domain';
import type { SqliteDatabase } from '../../db/sqlite';
import { StructureCandidateRepository } from './structure-candidate-repository';
import { StructureDetectionRunRepository } from './structure-detection-run-repository';
import { validateDraftForFreeze } from '../validation/structure-freeze-validator';

export type StructureDraftRepositoryErrorReason =
  | 'candidate_not_found'
  | 'candidate_stale'
  | 'draft_already_exists'
  | 'draft_not_found'
  | 'draft_revision_mismatch'
  | 'draft_stale'
  | 'draft_validation_failed'
  | 'frozen_not_found'
  | 'frozen_stale'
  | 'node_not_found'
  | 'node_not_low_confidence'
  | 'range_not_found'
  | 'range_not_low_confidence'
  | 'structure_reference_blocked';

export class StructureDraftRepositoryError extends Error {
  constructor(
    readonly reason: StructureDraftRepositoryErrorReason,
    readonly revision?: { readonly expected: number; readonly actual: number },
    readonly blockers: readonly string[] = [],
  ) {
    super(reason);
    this.name = 'StructureDraftRepositoryError';
  }
}

export type StructureDraftIdFactory = {
  readonly createSetId: () => StructureSetId;
  readonly createNodeId: () => StructureNodeId;
  readonly createRangeId: () => StorySegmentRangeId;
};

type CurrentSourceRow = {
  id: string;
  source_edition: number;
  content_hash: string;
};

type DraftSetRow = {
  id: string; origin_set_id: string; book_id: string; source_text_id: string;
  source_text_edition: number; source_content_hash: string; decoded_text_length: number;
  offset_unit: 'utf16_code_unit'; story_range_mode: DraftStructureSet['storyRangeMode'];
  draft_revision: number; created_at: string; updated_at: string;
};

type DraftNodeRow = {
  id: string; origin_id: string | null; kind: DraftStructureSet['nodes'][number]['kind'];
  title: string; parent_id: string | null; sort_order: number; start_offset: number; end_offset: number;
  raw_heading_text: string | null; heading_start_offset: number | null; heading_end_offset: number | null;
  confidence_score: number; confidence_level: DraftStructureSet['nodes'][number]['confidence']['level'];
  low_confidence_resolution: DraftStructureSet['nodes'][number]['confidence']['lowConfidenceResolution'];
};

type DraftRangeRow = {
  id: string; origin_id: string | null; title: string; start_offset: number; end_offset: number;
  suggested_function_tags_json: string; boundary_evidence_json: string; start_reason: string; end_reason: string;
  confidence_score: number; confidence_level: DraftStructureSet['storyRanges'][number]['confidence']['level'];
  low_confidence_resolution: DraftStructureSet['storyRanges'][number]['confidence']['lowConfidenceResolution'];
};

export type StructureNodeMetadataCommand =
  | { readonly type: 'add-node'; readonly kind: 'volume' | 'chapter'; readonly title: string; readonly parentId: StructureNodeId; readonly order: number; readonly startOffset: number; readonly endOffset: number }
  | { readonly type: 'rename-node'; readonly nodeId: StructureNodeId; readonly title: string }
  | { readonly type: 'accept-node-low-confidence'; readonly nodeId: StructureNodeId }
  | { readonly type: 'set-node-span'; readonly nodeId: StructureNodeId; readonly startOffset: number; readonly endOffset: number }
  | { readonly type: 'move-node'; readonly nodeId: StructureNodeId; readonly parentId: StructureNodeId | null; readonly order: number }
  | { readonly type: 'remove-node'; readonly nodeId: StructureNodeId };

export type StructureRangeMetadataCommand =
  | { readonly type: 'rename-range'; readonly rangeId: StorySegmentRangeId; readonly title: string }
  | { readonly type: 'set-range-function-tags'; readonly rangeId: StorySegmentRangeId; readonly functionTags: readonly string[] }
  | { readonly type: 'accept-range-low-confidence'; readonly rangeId: StorySegmentRangeId };

export type StructureRangeGeometryCommand =
  | { readonly type: 'set-range-span'; readonly rangeId: StorySegmentRangeId; readonly startOffset: number; readonly endOffset: number }
  | { readonly type: 'set-range-coverage'; readonly rangeId: StorySegmentRangeId; readonly coveredChapterIds: readonly StructureNodeId[] }
  | {
    readonly type: 'set-range-geometry'; readonly rangeId: StorySegmentRangeId;
    readonly startOffset: number; readonly endOffset: number;
    readonly coveredChapterIds: readonly StructureNodeId[];
    readonly boundaryEvidence: readonly DraftStructureSet['storyRanges'][number]['boundaryEvidence'][number][];
  };

export type StructureRangeCrudCommand =
  | {
    readonly type: 'add-range'; readonly title: string; readonly startOffset: number; readonly endOffset: number;
    readonly coveredChapterIds: readonly StructureNodeId[]; readonly functionTags: readonly string[];
    readonly boundaryEvidence: readonly DraftStructureSet['storyRanges'][number]['boundaryEvidence'][number][];
    readonly startReason: string; readonly endReason: string;
  }
  | { readonly type: 'remove-range'; readonly rangeId: StorySegmentRangeId };

export type StructureStoryRangeModeCommand = {
  readonly type: 'set-story-range-mode';
  readonly mode: DraftStructureSet['storyRangeMode'];
};

export type StructureRangeCommand = StructureRangeMetadataCommand | StructureRangeGeometryCommand
  | StructureRangeCrudCommand | StructureStoryRangeModeCommand;

export class StructureDraftRepository {
  constructor(private readonly database: SqliteDatabase) {}

  createManual(input: {
    readonly bookId: BreakdownBookId;
    readonly bookTitle: string;
    readonly expectedFailedDetectionRunId: StructureDetectionRunId;
    readonly sourceSnapshot: StructureSourceSnapshot;
    readonly createSetId: () => StructureSetId;
    readonly createNodeId: () => StructureNodeId;
    readonly now: string;
  }): DraftStructureSet {
    if (this.findCurrentDraft(input.bookId)) {
      throw new StructureDraftRepositoryError('draft_already_exists');
    }
    if (this.getCurrentFrozen(input.bookId)) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['current_frozen_requires_unfreeze'],
      );
    }
    const latestRun = new StructureDetectionRunRepository(this.database)
      .findLatestByBook(input.bookId)?.detectionRun;
    if (latestRun?.state === 'queued' || latestRun?.state === 'running') {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['structure_detection_in_progress'],
      );
    }
    if (!latestRun || latestRun.id !== input.expectedFailedDetectionRunId) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['failed_detection_run_changed'],
      );
    }
    if (latestRun.state !== 'failed') {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['manual_draft_requires_failed_detection'],
      );
    }
    if (latestRun.sourceSnapshot.sourceTextId !== input.sourceSnapshot.sourceTextId ||
      latestRun.sourceSnapshot.sourceTextEdition !== input.sourceSnapshot.sourceTextEdition ||
      latestRun.sourceSnapshot.contentHash !== input.sourceSnapshot.contentHash) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['failed_detection_source_changed'],
      );
    }
    const candidate = new StructureCandidateRepository(this.database)
      .getCurrentCandidate(input.bookId);
    if (candidate && candidate.sourceSnapshot.sourceTextId === input.sourceSnapshot.sourceTextId &&
      candidate.sourceSnapshot.sourceTextEdition === input.sourceSnapshot.sourceTextEdition &&
      candidate.sourceSnapshot.contentHash === input.sourceSnapshot.contentHash) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['fresh_candidate_requires_draft'],
      );
    }
    const source = this.database.prepare(`SELECT source_texts.id, source_texts.source_edition,
      source_texts.content_hash FROM books JOIN source_texts
      ON source_texts.id = books.current_source_text_id AND source_texts.book_id = books.id
      WHERE books.id = ?`).get(input.bookId) as CurrentSourceRow | undefined;
    if (!source || source.id !== input.sourceSnapshot.sourceTextId ||
      source.source_edition !== input.sourceSnapshot.sourceTextEdition ||
      source.content_hash !== input.sourceSnapshot.contentHash) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    const draft = draftStructureSetSchema.parse({
      id: input.createSetId(), originSetId: null, bookId: input.bookId,
      sourceSnapshot: input.sourceSnapshot,
      nodes: [{
        id: input.createNodeId(), originId: null, kind: 'book', title: input.bookTitle,
        parentId: null, order: 0, startOffset: 0,
        endOffset: input.sourceSnapshot.decodedTextLength, heading: null,
        confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
      }],
      storyRanges: [], storyRangeMode: 'included', stage: 'draft', detectionRunId: null,
      draftRevision: 1, structureEdition: null, createdAt: input.now, updatedAt: input.now,
    });
    this.insertDraft(draft);
    return draft;
  }

  createFromCandidate(input: {
    readonly bookId: BreakdownBookId;
    readonly candidateSetId: StructureSetId;
    readonly replacementFrozenSetId?: StructureSetId;
    readonly ids: StructureDraftIdFactory;
    readonly now: string;
  }): DraftStructureSet {
    const candidate = new StructureCandidateRepository(this.database).getCurrentCandidate(input.bookId);
    if (!candidate || candidate.id !== input.candidateSetId) {
      throw new StructureDraftRepositoryError('candidate_not_found');
    }
    const existingDraft = this.database.prepare(`
      SELECT 1 FROM structure_sets
      WHERE book_id = ? AND stage = 'draft' AND is_current = 1
    `).get(input.bookId);
    if (existingDraft) throw new StructureDraftRepositoryError('draft_already_exists');
    const currentFrozen = this.database.prepare(`
      SELECT id, source_text_id, source_text_edition, source_content_hash
      FROM structure_sets
      WHERE book_id = ? AND stage = 'frozen' AND is_current = 1
    `).get(input.bookId) as {
      id: string; source_text_id: string; source_text_edition: number;
      source_content_hash: string;
    } | undefined;
    if (currentFrozen && input.replacementFrozenSetId === undefined) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['current_frozen_requires_unfreeze'],
      );
    }
    if (!currentFrozen && input.replacementFrozenSetId !== undefined) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['replacement_requires_current_frozen'],
      );
    }
    if (currentFrozen && currentFrozen.id !== input.replacementFrozenSetId) {
      throw new StructureDraftRepositoryError(
        'structure_reference_blocked', undefined, ['replacement_frozen_changed'],
      );
    }

    const source = this.database.prepare(`
      SELECT source_texts.id, source_texts.source_edition, source_texts.content_hash
      FROM books
      JOIN source_texts
        ON source_texts.id = books.current_source_text_id
        AND source_texts.book_id = books.id
      WHERE books.id = ?
    `).get(input.bookId) as CurrentSourceRow | undefined;
    if (!source || source.id !== candidate.sourceSnapshot.sourceTextId ||
      source.source_edition !== candidate.sourceSnapshot.sourceTextEdition ||
      source.content_hash !== candidate.sourceSnapshot.contentHash) {
      throw new StructureDraftRepositoryError('candidate_stale');
    }
    if (currentFrozen) {
      const frozenIsStale = currentFrozen.source_text_id !== source.id ||
        currentFrozen.source_text_edition !== source.source_edition ||
        currentFrozen.source_content_hash !== source.content_hash;
      if (!frozenIsStale) {
        throw new StructureDraftRepositoryError(
          'structure_reference_blocked', undefined, ['replacement_requires_stale_frozen'],
        );
      }
      const candidateRun = candidate.detectionRunId === null ? null
        : new StructureDetectionRunRepository(this.database).getById(candidate.detectionRunId);
      if (!candidateRun || candidateRun.detectionRun.state !== 'completed') {
        throw new StructureDraftRepositoryError(
          'structure_reference_blocked', undefined, ['replacement_candidate_run_not_completed'],
        );
      }
      const runSnapshot = candidateRun.detectionRun.sourceSnapshot;
      if (candidateRun.detectionRun.bookId !== input.bookId ||
        runSnapshot.sourceTextId !== candidate.sourceSnapshot.sourceTextId ||
        runSnapshot.sourceTextEdition !== candidate.sourceSnapshot.sourceTextEdition ||
        runSnapshot.contentHash !== candidate.sourceSnapshot.contentHash ||
        runSnapshot.decodedTextLength !== candidate.sourceSnapshot.decodedTextLength) {
        throw new StructureDraftRepositoryError(
          'structure_reference_blocked', undefined, ['replacement_candidate_run_snapshot_mismatch'],
        );
      }
      if (candidate.sourceSnapshot.sourceTextEdition <= currentFrozen.source_text_edition) {
        throw new StructureDraftRepositoryError(
          'structure_reference_blocked', undefined, ['replacement_source_edition_not_newer'],
        );
      }
    }

    const nodeIds = new Map(candidate.nodes.map((node) => [node.id, input.ids.createNodeId()]));
    const draft = draftStructureSetSchema.parse({
      ...candidate,
      id: input.ids.createSetId(),
      originSetId: candidate.id,
      stage: 'draft',
      detectionRunId: null,
      draftRevision: 1,
      nodes: candidate.nodes.map((node) => ({
        ...node,
        id: nodeIds.get(node.id),
        originId: node.id,
        parentId: node.parentId === null ? null : nodeIds.get(node.parentId),
      })),
      storyRanges: candidate.storyRanges.map((range) => ({
        ...range,
        id: input.ids.createRangeId(),
        originId: range.id,
        coveredChapterIds: range.coveredChapterIds.map((id) => nodeIds.get(id)),
      })),
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.insertDraft(draft);
    return draft;
  }

  createFromFrozen(input: {
    readonly bookId: BreakdownBookId;
    readonly frozenSetId: StructureSetId;
    readonly ids: StructureDraftIdFactory;
    readonly now: string;
  }): DraftStructureSet {
    const frozen = this.database.prepare(`SELECT id, origin_set_id, book_id, source_text_id,
      source_text_edition, source_content_hash, decoded_text_length, offset_unit,
      story_range_mode, created_at, updated_at
      FROM structure_sets WHERE id = ? AND book_id = ? AND stage = 'frozen' AND is_current = 1`)
      .get(input.frozenSetId, input.bookId) as Omit<DraftSetRow, 'draft_revision'> | undefined;
    if (!frozen) throw new StructureDraftRepositoryError('frozen_not_found');
    const existingDraft = this.database.prepare(`SELECT 1 FROM structure_sets
      WHERE book_id = ? AND stage = 'draft' AND is_current = 1`).get(input.bookId);
    if (existingDraft) throw new StructureDraftRepositoryError('draft_already_exists');
    const source = this.database.prepare(`SELECT source_texts.id, source_texts.source_edition,
      source_texts.content_hash FROM books JOIN source_texts
      ON source_texts.id = books.current_source_text_id AND source_texts.book_id = books.id
      WHERE books.id = ?`).get(input.bookId) as CurrentSourceRow | undefined;
    if (!source || source.id !== frozen.source_text_id ||
      source.source_edition !== frozen.source_text_edition ||
      source.content_hash !== frozen.source_content_hash) {
      throw new StructureDraftRepositoryError('frozen_stale');
    }
    const nodes = this.database.prepare(`SELECT id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, raw_heading_text, heading_start_offset, heading_end_offset,
      confidence_score, confidence_level, low_confidence_resolution
      FROM structure_nodes WHERE structure_set_id = ?
      ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END, start_offset, sort_order`)
      .all(frozen.id) as DraftNodeRow[];
    const ranges = this.database.prepare(`SELECT id, origin_id, title, start_offset, end_offset,
      suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
      confidence_score, confidence_level, low_confidence_resolution
      FROM story_segment_ranges WHERE structure_set_id = ? ORDER BY start_offset, end_offset, id`)
      .all(frozen.id) as DraftRangeRow[];
    const coveredChapters = this.database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
      WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck();
    const nodeIds = new Map(nodes.map((node) => [node.id, input.ids.createNodeId()]));
    const draft = draftStructureSetSchema.parse({
      id: input.ids.createSetId(), originSetId: frozen.id, bookId: frozen.book_id,
      sourceSnapshot: {
        sourceTextId: frozen.source_text_id, sourceTextEdition: frozen.source_text_edition,
        contentHash: frozen.source_content_hash, decodedTextLength: frozen.decoded_text_length,
        offsetUnit: frozen.offset_unit,
      },
      nodes: nodes.map((node) => ({
        id: nodeIds.get(node.id), originId: node.id, kind: node.kind, title: node.title,
        parentId: node.parent_id === null ? null : nodeIds.get(node.parent_id), order: node.sort_order,
        startOffset: node.start_offset, endOffset: node.end_offset,
        heading: node.raw_heading_text === null ? null : {
          rawHeadingText: node.raw_heading_text, headingStartOffset: node.heading_start_offset,
          headingEndOffset: node.heading_end_offset,
        },
        confidence: { score: node.confidence_score, level: node.confidence_level,
          lowConfidenceResolution: node.low_confidence_resolution },
      })),
      storyRanges: ranges.map((range) => ({
        id: input.ids.createRangeId(), originId: range.id, title: range.title,
        startOffset: range.start_offset, endOffset: range.end_offset,
        coveredChapterIds: (coveredChapters.all(range.id) as string[]).map((id) => nodeIds.get(id)),
        suggestedFunctionTags: JSON.parse(range.suggested_function_tags_json),
        boundaryEvidence: JSON.parse(range.boundary_evidence_json),
        startReason: range.start_reason, endReason: range.end_reason,
        confidence: { score: range.confidence_score, level: range.confidence_level,
          lowConfidenceResolution: range.low_confidence_resolution },
      })),
      storyRangeMode: frozen.story_range_mode, createdAt: input.now, updatedAt: input.now,
      stage: 'draft', detectionRunId: null, draftRevision: 1, structureEdition: null,
    });
    this.insertDraft(draft);
    return draft;
  }

  discardCurrent(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly now: string;
  }): { readonly bookId: BreakdownBookId; readonly discardedDraftSetId: StructureSetId } {
    const row = this.database.prepare(`
      SELECT draft_revision
      FROM structure_sets
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1
    `).get(input.draftSetId, input.bookId) as { draft_revision: number } | undefined;
    if (!row) throw new StructureDraftRepositoryError('draft_not_found');
    if (row.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: row.draft_revision,
      });
    }
    this.database.prepare(`
      UPDATE structure_sets SET is_current = 0, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1
    `).run(input.now, input.draftSetId, input.bookId);
    return { bookId: input.bookId, discardedDraftSetId: input.draftSetId };
  }

  updateNodeMetadata(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly command: StructureNodeMetadataCommand;
    readonly createNodeId?: () => StructureNodeId;
    readonly now: string;
  }): DraftStructureSet {
    const draft = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (draft.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: draft.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, draft)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    if (input.command.type === 'add-node') {
      if (!input.createNodeId) throw new Error('add-node requires a node ID factory');
      this.addNode(input.draftSetId, input.command, draft.decoded_text_length, input.createNodeId, input.now);
      this.incrementDraftRevision(input.bookId, input.draftSetId, input.now);
      return this.getCurrentDraft(input.bookId, input.draftSetId);
    }
    const node = this.database.prepare(`
      SELECT kind, parent_id, sort_order, start_offset, end_offset,
        heading_start_offset, heading_end_offset,
        confidence_level, low_confidence_resolution
      FROM structure_nodes WHERE id = ? AND structure_set_id = ?
    `).get(input.command.nodeId, input.draftSetId) as {
      kind: DraftStructureSet['nodes'][number]['kind'];
      parent_id: string | null;
      sort_order: number;
      start_offset: number;
      end_offset: number;
      heading_start_offset: number | null;
      heading_end_offset: number | null;
      confidence_level: string;
      low_confidence_resolution: string | null;
    } | undefined;
    if (!node) throw new StructureDraftRepositoryError('node_not_found');

    if (input.command.type === 'rename-node') {
      if (input.command.title.trim().length === 0) {
        throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, ['node_title_blank']);
      }
      this.database.prepare(`UPDATE structure_nodes
        SET title = ?,
          low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
          updated_at = ?
        WHERE id = ? AND structure_set_id = ?`)
        .run(input.command.title, input.now, input.command.nodeId, input.draftSetId);
    } else if (input.command.type === 'accept-node-low-confidence') {
      if (node.confidence_level !== 'low' || node.low_confidence_resolution !== 'unresolved') {
        throw new StructureDraftRepositoryError('node_not_low_confidence');
      }
      this.database.prepare(`UPDATE structure_nodes
        SET low_confidence_resolution = 'accepted', updated_at = ?
        WHERE id = ? AND structure_set_id = ?`)
        .run(input.now, input.command.nodeId, input.draftSetId);
    } else if (input.command.type === 'set-node-span') {
      this.setNodeSpan(input.draftSetId, input.command, node, draft.decoded_text_length, input.now);
    } else if (input.command.type === 'move-node') {
      this.moveNode(input.draftSetId, input.command, node, input.now);
    } else {
      this.removeNode(input.draftSetId, input.command.nodeId, node, input.now);
    }
    this.incrementDraftRevision(input.bookId, input.draftSetId, input.now);
    return this.getCurrentDraft(input.bookId, input.draftSetId);
  }

  private addNode(
    draftSetId: StructureSetId,
    command: Extract<StructureNodeMetadataCommand, { type: 'add-node' }>,
    sourceLength: number,
    createNodeId: () => StructureNodeId,
    now: string,
  ): void {
    const blockers: string[] = [];
    if (command.title.trim().length === 0) blockers.push('node_title_blank');
    if (command.startOffset < 0 || command.endOffset <= command.startOffset || command.endOffset > sourceLength) blockers.push('source_bounds');
    const parent = this.database.prepare(`SELECT kind, start_offset, end_offset FROM structure_nodes
      WHERE id = ? AND structure_set_id = ?`).get(command.parentId, draftSetId) as {
      kind: DraftStructureSet['nodes'][number]['kind']; start_offset: number; end_offset: number;
    } | undefined;
    if (!parent) blockers.push(`parent:${command.parentId}`);
    if (parent && !((command.kind === 'volume' && parent.kind === 'book') ||
      (command.kind === 'chapter' && (parent.kind === 'book' || parent.kind === 'volume')))) blockers.push('invalid_parent_kind');
    if (parent && (command.startOffset < parent.start_offset || command.endOffset > parent.end_offset)) blockers.push('parent_span');
    if (command.kind === 'chapter') {
      const rangeCount = this.database.prepare(`SELECT COUNT(*) FROM story_segment_ranges
        WHERE structure_set_id = ?`).pluck().get(draftSetId) as number;
      if (rangeCount > 0) blockers.push('story_range_coverage_requires_geometry_update');
    }
    if (blockers.length > 0) throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
    const siblingCount = this.database.prepare(`SELECT COUNT(*) FROM structure_nodes
      WHERE structure_set_id = ? AND parent_id = ?`).pluck().get(draftSetId, command.parentId) as number;
    if (command.order > siblingCount) throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, ['order_out_of_bounds']);
    const nodeId = createNodeId();
    this.database.prepare(`UPDATE structure_nodes SET sort_order = sort_order + 1, updated_at = ?
      WHERE structure_set_id = ? AND parent_id = ? AND sort_order >= ?`)
      .run(now, draftSetId, command.parentId, command.order);
    this.database.prepare(`INSERT INTO structure_nodes (
      id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, raw_heading_text, heading_start_offset, heading_end_offset,
      confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 1, 'high', NULL, ?, ?)`)
      .run(nodeId, draftSetId, command.kind, command.title, command.parentId, command.order,
        command.startOffset, command.endOffset, now, now);
  }

  private incrementDraftRevision(bookId: BreakdownBookId, draftSetId: StructureSetId, now: string): void {
    this.database.prepare(`UPDATE structure_sets SET draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`).run(now, draftSetId, bookId);
  }

  updateRangeMetadata(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly command: StructureRangeMetadataCommand;
    readonly now: string;
  }): DraftStructureSet {
    const draft = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (draft.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: draft.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, draft)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    const range = this.database.prepare(`SELECT confidence_level, low_confidence_resolution
      FROM story_segment_ranges WHERE id = ? AND structure_set_id = ?`)
      .get(input.command.rangeId, input.draftSetId) as {
        confidence_level: string;
        low_confidence_resolution: string | null;
      } | undefined;
    if (!range) throw new StructureDraftRepositoryError('range_not_found');

    if (input.command.type === 'rename-range') {
      if (input.command.title.trim().length === 0) {
        throw new StructureDraftRepositoryError(
          'structure_reference_blocked', undefined, ['range_title_blank'],
        );
      }
      this.database.prepare(`UPDATE story_segment_ranges SET title = ?,
        low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
        updated_at = ? WHERE id = ? AND structure_set_id = ?`)
        .run(input.command.title, input.now, input.command.rangeId, input.draftSetId);
    } else if (input.command.type === 'set-range-function-tags') {
      this.database.prepare(`UPDATE story_segment_ranges SET suggested_function_tags_json = ?,
        low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
        updated_at = ? WHERE id = ? AND structure_set_id = ?`)
        .run(JSON.stringify(input.command.functionTags), input.now, input.command.rangeId, input.draftSetId);
    } else {
      if (range.confidence_level !== 'low' || range.low_confidence_resolution !== 'unresolved') {
        throw new StructureDraftRepositoryError('range_not_low_confidence');
      }
      this.database.prepare(`UPDATE story_segment_ranges
        SET low_confidence_resolution = 'accepted', updated_at = ?
        WHERE id = ? AND structure_set_id = ?`)
        .run(input.now, input.command.rangeId, input.draftSetId);
    }
    this.database.prepare(`UPDATE structure_sets SET draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .run(input.now, input.draftSetId, input.bookId);
    return this.getCurrentDraft(input.bookId, input.draftSetId);
  }

  updateRangeGeometry(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly command: StructureRangeGeometryCommand;
    readonly now: string;
  }): DraftStructureSet {
    const draft = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (draft.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: draft.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, draft)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    const range = this.database.prepare(`SELECT start_offset, end_offset,
      boundary_evidence_json FROM story_segment_ranges
      WHERE id = ? AND structure_set_id = ?`).get(input.command.rangeId, input.draftSetId) as {
        start_offset: number;
        end_offset: number;
        boundary_evidence_json: string;
      } | undefined;
    if (!range) throw new StructureDraftRepositoryError('range_not_found');

    if (input.command.type === 'set-range-geometry') {
      const blockers = this.atomicRangeGeometryBlockers(
        input.draftSetId, input.command, draft.decoded_text_length,
      );
      if (blockers.length > 0) {
        throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
      }
      this.database.prepare(`DELETE FROM story_segment_range_chapters
        WHERE story_segment_range_id = ?`).run(input.command.rangeId);
      this.database.prepare(`UPDATE story_segment_ranges SET start_offset = ?, end_offset = ?,
        boundary_evidence_json = ?,
        low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
        updated_at = ? WHERE id = ? AND structure_set_id = ?`)
        .run(input.command.startOffset, input.command.endOffset,
          JSON.stringify(input.command.boundaryEvidence), input.now,
          input.command.rangeId, input.draftSetId);
      const insert = this.database.prepare(`INSERT INTO story_segment_range_chapters
        (story_segment_range_id, chapter_id, sort_order) VALUES (?, ?, ?)`);
      input.command.coveredChapterIds.forEach((chapterId, order) =>
        insert.run(input.command.rangeId, chapterId, order));
    } else if (input.command.type === 'set-range-span') {
      const blockers = this.rangeSpanBlockers(input.draftSetId, input.command, range, draft.decoded_text_length);
      if (blockers.length > 0) {
        throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
      }
      this.database.prepare(`UPDATE story_segment_ranges SET start_offset = ?, end_offset = ?,
        low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
        updated_at = ? WHERE id = ? AND structure_set_id = ?`)
        .run(input.command.startOffset, input.command.endOffset, input.now,
          input.command.rangeId, input.draftSetId);
    } else {
      const blockers = this.rangeCoverageCommandBlockers(input.draftSetId, input.command, range);
      if (blockers.length > 0) {
        throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
      }
      this.database.prepare(`DELETE FROM story_segment_range_chapters
        WHERE story_segment_range_id = ?`).run(input.command.rangeId);
      const insert = this.database.prepare(`INSERT INTO story_segment_range_chapters
        (story_segment_range_id, chapter_id, sort_order) VALUES (?, ?, ?)`);
      input.command.coveredChapterIds.forEach((chapterId, order) =>
        insert.run(input.command.rangeId, chapterId, order));
      this.database.prepare(`UPDATE story_segment_ranges SET
        low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
        updated_at = ? WHERE id = ? AND structure_set_id = ?`)
        .run(input.now, input.command.rangeId, input.draftSetId);
    }
    this.database.prepare(`UPDATE structure_sets SET draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .run(input.now, input.draftSetId, input.bookId);
    return this.getCurrentDraft(input.bookId, input.draftSetId);
  }

  updateRangeCrud(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly command: StructureRangeCrudCommand;
    readonly createRangeId: () => StorySegmentRangeId;
    readonly now: string;
  }): DraftStructureSet {
    const draft = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (draft.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: draft.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, draft)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    if (input.command.type === 'remove-range') {
      const result = this.database.prepare(`DELETE FROM story_segment_ranges
        WHERE id = ? AND structure_set_id = ?`).run(input.command.rangeId, input.draftSetId);
      if (result.changes !== 1) throw new StructureDraftRepositoryError('range_not_found');
    } else {
      const blockers = [
        ...(draft.story_range_mode === 'skipped_by_user' ? ['story_range_mode_skipped'] : []),
        ...this.newRangeBlockers(input.draftSetId, input.command, draft.decoded_text_length),
      ];
      if (blockers.length > 0) {
        throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
      }
      const rangeId = input.createRangeId();
      this.database.prepare(`INSERT INTO story_segment_ranges (
        id, structure_set_id, origin_id, title, start_offset, end_offset,
        suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
        confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 1, 'high', NULL, ?, ?)`)
        .run(rangeId, input.draftSetId, input.command.title, input.command.startOffset,
          input.command.endOffset, JSON.stringify(input.command.functionTags),
          JSON.stringify(input.command.boundaryEvidence), input.command.startReason,
          input.command.endReason, input.now, input.now);
      const insertChapter = this.database.prepare(`INSERT INTO story_segment_range_chapters
        (story_segment_range_id, chapter_id, sort_order) VALUES (?, ?, ?)`);
      input.command.coveredChapterIds.forEach((chapterId, order) => insertChapter.run(rangeId, chapterId, order));
    }
    this.database.prepare(`UPDATE structure_sets SET draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .run(input.now, input.draftSetId, input.bookId);
    return this.getCurrentDraft(input.bookId, input.draftSetId);
  }

  setStoryRangeMode(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly mode: DraftStructureSet['storyRangeMode'];
    readonly now: string;
  }): DraftStructureSet {
    const draft = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (draft.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: draft.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, draft)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    if (input.mode === 'skipped_by_user') {
      this.database.prepare('DELETE FROM story_segment_ranges WHERE structure_set_id = ?')
        .run(input.draftSetId);
    }
    this.database.prepare(`UPDATE structure_sets SET story_range_mode = ?,
      draft_revision = draft_revision + 1, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .run(input.mode, input.now, input.draftSetId, input.bookId);
    return this.getCurrentDraft(input.bookId, input.draftSetId);
  }

  freezeCurrent(input: {
    readonly bookId: BreakdownBookId;
    readonly draftSetId: StructureSetId;
    readonly expectedDraftRevision: number;
    readonly currentSourceSnapshot: StructureSourceSnapshot;
    readonly sourceText: string;
    readonly now: string;
  }): FrozenStructureSet {
    const row = this.requireCurrentDraft(input.bookId, input.draftSetId);
    if (row.draft_revision !== input.expectedDraftRevision) {
      throw new StructureDraftRepositoryError('draft_revision_mismatch', {
        expected: input.expectedDraftRevision,
        actual: row.draft_revision,
      });
    }
    if (!this.sourceIsFresh(input.bookId, row)) {
      throw new StructureDraftRepositoryError('draft_stale');
    }
    const draft = this.getCurrentDraft(input.bookId, input.draftSetId);
    const validation = validateDraftForFreeze({
      draft,
      currentSourceSnapshot: input.currentSourceSnapshot,
      sourceText: input.sourceText,
    });
    if (!validation.valid) {
      throw new StructureDraftRepositoryError(
        'draft_validation_failed', undefined, validation.issues.map(({ code }) => code),
      );
    }
    const currentEdition = this.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(input.bookId) as number | null | undefined;
    if (currentEdition === undefined) throw new StructureDraftRepositoryError('draft_not_found');
    const structureEdition = (currentEdition ?? 0) + 1;
    this.database.prepare(`UPDATE structure_sets SET is_current = 0, updated_at = ?
      WHERE book_id = ? AND stage = 'frozen' AND is_current = 1`)
      .run(input.now, input.bookId);
    this.database.prepare(`UPDATE books SET structure_edition = ?, updated_at = ? WHERE id = ?`)
      .run(structureEdition, input.now, input.bookId);
    this.database.prepare(`UPDATE structure_sets SET stage = 'frozen', draft_revision = NULL,
      structure_edition = ?, frozen_at = ?, updated_at = ?
      WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .run(structureEdition, input.now, input.now, input.draftSetId, input.bookId);
    return frozenStructureSetSchema.parse({
      ...draft,
      stage: 'frozen',
      draftRevision: null,
      structureEdition,
      frozenAt: input.now,
      updatedAt: input.now,
    });
  }

  private newRangeBlockers(
    draftSetId: StructureSetId,
    command: Extract<StructureRangeCrudCommand, { type: 'add-range' }>,
    sourceLength: number,
  ): string[] {
    const blockers: string[] = [];
    if (command.title.trim().length === 0) blockers.push('range_title_blank');
    if (command.startReason.trim().length === 0) blockers.push('range_start_reason_blank');
    if (command.endReason.trim().length === 0) blockers.push('range_end_reason_blank');
    if (command.startOffset < 0 || command.endOffset <= command.startOffset || command.endOffset > sourceLength) {
      blockers.push('source_bounds');
    }
    command.boundaryEvidence.forEach((evidence, index) => {
      if (evidence.startOffset < command.startOffset || evidence.endOffset > command.endOffset) {
        blockers.push(`boundary-evidence:${index}`);
      }
    });
    const overlaps = this.database.prepare(`SELECT id FROM story_segment_ranges
      WHERE structure_set_id = ? AND start_offset < ? AND end_offset > ? ORDER BY id`)
      .pluck().all(draftSetId, command.endOffset, command.startOffset) as string[];
    blockers.push(...overlaps.map((id) => `range-overlap:${id}`));
    blockers.push(...this.rangeCoverageCommandBlockers(draftSetId, {
      type: 'set-range-coverage', rangeId: 'new-range-validation' as StorySegmentRangeId,
      coveredChapterIds: command.coveredChapterIds,
    }, { start_offset: command.startOffset, end_offset: command.endOffset }));
    return [...new Set(blockers)];
  }

  private rangeSpanBlockers(
    draftSetId: StructureSetId,
    command: Extract<StructureRangeGeometryCommand, { type: 'set-range-span' }>,
    range: { boundary_evidence_json: string },
    sourceLength: number,
  ): string[] {
    const blockers: string[] = [];
    if (command.startOffset < 0 || command.endOffset <= command.startOffset || command.endOffset > sourceLength) {
      blockers.push('source_bounds');
    }
    const evidence = JSON.parse(range.boundary_evidence_json) as Array<{ startOffset: number; endOffset: number }>;
    evidence.forEach((item, index) => {
      if (item.startOffset < command.startOffset || item.endOffset > command.endOffset) {
        blockers.push(`boundary-evidence:${index}`);
      }
    });
    const overlaps = this.database.prepare(`SELECT id FROM story_segment_ranges
      WHERE structure_set_id = ? AND id <> ? AND start_offset < ? AND end_offset > ? ORDER BY id`)
      .pluck().all(draftSetId, command.rangeId, command.endOffset, command.startOffset) as string[];
    blockers.push(...overlaps.map((id) => `range-overlap:${id}`));
    const expected = this.expectedChapterIds(draftSetId, command.startOffset, command.endOffset);
    const actual = this.coveredChapterIds(command.rangeId);
    if (!sameStringIds(expected, actual)) blockers.push('coverage_mismatch');
    return [...new Set(blockers)];
  }

  private atomicRangeGeometryBlockers(
    draftSetId: StructureSetId,
    command: Extract<StructureRangeGeometryCommand, { type: 'set-range-geometry' }>,
    sourceLength: number,
  ): string[] {
    const blockers: string[] = [];
    if (command.startOffset < 0 || command.endOffset <= command.startOffset || command.endOffset > sourceLength) {
      blockers.push('source_bounds');
    }
    command.boundaryEvidence.forEach((evidence, index) => {
      if (evidence.startOffset < command.startOffset || evidence.endOffset > command.endOffset) {
        blockers.push(`boundary-evidence:${index}`);
      }
    });
    const overlaps = this.database.prepare(`SELECT id FROM story_segment_ranges
      WHERE structure_set_id = ? AND id <> ? AND start_offset < ? AND end_offset > ? ORDER BY id`)
      .pluck().all(draftSetId, command.rangeId, command.endOffset, command.startOffset) as string[];
    blockers.push(...overlaps.map((id) => `range-overlap:${id}`));
    blockers.push(...this.rangeCoverageCommandBlockers(draftSetId, {
      type: 'set-range-coverage', rangeId: command.rangeId,
      coveredChapterIds: command.coveredChapterIds,
    }, { start_offset: command.startOffset, end_offset: command.endOffset }));
    return [...new Set(blockers)];
  }

  private rangeCoverageCommandBlockers(
    draftSetId: StructureSetId,
    command: Extract<StructureRangeGeometryCommand, { type: 'set-range-coverage' }>,
    range: { start_offset: number; end_offset: number },
  ): string[] {
    const blockers: string[] = [];
    const chapters = this.database.prepare(`SELECT id, start_offset, end_offset FROM structure_nodes
      WHERE structure_set_id = ? AND kind = 'chapter' ORDER BY start_offset, end_offset, id`)
      .all(draftSetId) as Array<{ id: string; start_offset: number; end_offset: number }>;
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const seen = new Set<string>();
    for (const id of command.coveredChapterIds) {
      if (seen.has(id)) blockers.push(`duplicate-chapter:${id}`);
      seen.add(id);
      if (!byId.has(id)) blockers.push(`chapter:${id}:missing`);
    }
    const resolved = command.coveredChapterIds.flatMap((id) => byId.get(id) ?? []);
    const ordered = [...resolved].sort((left, right) => left.start_offset - right.start_offset ||
      left.end_offset - right.end_offset || left.id.localeCompare(right.id));
    if (!sameStringIds(resolved.map(({ id }) => id), ordered.map(({ id }) => id))) blockers.push('chapter_order');
    const expected = this.expectedChapterIds(draftSetId, range.start_offset, range.end_offset);
    if (!sameStringIds(command.coveredChapterIds, expected)) blockers.push('coverage_mismatch');
    return [...new Set(blockers)];
  }

  private expectedChapterIds(draftSetId: StructureSetId, startOffset: number, endOffset: number): string[] {
    return this.database.prepare(`SELECT id FROM structure_nodes WHERE structure_set_id = ?
      AND kind = 'chapter' AND start_offset >= ? AND end_offset <= ?
      ORDER BY start_offset, end_offset, id`).pluck().all(draftSetId, startOffset, endOffset) as string[];
  }

  private coveredChapterIds(rangeId: StorySegmentRangeId): string[] {
    return this.database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
      WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck().all(rangeId) as string[];
  }

  private setNodeSpan(
    draftSetId: StructureSetId,
    command: Extract<StructureNodeMetadataCommand, { type: 'set-node-span' }>,
    node: {
      kind: DraftStructureSet['nodes'][number]['kind'];
      parent_id: string | null;
      heading_start_offset: number | null;
      heading_end_offset: number | null;
    },
    sourceLength: number,
    now: string,
  ): void {
    const blockers: string[] = [];
    if (command.startOffset < 0 || command.endOffset <= command.startOffset || command.endOffset > sourceLength) {
      blockers.push('source_bounds');
    }
    if (node.kind === 'book' && (command.startOffset !== 0 || command.endOffset !== sourceLength)) {
      blockers.push('root_coverage');
    }
    if (node.heading_start_offset !== null && node.heading_end_offset !== null &&
      (node.heading_start_offset < command.startOffset || node.heading_end_offset > command.endOffset)) {
      blockers.push('heading');
    }
    if (node.parent_id !== null) {
      const parent = this.database.prepare(`SELECT start_offset, end_offset FROM structure_nodes
        WHERE id = ? AND structure_set_id = ?`).get(node.parent_id, draftSetId) as {
        start_offset: number; end_offset: number;
      } | undefined;
      if (!parent || command.startOffset < parent.start_offset || command.endOffset > parent.end_offset) {
        blockers.push('parent_span');
      }
    }
    const children = this.database.prepare(`SELECT id, start_offset, end_offset FROM structure_nodes
      WHERE structure_set_id = ? AND parent_id = ? ORDER BY id`).all(draftSetId, command.nodeId) as Array<{
      id: string; start_offset: number; end_offset: number;
    }>;
    blockers.push(...children
      .filter((child) => child.start_offset < command.startOffset || child.end_offset > command.endOffset)
      .map((child) => `child:${child.id}`));
    blockers.push(...this.rangeCoverageBlockers(draftSetId, command));
    if (blockers.length > 0) {
      throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, [...new Set(blockers)]);
    }
    this.database.prepare(`UPDATE structure_nodes SET start_offset = ?, end_offset = ?,
      low_confidence_resolution = CASE WHEN confidence_level = 'low' THEN 'corrected' ELSE NULL END,
      updated_at = ? WHERE id = ? AND structure_set_id = ?`)
      .run(command.startOffset, command.endOffset, now, command.nodeId, draftSetId);
  }

  private rangeCoverageBlockers(
    draftSetId: StructureSetId,
    command: Extract<StructureNodeMetadataCommand, { type: 'set-node-span' }>,
  ): string[] {
    const chapters = this.database.prepare(`SELECT id, start_offset, end_offset FROM structure_nodes
      WHERE structure_set_id = ? AND kind = 'chapter' ORDER BY start_offset, end_offset, id`)
      .all(draftSetId) as Array<{ id: string; start_offset: number; end_offset: number }>;
    const ranges = this.database.prepare(`SELECT id, start_offset, end_offset FROM story_segment_ranges
      WHERE structure_set_id = ? ORDER BY id`).all(draftSetId) as Array<{
      id: string; start_offset: number; end_offset: number;
    }>;
    const covered = this.database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
      WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck();
    const hypothetical = chapters.map((chapter) => chapter.id === command.nodeId
      ? { ...chapter, start_offset: command.startOffset, end_offset: command.endOffset }
      : chapter).sort((left, right) => left.start_offset - right.start_offset ||
        left.end_offset - right.end_offset || left.id.localeCompare(right.id));
    return ranges.flatMap((range) => {
      const expected = hypothetical.filter((chapter) =>
        range.start_offset <= chapter.start_offset && range.end_offset >= chapter.end_offset).map(({ id }) => id);
      const actual = covered.all(range.id) as string[];
      return expected.length === actual.length && expected.every((id, index) => id === actual[index])
        ? []
        : [`story-range:${range.id}`];
    });
  }

  private moveNode(
    draftSetId: StructureSetId,
    command: Extract<StructureNodeMetadataCommand, { type: 'move-node' }>,
    node: { kind: DraftStructureSet['nodes'][number]['kind']; parent_id: string | null; start_offset: number; end_offset: number },
    now: string,
  ): void {
    const blockers: string[] = [];
    const parent = command.parentId === null ? null : this.database.prepare(`
      SELECT id, kind, start_offset, end_offset FROM structure_nodes
      WHERE id = ? AND structure_set_id = ?
    `).get(command.parentId, draftSetId) as {
      id: string; kind: DraftStructureSet['nodes'][number]['kind']; start_offset: number; end_offset: number;
    } | undefined;
    if (command.parentId !== null && !parent) blockers.push(`parent:${command.parentId}`);
    if (node.kind === 'book' && command.parentId !== null) blockers.push('invalid_parent_kind');
    if (node.kind !== 'book' && command.parentId === null) blockers.push('missing_parent');
    if (parent) {
      const validKind = node.kind === 'volume'
        ? parent.kind === 'book'
        : node.kind === 'chapter' && (parent.kind === 'book' || parent.kind === 'volume');
      if (!validKind) blockers.push('invalid_parent_kind');
      if (node.start_offset < parent.start_offset || node.end_offset > parent.end_offset) blockers.push('parent_span');
      const cycle = this.database.prepare(`WITH RECURSIVE descendants(id) AS (
        SELECT id FROM structure_nodes WHERE parent_id = ? AND structure_set_id = ?
        UNION ALL
        SELECT child.id FROM structure_nodes child JOIN descendants ON child.parent_id = descendants.id
        WHERE child.structure_set_id = ?
      ) SELECT 1 FROM descendants WHERE id = ?`).get(command.nodeId, draftSetId, draftSetId, command.parentId);
      if (command.parentId === command.nodeId || cycle) blockers.push('cycle');
    }
    const targetIds = this.siblingIds(draftSetId, command.parentId).filter((id) => id !== command.nodeId);
    if (command.order > targetIds.length) blockers.push('order_out_of_bounds');
    if (blockers.length > 0) {
      throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, [...new Set(blockers)]);
    }
    const oldParentId = node.parent_id as StructureNodeId | null;
    const oldIds = this.siblingIds(draftSetId, oldParentId).filter((id) => id !== command.nodeId);
    targetIds.splice(command.order, 0, command.nodeId);
    this.reindexSiblings(draftSetId, oldParentId, oldIds, now);
    this.database.prepare(`UPDATE structure_nodes SET parent_id = ?, updated_at = ?
      WHERE id = ? AND structure_set_id = ?`).run(command.parentId, now, command.nodeId, draftSetId);
    this.reindexSiblings(draftSetId, command.parentId, targetIds, now);
  }

  private removeNode(
    draftSetId: StructureSetId,
    nodeId: StructureNodeId,
    node: { kind: DraftStructureSet['nodes'][number]['kind']; parent_id: string | null },
    now: string,
  ): void {
    const blockers: string[] = [];
    if (node.kind === 'book') blockers.push('book_root');
    const childIds = this.database.prepare(`SELECT id FROM structure_nodes
      WHERE structure_set_id = ? AND parent_id = ? ORDER BY id`).pluck().all(draftSetId, nodeId) as string[];
    blockers.push(...childIds.map((id) => `child:${id}`));
    const rangeIds = this.database.prepare(`SELECT story_segment_range_id
      FROM story_segment_range_chapters WHERE chapter_id = ? ORDER BY story_segment_range_id`)
      .pluck().all(nodeId) as string[];
    blockers.push(...rangeIds.map((id) => `story-range:${id}`));
    if (blockers.length > 0) {
      throw new StructureDraftRepositoryError('structure_reference_blocked', undefined, blockers);
    }
    const parentId = node.parent_id as StructureNodeId | null;
    this.database.prepare(`DELETE FROM structure_nodes WHERE id = ? AND structure_set_id = ?`).run(nodeId, draftSetId);
    this.reindexSiblings(draftSetId, parentId, this.siblingIds(draftSetId, parentId), now);
  }

  private siblingIds(draftSetId: StructureSetId, parentId: StructureNodeId | null): StructureNodeId[] {
    return this.database.prepare(`SELECT id FROM structure_nodes WHERE structure_set_id = ?
      AND parent_id IS ? ORDER BY sort_order, id`).pluck().all(draftSetId, parentId) as StructureNodeId[];
  }

  private reindexSiblings(
    draftSetId: StructureSetId,
    parentId: StructureNodeId | null,
    ids: readonly StructureNodeId[],
    now: string,
  ): void {
    const update = this.database.prepare(`UPDATE structure_nodes SET sort_order = ?, updated_at = ?
      WHERE id = ? AND structure_set_id = ? AND parent_id IS ?`);
    ids.forEach((id, order) => update.run(order, now, id, draftSetId, parentId));
  }

  getCurrentDraft(bookId: BreakdownBookId, draftSetId: StructureSetId): DraftStructureSet {
    const set = this.requireCurrentDraft(bookId, draftSetId);
    const nodeRows = this.database.prepare(`SELECT id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, raw_heading_text, heading_start_offset, heading_end_offset,
      confidence_score, confidence_level, low_confidence_resolution
      FROM structure_nodes WHERE structure_set_id = ?
      ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END, start_offset, sort_order`).all(set.id) as DraftNodeRow[];
    const rangeRows = this.database.prepare(`SELECT id, origin_id, title, start_offset, end_offset,
      suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
      confidence_score, confidence_level, low_confidence_resolution
      FROM story_segment_ranges WHERE structure_set_id = ? ORDER BY start_offset, end_offset, id`)
      .all(set.id) as DraftRangeRow[];
    const chapters = this.database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
      WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck();
    return draftStructureSetSchema.parse({
      id: set.id,
      originSetId: set.origin_set_id,
      bookId: set.book_id,
      sourceSnapshot: {
        sourceTextId: set.source_text_id,
        sourceTextEdition: set.source_text_edition,
        contentHash: set.source_content_hash,
        decodedTextLength: set.decoded_text_length,
        offsetUnit: set.offset_unit,
      },
      nodes: nodeRows.map((node) => ({
        id: node.id, originId: node.origin_id, kind: node.kind, title: node.title,
        parentId: node.parent_id, order: node.sort_order, startOffset: node.start_offset,
        endOffset: node.end_offset,
        heading: node.raw_heading_text === null ? null : {
          rawHeadingText: node.raw_heading_text,
          headingStartOffset: node.heading_start_offset,
          headingEndOffset: node.heading_end_offset,
        },
        confidence: { score: node.confidence_score, level: node.confidence_level,
          lowConfidenceResolution: node.low_confidence_resolution },
      })),
      storyRanges: rangeRows.map((range) => ({
        id: range.id, originId: range.origin_id, title: range.title,
        startOffset: range.start_offset, endOffset: range.end_offset,
        coveredChapterIds: chapters.all(range.id),
        suggestedFunctionTags: JSON.parse(range.suggested_function_tags_json),
        boundaryEvidence: JSON.parse(range.boundary_evidence_json),
        startReason: range.start_reason, endReason: range.end_reason,
        confidence: { score: range.confidence_score, level: range.confidence_level,
          lowConfidenceResolution: range.low_confidence_resolution },
      })),
      storyRangeMode: set.story_range_mode,
      createdAt: set.created_at,
      updatedAt: set.updated_at,
      stage: 'draft', detectionRunId: null, draftRevision: set.draft_revision, structureEdition: null,
    });
  }

  findCurrentDraft(bookId: BreakdownBookId): DraftStructureSet | null {
    const id = this.database.prepare(`SELECT id FROM structure_sets
      WHERE book_id = ? AND stage = 'draft' AND is_current = 1`).pluck().get(bookId) as string | undefined;
    return id ? this.getCurrentDraft(bookId, id as StructureSetId) : null;
  }

  getCurrentFrozen(bookId: BreakdownBookId): FrozenStructureSet | null {
    const id = this.database.prepare(`SELECT id FROM structure_sets
      WHERE book_id = ? AND stage = 'frozen' AND is_current = 1`).pluck().get(bookId) as string | undefined;
    return id ? this.getFrozenById(id as StructureSetId) : null;
  }

  getFrozenById(structureSetId: StructureSetId): FrozenStructureSet | null {
    const set = this.database.prepare(`SELECT id, origin_set_id, book_id, source_text_id,
      source_text_edition, source_content_hash, decoded_text_length, offset_unit,
      story_range_mode, structure_edition, frozen_at, created_at, updated_at
      FROM structure_sets WHERE id = ? AND stage = 'frozen'`)
      .get(structureSetId) as (Omit<DraftSetRow, 'draft_revision'> & {
        structure_edition: number; frozen_at: string;
      }) | undefined;
    if (!set) return null;
    const nodeRows = this.database.prepare(`SELECT id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, raw_heading_text, heading_start_offset, heading_end_offset,
      confidence_score, confidence_level, low_confidence_resolution
      FROM structure_nodes WHERE structure_set_id = ?
      ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END, start_offset, sort_order`)
      .all(set.id) as DraftNodeRow[];
    const rangeRows = this.database.prepare(`SELECT id, origin_id, title, start_offset, end_offset,
      suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
      confidence_score, confidence_level, low_confidence_resolution
      FROM story_segment_ranges WHERE structure_set_id = ? ORDER BY start_offset, end_offset, id`)
      .all(set.id) as DraftRangeRow[];
    const chapters = this.database.prepare(`SELECT chapter_id FROM story_segment_range_chapters
      WHERE story_segment_range_id = ? ORDER BY sort_order`).pluck();
    return frozenStructureSetSchema.parse({
      id: set.id, originSetId: set.origin_set_id, bookId: set.book_id,
      sourceSnapshot: {
        sourceTextId: set.source_text_id, sourceTextEdition: set.source_text_edition,
        contentHash: set.source_content_hash, decodedTextLength: set.decoded_text_length,
        offsetUnit: set.offset_unit,
      },
      nodes: nodeRows.map((node) => ({
        id: node.id, originId: node.origin_id, kind: node.kind, title: node.title,
        parentId: node.parent_id, order: node.sort_order, startOffset: node.start_offset,
        endOffset: node.end_offset,
        heading: node.raw_heading_text === null ? null : {
          rawHeadingText: node.raw_heading_text, headingStartOffset: node.heading_start_offset,
          headingEndOffset: node.heading_end_offset,
        },
        confidence: { score: node.confidence_score, level: node.confidence_level,
          lowConfidenceResolution: node.low_confidence_resolution },
      })),
      storyRanges: rangeRows.map((range) => ({
        id: range.id, originId: range.origin_id, title: range.title,
        startOffset: range.start_offset, endOffset: range.end_offset,
        coveredChapterIds: chapters.all(range.id),
        suggestedFunctionTags: JSON.parse(range.suggested_function_tags_json),
        boundaryEvidence: JSON.parse(range.boundary_evidence_json),
        startReason: range.start_reason, endReason: range.end_reason,
        confidence: { score: range.confidence_score, level: range.confidence_level,
          lowConfidenceResolution: range.low_confidence_resolution },
      })),
      storyRangeMode: set.story_range_mode, createdAt: set.created_at, updatedAt: set.updated_at,
      stage: 'frozen', detectionRunId: null, draftRevision: null,
      structureEdition: set.structure_edition, frozenAt: set.frozen_at,
    });
  }

  private requireCurrentDraft(bookId: BreakdownBookId, draftSetId: StructureSetId): DraftSetRow {
    const row = this.database.prepare(`SELECT id, origin_set_id, book_id, source_text_id,
      source_text_edition, source_content_hash, decoded_text_length, offset_unit,
      story_range_mode, draft_revision, created_at, updated_at
      FROM structure_sets WHERE id = ? AND book_id = ? AND stage = 'draft' AND is_current = 1`)
      .get(draftSetId, bookId) as DraftSetRow | undefined;
    if (!row) throw new StructureDraftRepositoryError('draft_not_found');
    return row;
  }

  private sourceIsFresh(bookId: BreakdownBookId, draft: DraftSetRow): boolean {
    const source = this.database.prepare(`SELECT source_texts.id, source_texts.source_edition, source_texts.content_hash
      FROM books JOIN source_texts ON source_texts.id = books.current_source_text_id
        AND source_texts.book_id = books.id WHERE books.id = ?`).get(bookId) as CurrentSourceRow | undefined;
    return source !== undefined && source.id === draft.source_text_id &&
      source.source_edition === draft.source_text_edition && source.content_hash === draft.source_content_hash;
  }

  private insertDraft(draft: DraftStructureSet): void {
    const source = draft.sourceSnapshot;
    this.database.prepare(`INSERT INTO structure_sets (
      id, origin_set_id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, 1, NULL, NULL, 1, ?, ?)`)
      .run(draft.id, draft.originSetId, draft.bookId, source.sourceTextId,
        source.sourceTextEdition, source.contentHash, source.decodedTextLength,
        source.offsetUnit, draft.storyRangeMode, draft.createdAt, draft.updatedAt);

    const insertNode = this.database.prepare(`INSERT INTO structure_nodes (
      id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, raw_heading_text, heading_start_offset, heading_end_offset,
      confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const remaining = [...draft.nodes];
    const inserted = new Set<StructureNodeId>();
    while (remaining.length > 0) {
      const index = remaining.findIndex((node) => node.parentId === null || inserted.has(node.parentId));
      if (index < 0) throw new Error('Draft nodes must form a parent-resolvable tree.');
      const [node] = remaining.splice(index, 1);
      insertNode.run(node.id, draft.id, node.originId, node.kind, node.title, node.parentId,
        node.order, node.startOffset, node.endOffset, node.heading?.rawHeadingText ?? null,
        node.heading?.headingStartOffset ?? null, node.heading?.headingEndOffset ?? null,
        node.confidence.score, node.confidence.level, node.confidence.lowConfidenceResolution,
        draft.createdAt, draft.updatedAt);
      inserted.add(node.id);
    }

    const insertRange = this.database.prepare(`INSERT INTO story_segment_ranges (
      id, structure_set_id, origin_id, title, start_offset, end_offset,
      suggested_function_tags_json, boundary_evidence_json, start_reason, end_reason,
      confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertChapter = this.database.prepare(`INSERT INTO story_segment_range_chapters
      (story_segment_range_id, chapter_id, sort_order) VALUES (?, ?, ?)`);
    for (const range of draft.storyRanges) {
      insertRange.run(range.id, draft.id, range.originId, range.title, range.startOffset,
        range.endOffset, JSON.stringify(range.suggestedFunctionTags), JSON.stringify(range.boundaryEvidence),
        range.startReason, range.endReason, range.confidence.score, range.confidence.level,
        range.confidence.lowConfidenceResolution, draft.createdAt, draft.updatedAt);
      range.coveredChapterIds.forEach((chapterId, order) => insertChapter.run(range.id, chapterId, order));
    }
  }
}

function sameStringIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
