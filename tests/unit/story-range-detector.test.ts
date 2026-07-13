import { describe, expect, it } from 'vitest';
import type { StructureNodeId, StructureSetNodeDto } from '../../src/shared/domain';
import { detectStorySegmentRanges } from '../../src/main/structure/detection/story-range-detector';

describe('story range detector', () => {
  it('returns no reliable ranges when chapter groups have no boundary signal', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\nChapter 3\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);

    expect(detectStorySegmentRanges({
      idFactory: deterministicIdFactory(),
      sourceText,
      chapters,
    })).toEqual(expect.objectContaining({
      status: 'no_reliable_story_ranges',
      reason: 'no_boundary_signal',
      ranges: [],
      uncoveredChapterIds: chapters.map((chapter) => chapter.id),
    }));
  });

  it('closes a low-confidence range at an explicit separator after at least two chapters', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n\n---\n\nChapter 3\nBody\nChapter 4\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4']);
    const result = detectStorySegmentRanges({
      idFactory: deterministicIdFactory(),
      sourceText,
      chapters,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'needs_manual_review',
      uncoveredChapterIds: ['chapter-3', 'chapter-4'],
    }));
    expect(result.ranges).toEqual([expect.objectContaining({
      id: 'detector:story-range:1',
      startOffset: chapters[0].startOffset,
      endOffset: chapters[1].endOffset,
      coveredChapterIds: ['chapter-1', 'chapter-2'],
      suggestedFunctionTags: ['structural_break'],
      boundaryEvidence: [
        {
          kind: 'chapter_window',
          startOffset: chapters[0].startOffset,
          endOffset: chapters[1].endOffset,
        },
        {
          kind: 'explicit_separator',
          startOffset: sourceText.indexOf('---'),
          endOffset: sourceText.indexOf('---') + 3,
        },
      ],
      startReason: 'signal_group_start',
      endReason: 'signal_group_end:explicit_separator',
      confidence: {
        score: 0.5,
        level: 'low',
        lowConfidenceResolution: 'unresolved',
      },
    })]);
  });

  it('uses a visible blank-line cluster as boundary evidence', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n\n\nChapter 3\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const result = detectStorySegmentRanges({
      idFactory: deterministicIdFactory(),
      sourceText,
      chapters,
    });

    expect(result.ranges).toEqual([expect.objectContaining({
      coveredChapterIds: ['chapter-1', 'chapter-2'],
      suggestedFunctionTags: ['structural_break'],
      boundaryEvidence: expect.arrayContaining([{
        kind: 'blank_line_cluster',
        startOffset: sourceText.indexOf('\n\n\n') + 1,
        endOffset: sourceText.indexOf('\n\n\n') + 3,
      }]),
      endReason: 'signal_group_end:blank_line_cluster',
    })]);
    expect(result).toEqual(expect.objectContaining({
      uncoveredChapterIds: ['chapter-3'],
    }));
  });

  it('uses a non-chapter Markdown subheading as a hard structural boundary', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n### Scene break\nBody\nChapter 3\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const result = detectStorySegmentRanges({
      sourceText,
      idFactory: deterministicIdFactory(),
      chapters,
    });

    expect(result.ranges).toEqual([expect.objectContaining({
      coveredChapterIds: ['chapter-1', 'chapter-2'],
      suggestedFunctionTags: ['structural_break'],
      boundaryEvidence: expect.arrayContaining([{
        kind: 'markdown_subheading',
        startOffset: sourceText.indexOf('### Scene break'),
        endOffset: sourceText.indexOf('### Scene break') + '### Scene break'.length,
      }]),
      endReason: 'signal_group_end:markdown_subheading',
    })]);
    expect(result).toEqual(expect.objectContaining({ uncoveredChapterIds: ['chapter-3'] }));
  });

  it('combines a length window and paragraph-leading transition hint as soft boundary evidence', () => {
    const longBody = 'a'.repeat(2100);
    const sourceText = [
      'Chapter 1',
      longBody,
      'Chapter 2',
      longBody,
      '然而，局势在此发生变化。',
      'Chapter 3',
      'Body',
    ].join('\n');
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const result = detectStorySegmentRanges({
      sourceText,
      idFactory: deterministicIdFactory(),
      chapters,
    });

    expect(result.ranges).toEqual([expect.objectContaining({
      coveredChapterIds: ['chapter-1', 'chapter-2'],
      suggestedFunctionTags: ['transition'],
      boundaryEvidence: expect.arrayContaining([
        {
          kind: 'length_window',
          startOffset: chapters[0].startOffset,
          endOffset: chapters[1].endOffset,
        },
        {
          kind: 'transition_hint',
          startOffset: sourceText.indexOf('然而'),
          endOffset: sourceText.indexOf('然而') + '然而，局势在此发生变化。'.length,
        },
      ]),
      endReason: 'signal_group_end:combined_soft_signals',
    })]);
  });

  it('does not let a lone transition hint or length window fabricate a story range', () => {
    const transitionOnly = 'Chapter 1\nBody\nChapter 2\n然而，变化。\nChapter 3\nBody';
    const transitionChapters = chaptersFromSource(transitionOnly, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const longBody = 'a'.repeat(4200);
    const lengthOnly = `Chapter 1\n${longBody}\nChapter 2\nBody\nChapter 3\nBody`;
    const lengthChapters = chaptersFromSource(lengthOnly, ['Chapter 1', 'Chapter 2', 'Chapter 3']);

    expect(detectStorySegmentRanges({
      sourceText: transitionOnly,
      chapters: transitionChapters,
    })).toEqual(expect.objectContaining({
      status: 'no_reliable_story_ranges',
      ranges: [],
    }));
    expect(detectStorySegmentRanges({
      sourceText: lengthOnly,
      chapters: lengthChapters,
    })).toEqual(expect.objectContaining({
      status: 'no_reliable_story_ranges',
      ranges: [],
    }));
  });

  it('does not treat a Setext underline as a story range boundary signal', () => {
    const sourceText = '第１話 始まり\n------\n第２話 続き';
    const chapters = chaptersFromSource(sourceText, ['第１話', '第２話']);

    expect(detectStorySegmentRanges({
      sourceText,
      idFactory: deterministicIdFactory(),
      chapters,
    })).toEqual(expect.objectContaining({
      status: 'no_reliable_story_ranges',
      reason: 'no_boundary_signal',
      ranges: [],
      uncoveredChapterIds: ['chapter-1', 'chapter-2'],
    }));
  });

  it('does not fabricate a range when a boundary only closes one chapter', () => {
    const sourceText = 'Chapter 1\nBody\n\n---\n\nChapter 2\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2']);

    expect(detectStorySegmentRanges({
      sourceText,
      idFactory: deterministicIdFactory(),
      chapters,
    })).toEqual(expect.objectContaining({
      status: 'no_reliable_story_ranges',
      reason: 'no_cross_chapter_signal_group',
      ranges: [],
      uncoveredChapterIds: ['chapter-1', 'chapter-2'],
    }));
  });

  it('keeps a trailing odd chapter explicitly uncovered instead of fabricating a singleton range', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n\n---\n\nChapter 3\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const result = detectStorySegmentRanges({
      idFactory: deterministicIdFactory(),
      sourceText,
      chapters,
    });

    expect(result.ranges).toHaveLength(1);
    expect(result.ranges[0]?.coveredChapterIds).toEqual(['chapter-1', 'chapter-2']);
    expect(result).toEqual(expect.objectContaining({
      uncoveredChapterIds: ['chapter-3'],
    }));
  });

  it('creates non-overlapping signal-closed ranges', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n\n---\n\nChapter 3\nBody\nChapter 4\nBody\n\n---\n\nChapter 5\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5']);
    const result = detectStorySegmentRanges({
      idFactory: deterministicIdFactory(),
      sourceText,
      chapters,
    });

    const [first, second] = result.ranges;
    expect(first.endOffset).toBe(second.startOffset);
    expect(first.endOffset).not.toBeGreaterThan(second.startOffset);
    expect(result).toEqual(expect.objectContaining({
      uncoveredChapterIds: ['chapter-5'],
    }));
  });

  it('uses non-overlapping identities for independent signal-based detections', () => {
    const sourceText = 'Chapter 1\nBody\nChapter 2\nBody\n\n---\n\nChapter 3\nBody';
    const chapters = chaptersFromSource(sourceText, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    const input = { sourceText, chapters };
    const first = detectStorySegmentRanges(input);
    const second = detectStorySegmentRanges(input);

    expect(first.ranges[0]?.id).not.toBe(second.ranges[0]?.id);
  });
});

function deterministicIdFactory() {
  let rangeIndex = 0;

  return {
    createStructureNodeId: () => 'unused-node-id' as StructureNodeId,
    createStorySegmentRangeId: () =>
      `detector:story-range:${++rangeIndex}` as import('../../src/shared/domain').StorySegmentRangeId,
  };
}

function chaptersFromSource(sourceText: string, headingTexts: readonly string[]): StructureSetNodeDto[] {
  return headingTexts.map((headingText, index) => {
    const startOffset = sourceText.indexOf(headingText);
    const nextHeadingText = headingTexts[index + 1];
    const endOffset = nextHeadingText === undefined
      ? sourceText.length
      : sourceText.indexOf(nextHeadingText);

    return chapter(`chapter-${index + 1}`, startOffset, endOffset);
  });
}

function chapter(id: string, startOffset: number, endOffset: number): StructureSetNodeDto {
  return {
    id: id as StructureNodeId,
    originId: null,
    kind: 'chapter',
    title: id,
    parentId: null,
    order: startOffset,
    startOffset,
    endOffset,
    heading: null,
    confidence: {
      score: 0.9,
      level: 'high',
      lowConfidenceResolution: null,
    },
  };
}
