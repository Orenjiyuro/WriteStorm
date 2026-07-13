import type {
  StructureNodeId,
  StructureSetNodeDto,
  StructureSetStoryRangeDto,
} from '../../../shared/domain';
import {
  createRandomStructureCandidateIdFactory,
  type StructureCandidateIdFactory,
} from './structure-candidate-id-factory';
import { confidenceFromScore } from './structure-confidence';
import {
  createStoryBoundarySignalIndex,
  signalPriority,
  type StoryBoundarySignal,
} from './story-boundary-signal-index';

export type DetectStorySegmentRangesInput = {
  readonly chapters: readonly StructureSetNodeDto[];
  readonly sourceText?: string;
  readonly idFactory?: StructureCandidateIdFactory;
};

export type StoryRangeDetectionResult = {
  readonly status: 'story_ranges_ready' | 'needs_manual_review' | 'no_reliable_story_ranges';
  readonly reason?: 'fewer_than_two_chapters' | 'no_boundary_signal' | 'no_cross_chapter_signal_group';
  readonly ranges: StructureSetStoryRangeDto[];
  readonly uncoveredChapterIds: StructureNodeId[];
};

const MIN_STORY_RANGE_LENGTH = 4_000;

export function detectStorySegmentRanges(
  input: DetectStorySegmentRangesInput,
): StoryRangeDetectionResult {
  const idFactory = input.idFactory ?? createRandomStructureCandidateIdFactory();
  const chapters = input.chapters
    .filter((node) => node.kind === 'chapter')
    .slice()
    .sort((left, right) => left.startOffset - right.startOffset);
  const ranges: StructureSetStoryRangeDto[] = [];
  const boundarySignals = input.sourceText === undefined
    ? { hardSignals: [], transitionHints: [] }
    : createStoryBoundarySignalIndex(
      input.sourceText,
      new Set(chapters.map((chapter) => chapter.startOffset)),
    );
  const coveredChapterIds = new Set<StructureNodeId>();
  let groupStartIndex = 0;

  for (let chapterIndex = 0; chapterIndex < chapters.length - 1; chapterIndex += 1) {
    const currentChapter = chapters[chapterIndex];
    const group = chapters.slice(groupStartIndex, chapterIndex + 1);
    const hardSignal = findSignalWithin(boundarySignals.hardSignals, currentChapter);
    const transitionHint = findSignalWithin(boundarySignals.transitionHints, currentChapter);
    const firstChapter = group[0];
    const hasLengthWindow = firstChapter !== undefined && group.length >= 2 &&
      currentChapter.endOffset - firstChapter.startOffset >= MIN_STORY_RANGE_LENGTH;
    const softEvidence = hasLengthWindow && transitionHint && firstChapter
      ? [
        {
          kind: 'length_window' as const,
          startOffset: firstChapter.startOffset,
          endOffset: currentChapter.endOffset,
        },
        transitionHint,
      ]
      : null;

    if (!hardSignal && !softEvidence) {
      continue;
    }

    groupStartIndex = chapterIndex + 1;

    if (group.length < 2) {
      continue;
    }

    const lastChapter = group.at(-1);

    if (!firstChapter || !lastChapter) {
      continue;
    }

    ranges.push({
      id: idFactory.createStorySegmentRangeId(),
      originId: null,
      title: `Story segment ${ranges.length + 1}`,
      startOffset: firstChapter.startOffset,
      endOffset: lastChapter.endOffset,
      coveredChapterIds: group.map((chapter) => chapter.id),
      suggestedFunctionTags: hardSignal ? ['structural_break'] : ['transition'],
      boundaryEvidence: [
        {
          kind: 'chapter_window',
          startOffset: firstChapter.startOffset,
          endOffset: lastChapter.endOffset,
        },
        ...(hardSignal ? [hardSignal] : softEvidence ?? []),
      ],
      startReason: 'signal_group_start',
      endReason: hardSignal
        ? `signal_group_end:${hardSignal.kind}`
        : 'signal_group_end:combined_soft_signals',
      confidence: confidenceFromScore(hardSignal ? 0.5 : 0.4),
    });
    group.forEach((chapter) => coveredChapterIds.add(chapter.id));
  }

  const uncoveredChapterIds = chapters
    .filter((chapter) => !coveredChapterIds.has(chapter.id))
    .map((chapter) => chapter.id);

  if (ranges.length === 0) {
    return {
      status: 'no_reliable_story_ranges',
      reason: chapters.length < 2
        ? 'fewer_than_two_chapters'
        : boundarySignals.hardSignals.length === 0 && boundarySignals.transitionHints.length === 0
          ? 'no_boundary_signal'
          : 'no_cross_chapter_signal_group',
      ranges,
      uncoveredChapterIds,
    };
  }

  return {
    status: ranges.some((range) =>
      range.confidence.level === 'low' || range.confidence.level === 'unusable',
    ) ? 'needs_manual_review' : 'story_ranges_ready',
    ranges,
    uncoveredChapterIds,
  };
}

function findSignalWithin(
  signals: readonly StoryBoundarySignal[],
  chapter: StructureSetNodeDto,
): StoryBoundarySignal | null {
  const signalsInChapter = signals.filter((signal) =>
    signal.startOffset >= chapter.startOffset && signal.endOffset <= chapter.endOffset,
  );

  if (signalsInChapter.length === 0) {
    return null;
  }

  return signalsInChapter.reduce((selected, signal) =>
    signalPriority(signal) < signalPriority(selected) ? signal : selected,
  );
}
