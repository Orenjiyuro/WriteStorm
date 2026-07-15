import { describe, expect, it } from 'vitest';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  SourceTextId,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../../src/shared/domain';
import { validateStructureSet } from '../../src/main/structure/validation/structure-validator';

describe('structure validator', () => {
  it('accepts a coherent title tree and source snapshot', () => {
    const fixture = createFixture();

    expect(validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    })).toEqual({ valid: true, stale: false, issues: [] });
  });

  it('marks a changed source snapshot as reviewable stale for candidates and blocking for freeze', () => {
    const fixture = createFixture();
    const currentSourceSnapshot = {
      ...fixture.structureSet.sourceSnapshot,
      sourceTextEdition: 2,
      contentHash: 'sha256:changed',
    };

    const review = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    });
    const freeze = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'freeze',
    });

    expect(review).toMatchObject({
      valid: true,
      stale: true,
      issues: [expect.objectContaining({ code: 'source_snapshot_stale', severity: 'review' })],
    });
    expect(freeze).toMatchObject({
      valid: false,
      stale: true,
      issues: [expect.objectContaining({ code: 'source_snapshot_stale', severity: 'error' })],
    });
  });

  it('collects hierarchy, order, offset and raw heading violations without stopping at the first issue', () => {
    const fixture = createFixture();
    const [, firstChapter, secondChapter, thirdChapter] = fixture.structureSet.nodes;
    fixture.structureSet.nodes[0].endOffset -= 1;
    firstChapter.parentId = 'missing-parent' as StructureNodeId;
    thirdChapter.order = secondChapter.order;
    secondChapter.heading = {
      ...secondChapter.heading!,
      rawHeadingText: 'Not the source heading',
    };

    const result = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    });
    const codes = result.issues.map((issue) => issue.code);

    expect(result.valid).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      'root_coverage_mismatch',
      'missing_parent',
      'duplicate_sibling_order',
      'heading_text_mismatch',
    ]));
  });

  it('requires covered chapters to match the source-ordered chapters contained by a range', () => {
    const fixture = createFixture();
    const [firstChapter] = fixture.structureSet.nodes.filter((node) => node.kind === 'chapter');
    fixture.structureSet.storyRanges = [range(
      'range-mismatch',
      0,
      fixture.structureSet.nodes[3].startOffset,
      [firstChapter.id],
    )];

    const result = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    });

    expect(result).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'covered_chapter_set_mismatch', objectId: 'range-mismatch' }),
      ]),
    });
  });

  it('rejects a heading span that escapes its node even when the sliced text happens to match', () => {
    const fixture = createFixture();
    const chapter = fixture.structureSet.nodes[1];
    chapter.heading = {
      rawHeadingText: fixture.sourceText.slice(chapter.endOffset - 1, chapter.endOffset + 1),
      headingStartOffset: chapter.endOffset - 1,
      headingEndOffset: chapter.endOffset + 1,
    };

    expect(validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    })).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'heading_offset_out_of_bounds', objectId: chapter.id }),
      ]),
    });
  });

  it('allows adjacent ranges and makes actual overlap reviewable before freeze but blocking at freeze', () => {
    const fixture = createFixture();
    const chapters = fixture.structureSet.nodes.filter((node) => node.kind === 'chapter');
    fixture.structureSet.storyRanges = [
      range('range-a', chapters[0].startOffset, chapters[2].startOffset, [chapters[0].id, chapters[1].id]),
      range('range-b', chapters[1].startOffset, chapters[2].endOffset, [chapters[1].id, chapters[2].id]),
    ];

    const review = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    });
    const freeze = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'freeze',
    });

    expect(review).toMatchObject({
      valid: true,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'range_overlap', severity: 'review' })]),
    });
    expect(freeze).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'range_overlap', severity: 'error' })]),
    });

    fixture.structureSet.storyRanges[1].startOffset = fixture.structureSet.storyRanges[0].endOffset;
    fixture.structureSet.storyRanges[1].coveredChapterIds = [chapters[2].id];
    expect(validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'freeze',
    }).issues.map((issue) => issue.code)).not.toContain('range_overlap');
  });

  it('reports unresolved low confidence for review and blocks it at freeze', () => {
    const fixture = createFixture();
    fixture.structureSet.nodes[2].confidence = {
      score: 0.5,
      level: 'low',
      lowConfidenceResolution: 'unresolved',
    };

    const review = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'candidate_review',
    });
    const freeze = validateStructureSet({
      structureSet: fixture.structureSet,
      currentSourceSnapshot: fixture.structureSet.sourceSnapshot,
      sourceText: fixture.sourceText,
      purpose: 'freeze',
    });

    expect(review).toMatchObject({
      valid: true,
      issues: [expect.objectContaining({ code: 'unresolved_low_confidence', severity: 'review' })],
    });
    expect(freeze).toMatchObject({
      valid: false,
      issues: [expect.objectContaining({ code: 'unresolved_low_confidence', severity: 'error' })],
    });
  });
});

function createFixture(): { sourceText: string; structureSet: CandidateStructureSet } {
  const sourceText = 'Chapter 1\nBody one\nChapter 2\nBody two\nChapter 3\nBody three';
  const starts = ['Chapter 1', 'Chapter 2', 'Chapter 3'].map((title) => sourceText.indexOf(title));
  const rootId = 'node-book' as StructureNodeId;
  const chapterIds = starts.map((_, index) => `node-chapter-${index + 1}` as StructureNodeId);
  const now = '2026-07-10T00:00:00.000Z';

  return {
    sourceText,
    structureSet: {
      id: 'set-1' as StructureSetId,
      originSetId: null,
      bookId: 'book-1' as BreakdownBookId,
      sourceSnapshot: {
        sourceTextId: 'source-1' as SourceTextId,
        sourceTextEdition: 1,
        contentHash: 'sha256:source',
        decodedTextLength: sourceText.length,
        offsetUnit: 'utf16_code_unit',
      },
      nodes: [
        {
          id: rootId,
          originId: null,
          kind: 'book',
          title: 'Example',
          parentId: null,
          order: 0,
          startOffset: 0,
          endOffset: sourceText.length,
          heading: null,
          confidence: highConfidence(),
        },
        ...starts.map((startOffset, index) => ({
          id: chapterIds[index],
          originId: null,
          kind: 'chapter' as const,
          title: `Chapter ${index + 1}`,
          parentId: rootId,
          order: index,
          startOffset,
          endOffset: starts[index + 1] ?? sourceText.length,
          heading: {
            rawHeadingText: `Chapter ${index + 1}`,
            headingStartOffset: startOffset,
            headingEndOffset: startOffset + `Chapter ${index + 1}`.length,
          },
          confidence: highConfidence(),
        })),
      ],
      storyRanges: [],
      storyRangeMode: 'included',
      createdAt: now,
      updatedAt: now,
      stage: 'candidate',
      detectionRunId: 'run-1' as StructureDetectionRunId,
      draftRevision: null,
      structureEdition: null,
    },
  };
}

function range(
  id: string,
  startOffset: number,
  endOffset: number,
  coveredChapterIds: StructureNodeId[],
): CandidateStructureSet['storyRanges'][number] {
  return {
    id: id as StorySegmentRangeId,
    originId: null,
    title: id,
    startOffset,
    endOffset,
    coveredChapterIds,
    suggestedFunctionTags: [],
    boundaryEvidence: [{ kind: 'chapter_window', startOffset, endOffset }],
    startReason: 'start',
    endReason: 'end',
    confidence: highConfidence(),
  };
}

function highConfidence() {
  return { score: 0.9, level: 'high' as const, lowConfidenceResolution: null };
}
