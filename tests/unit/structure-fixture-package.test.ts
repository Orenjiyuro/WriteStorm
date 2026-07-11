import { describe, expect, it } from 'vitest';
import { detectStructureCandidates } from '../../src/main/structure/detection/structure-detector';
import { detectStorySegmentRanges } from '../../src/main/structure/detection/story-range-detector';
import {
  STRUCTURE_DETECTION_FIXTURES,
  createStructureFixtureIdFactory,
} from '../fixtures/structure/structure-detection-fixtures';

describe('structure detection fixture package', () => {
  it('replays a multilingual title tree and cross-chapter story range', () => {
    const fixture = STRUCTURE_DETECTION_FIXTURES.multilingualCrossChapter;
    const idFactory = createStructureFixtureIdFactory(fixture.idPrefix);
    const structure = detectStructureCandidates({
      bookTitle: fixture.bookTitle,
      sourceText: fixture.sourceText,
      idFactory,
    });

    expect(structure.status).toBe(fixture.expected.structureStatus);
    if (structure.status === 'structure_detection_failed') {
      throw new Error('Expected a reusable structure candidate fixture.');
    }

    expect(structure.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      title: node.title,
      parentId: node.parentId,
      startOffset: node.startOffset,
      endOffset: node.endOffset,
      rawHeadingText: node.heading?.rawHeadingText ?? null,
      headingStartOffset: node.heading?.headingStartOffset ?? null,
      headingEndOffset: node.heading?.headingEndOffset ?? null,
    }))).toEqual(fixture.expected.nodes);

    const storyRanges = detectStorySegmentRanges({
      chapters: structure.nodes.filter((node) => node.kind === 'chapter'),
      sourceText: fixture.sourceText,
      idFactory,
    });

    expect({
      status: storyRanges.status,
      ranges: storyRanges.ranges.map((range) => ({
        id: range.id,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        coveredChapterIds: range.coveredChapterIds,
        suggestedFunctionTags: range.suggestedFunctionTags,
        boundaryEvidence: range.boundaryEvidence,
        confidence: range.confidence,
      })),
      uncoveredChapterIds: storyRanges.uncoveredChapterIds,
    }).toEqual(fixture.expected.storyRanges);
  });

  it('replays a low-confidence candidate that requires manual review', () => {
    const fixture = STRUCTURE_DETECTION_FIXTURES.lowConfidenceReview;
    const result = detectStructureCandidates({
      bookTitle: fixture.bookTitle,
      sourceText: fixture.sourceText,
      idFactory: createStructureFixtureIdFactory(fixture.idPrefix),
    });

    expect(result).toMatchObject(fixture.expected);
  });

  it('replays an unusable failure with stable recovery actions', () => {
    const fixture = STRUCTURE_DETECTION_FIXTURES.unusableFailure;
    const result = detectStructureCandidates({
      bookTitle: fixture.bookTitle,
      sourceText: fixture.sourceText,
      idFactory: createStructureFixtureIdFactory(fixture.idPrefix),
    });

    expect(result).toMatchObject(fixture.expected);
  });
});
