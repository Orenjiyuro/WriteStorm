import type {
  StructureNodeId,
  StructureSet,
  StructureSetNodeDto,
  StructureSourceSnapshot,
} from '../../../shared/domain';

export type StructureValidationPurpose = 'candidate_review' | 'freeze';
export type StructureValidationSeverity = 'review' | 'error';

export type StructureValidationIssueCode =
  | 'source_snapshot_stale'
  | 'source_text_length_mismatch'
  | 'book_root_count'
  | 'duplicate_node_id'
  | 'missing_parent'
  | 'invalid_parent_kind'
  | 'parent_cycle'
  | 'duplicate_sibling_order'
  | 'node_offset_out_of_bounds'
  | 'root_coverage_mismatch'
  | 'child_outside_parent'
  | 'heading_offset_out_of_bounds'
  | 'heading_text_mismatch'
  | 'range_offset_out_of_bounds'
  | 'boundary_evidence_out_of_range'
  | 'covered_chapter_missing'
  | 'covered_chapter_duplicate'
  | 'covered_chapter_order'
  | 'covered_chapter_set_mismatch'
  | 'range_overlap'
  | 'unresolved_low_confidence'
  | 'skipped_story_ranges_present';

export type StructureValidationIssue = {
  readonly code: StructureValidationIssueCode;
  readonly severity: StructureValidationSeverity;
  readonly objectId: string | null;
  readonly path: string;
};

export type ValidateStructureSetInput = {
  readonly structureSet: StructureSet;
  readonly currentSourceSnapshot: StructureSourceSnapshot;
  readonly sourceText: string;
  readonly purpose: StructureValidationPurpose;
};

export type StructureValidationResult = {
  readonly valid: boolean;
  readonly stale: boolean;
  readonly issues: StructureValidationIssue[];
};

export function validateStructureSet(input: ValidateStructureSetInput): StructureValidationResult {
  const issues: StructureValidationIssue[] = [];
  const stale = !sourceSnapshotsMatch(
    input.structureSet.sourceSnapshot,
    input.currentSourceSnapshot,
  );
  const conditionalSeverity = input.purpose === 'freeze' ? 'error' : 'review';

  if (stale) {
    addIssue(issues, 'source_snapshot_stale', conditionalSeverity, null, 'sourceSnapshot');
  }

  if (input.sourceText.length !== input.structureSet.sourceSnapshot.decodedTextLength) {
    addIssue(issues, 'source_text_length_mismatch', 'error', null, 'sourceSnapshot.decodedTextLength');
  }

  validateNodes(input, issues, conditionalSeverity);
  validateStoryRanges(input, issues, conditionalSeverity);

  if (input.structureSet.storyRangeMode === 'skipped_by_user' && input.structureSet.storyRanges.length > 0) {
    addIssue(issues, 'skipped_story_ranges_present', 'error', null, 'storyRanges');
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    stale,
    issues,
  };
}

function validateNodes(
  input: ValidateStructureSetInput,
  issues: StructureValidationIssue[],
  conditionalSeverity: StructureValidationSeverity,
): void {
  const nodes = input.structureSet.nodes;
  const nodesById = new Map<StructureNodeId, StructureSetNodeDto>();
  const roots = nodes.filter((node) => node.kind === 'book');

  if (roots.length !== 1) {
    addIssue(issues, 'book_root_count', 'error', null, 'nodes');
  }

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      addIssue(issues, 'duplicate_node_id', 'error', node.id, 'nodes.id');
    } else {
      nodesById.set(node.id, node);
    }
  }

  const siblingOrders = new Map<string, Set<number>>();
  const maxOffset = input.structureSet.sourceSnapshot.decodedTextLength;

  for (const node of nodes) {
    validateNodeParent(node, nodesById, issues);
    const siblingKey = node.parentId ?? '__root__';
    const orders = siblingOrders.get(siblingKey) ?? new Set<number>();
    if (orders.has(node.order)) {
      addIssue(issues, 'duplicate_sibling_order', 'error', node.id, 'nodes.order');
    }
    orders.add(node.order);
    siblingOrders.set(siblingKey, orders);

    if (node.startOffset < 0 || node.endOffset <= node.startOffset || node.endOffset > maxOffset) {
      addIssue(issues, 'node_offset_out_of_bounds', 'error', node.id, 'nodes.offsets');
    }

    if (node.kind === 'book' && (node.startOffset !== 0 || node.endOffset !== maxOffset)) {
      addIssue(issues, 'root_coverage_mismatch', 'error', node.id, 'nodes.offsets');
    }

    const parent = node.parentId === null ? null : nodesById.get(node.parentId);
    if (parent && (node.startOffset < parent.startOffset || node.endOffset > parent.endOffset)) {
      addIssue(issues, 'child_outside_parent', 'error', node.id, 'nodes.offsets');
    }

    if (node.heading) {
      if (node.heading.headingStartOffset < node.startOffset ||
        node.heading.headingEndOffset > node.endOffset ||
        node.heading.headingEndOffset <= node.heading.headingStartOffset) {
        addIssue(issues, 'heading_offset_out_of_bounds', 'error', node.id, 'nodes.heading');
      }

      if (input.sourceText.slice(
        node.heading.headingStartOffset,
        node.heading.headingEndOffset,
      ) !== node.heading.rawHeadingText) {
        addIssue(issues, 'heading_text_mismatch', 'error', node.id, 'nodes.heading.rawHeadingText');
      }
    }

    if (isUnresolvedLow(node.confidence)) {
      addIssue(
        issues,
        'unresolved_low_confidence',
        conditionalSeverity,
        node.id,
        'nodes.confidence.lowConfidenceResolution',
      );
    }
  }

  validateParentCycles(nodes, nodesById, issues);
}

function validateNodeParent(
  node: StructureSetNodeDto,
  nodesById: ReadonlyMap<StructureNodeId, StructureSetNodeDto>,
  issues: StructureValidationIssue[],
): void {
  if (node.kind === 'book') {
    if (node.parentId !== null) {
      addIssue(issues, 'invalid_parent_kind', 'error', node.id, 'nodes.parentId');
    }
    return;
  }

  if (node.parentId === null || !nodesById.has(node.parentId)) {
    addIssue(issues, 'missing_parent', 'error', node.id, 'nodes.parentId');
    return;
  }

  const parent = nodesById.get(node.parentId)!;
  const validParent = node.kind === 'volume'
    ? parent.kind === 'book'
    : parent.kind === 'book' || parent.kind === 'volume';
  if (!validParent) {
    addIssue(issues, 'invalid_parent_kind', 'error', node.id, 'nodes.parentId');
  }
}

function validateParentCycles(
  nodes: readonly StructureSetNodeDto[],
  nodesById: ReadonlyMap<StructureNodeId, StructureSetNodeDto>,
  issues: StructureValidationIssue[],
): void {
  const reported = new Set<StructureNodeId>();

  for (const node of nodes) {
    const path = new Set<StructureNodeId>();
    let current: StructureSetNodeDto | undefined = node;

    while (current) {
      if (path.has(current.id)) {
        if (!reported.has(current.id)) {
          addIssue(issues, 'parent_cycle', 'error', current.id, 'nodes.parentId');
          reported.add(current.id);
        }
        break;
      }
      path.add(current.id);
      current = current.parentId === null ? undefined : nodesById.get(current.parentId);
    }
  }
}

function validateStoryRanges(
  input: ValidateStructureSetInput,
  issues: StructureValidationIssue[],
  conditionalSeverity: StructureValidationSeverity,
): void {
  const nodesById = new Map(input.structureSet.nodes.map((node) => [node.id, node]));
  const chapters = input.structureSet.nodes
    .filter((node) => node.kind === 'chapter')
    .slice()
    .sort((left, right) => left.startOffset - right.startOffset);
  const maxOffset = input.structureSet.sourceSnapshot.decodedTextLength;

  for (const range of input.structureSet.storyRanges) {
    if (range.startOffset < 0 || range.endOffset <= range.startOffset || range.endOffset > maxOffset) {
      addIssue(issues, 'range_offset_out_of_bounds', 'error', range.id, 'storyRanges.offsets');
    }

    for (const evidence of range.boundaryEvidence) {
      if (evidence.startOffset < range.startOffset || evidence.endOffset > range.endOffset) {
        addIssue(
          issues,
          'boundary_evidence_out_of_range',
          'error',
          range.id,
          'storyRanges.boundaryEvidence',
        );
      }
    }

    const seenChapterIds = new Set<StructureNodeId>();
    const resolvedChapters: StructureSetNodeDto[] = [];
    for (const chapterId of range.coveredChapterIds) {
      if (seenChapterIds.has(chapterId)) {
        addIssue(issues, 'covered_chapter_duplicate', 'error', range.id, 'storyRanges.coveredChapterIds');
        continue;
      }
      seenChapterIds.add(chapterId);
      const chapter = nodesById.get(chapterId);
      if (!chapter || chapter.kind !== 'chapter') {
        addIssue(issues, 'covered_chapter_missing', 'error', range.id, 'storyRanges.coveredChapterIds');
      } else {
        resolvedChapters.push(chapter);
      }
    }

    if (!isSourceOrdered(resolvedChapters)) {
      addIssue(issues, 'covered_chapter_order', 'error', range.id, 'storyRanges.coveredChapterIds');
    }

    const expectedChapterIds = chapters
      .filter((chapter) => range.startOffset <= chapter.startOffset && range.endOffset >= chapter.endOffset)
      .map((chapter) => chapter.id);
    if (!sameIds(range.coveredChapterIds, expectedChapterIds)) {
      addIssue(issues, 'covered_chapter_set_mismatch', 'error', range.id, 'storyRanges.coveredChapterIds');
    }

    if (isUnresolvedLow(range.confidence)) {
      addIssue(
        issues,
        'unresolved_low_confidence',
        conditionalSeverity,
        range.id,
        'storyRanges.confidence.lowConfidenceResolution',
      );
    }
  }

  const ranges = input.structureSet.storyRanges
    .slice()
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  for (let index = 0; index < ranges.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < ranges.length; otherIndex += 1) {
      const left = ranges[index];
      const right = ranges[otherIndex];
      if (right.startOffset >= left.endOffset) {
        break;
      }
      if (left.startOffset < right.endOffset && right.startOffset < left.endOffset) {
        addIssue(issues, 'range_overlap', conditionalSeverity, right.id, 'storyRanges.offsets');
      }
    }
  }
}

function sourceSnapshotsMatch(left: StructureSourceSnapshot, right: StructureSourceSnapshot): boolean {
  return left.sourceTextId === right.sourceTextId &&
    left.sourceTextEdition === right.sourceTextEdition &&
    left.contentHash === right.contentHash &&
    left.decodedTextLength === right.decodedTextLength &&
    left.offsetUnit === right.offsetUnit;
}

function isSourceOrdered(chapters: readonly StructureSetNodeDto[]): boolean {
  return chapters.every((chapter, index) =>
    index === 0 || chapters[index - 1].startOffset <= chapter.startOffset,
  );
}

function sameIds(left: readonly StructureNodeId[], right: readonly StructureNodeId[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function isUnresolvedLow(confidence: StructureSetNodeDto['confidence']): boolean {
  return confidence.level === 'low' && confidence.lowConfidenceResolution === 'unresolved';
}

function addIssue(
  issues: StructureValidationIssue[],
  code: StructureValidationIssueCode,
  severity: StructureValidationSeverity,
  objectId: string | null,
  path: string,
): void {
  issues.push({ code, severity, objectId, path });
}
