import type {
  StorySegmentRangeId,
  StructureNodeId,
} from '../../../src/shared/domain';
import type { StructureCandidateIdFactory } from '../../../src/main/structure/detection/structure-candidate-id-factory';

const multilingualSourceText = [
  '# 第一卷：风暴',
  '## 第１章　出航',
  '港口的钟声唤醒了整座城市。',
  '## 第２話　交差',
  '两条线索在月光下汇合。',
  '',
  '---',
  '',
  '## Chapter 3: Aftermath',
  'The crew counts the cost.',
  '## Chapter 4: Return',
  'Everyone returns changed.',
].join('\n');

const multilingualHeadings = [
  '# 第一卷：风暴',
  '## 第１章　出航',
  '## 第２話　交差',
  '## Chapter 3: Aftermath',
  '## Chapter 4: Return',
] as const;

const multilingualHeadingStarts = multilingualHeadings.map((heading) =>
  multilingualSourceText.indexOf(heading),
);
const multilingualChapterIds = [
  'fixture:multilingual:chapter:2',
  'fixture:multilingual:chapter:3',
  'fixture:multilingual:chapter:4',
  'fixture:multilingual:chapter:5',
] as const;
const thirdChapterStart = multilingualHeadingStarts[3];
const separatorStart = multilingualSourceText.indexOf('---');

export const STRUCTURE_DETECTION_FIXTURES = {
  multilingualCrossChapter: {
    idPrefix: 'fixture:multilingual',
    bookTitle: '风暴航线',
    sourceText: multilingualSourceText,
    expected: {
      structureStatus: 'candidate_ready',
      nodes: [
        {
          id: 'fixture:multilingual:book:0',
          kind: 'book',
          title: '风暴航线',
          parentId: null,
          startOffset: 0,
          endOffset: multilingualSourceText.length,
          rawHeadingText: null,
          headingStartOffset: null,
          headingEndOffset: null,
        },
        expectedHeadingNode('volume', 1, '第一卷：风暴', 'fixture:multilingual:book:0', 0),
        expectedHeadingNode('chapter', 2, '第１章　出航', 'fixture:multilingual:volume:1', 1),
        expectedHeadingNode('chapter', 3, '第２話　交差', 'fixture:multilingual:volume:1', 2),
        expectedHeadingNode('chapter', 4, 'Chapter 3: Aftermath', 'fixture:multilingual:volume:1', 3),
        expectedHeadingNode('chapter', 5, 'Chapter 4: Return', 'fixture:multilingual:volume:1', 4),
      ],
      storyRanges: {
        status: 'needs_manual_review',
        ranges: [
          {
            id: 'fixture:multilingual:story-range:1',
            startOffset: multilingualHeadingStarts[1],
            endOffset: thirdChapterStart,
            coveredChapterIds: multilingualChapterIds.slice(0, 2),
            suggestedFunctionTags: ['structural_break'],
            boundaryEvidence: [
              {
                kind: 'chapter_window',
                startOffset: multilingualHeadingStarts[1],
                endOffset: thirdChapterStart,
              },
              {
                kind: 'explicit_separator',
                startOffset: separatorStart,
                endOffset: separatorStart + 3,
              },
            ],
            confidence: {
              score: 0.5,
              level: 'low',
              lowConfidenceResolution: 'unresolved',
            },
          },
        ],
        uncoveredChapterIds: multilingualChapterIds.slice(2),
      },
    },
  },
  lowConfidenceReview: {
    idPrefix: 'fixture:low-confidence',
    bookTitle: '重复章节',
    sourceText: 'Chapter 1: First\nChapter 1: Duplicate',
    expected: {
      status: 'needs_manual_review',
      aggregateConfidence: {
        score: 0.4,
        level: 'low',
        lowConfidenceResolution: 'unresolved',
      },
      nodes: [
        { kind: 'book', title: '重复章节' },
        { kind: 'chapter', title: 'Chapter 1: First' },
        {
          kind: 'chapter',
          title: 'Chapter 1: Duplicate',
          confidence: {
            score: 0.4,
            level: 'low',
            lowConfidenceResolution: 'unresolved',
          },
        },
      ],
    },
  },
  unusableFailure: {
    idPrefix: 'fixture:unusable',
    bookTitle: '无章节文本',
    sourceText: '# Foreword\nOnly body text follows.',
    expected: {
      status: 'structure_detection_failed',
      failureCode: 'no_reliable_chapter',
      recoveryActions: [
        'adjust_rules',
        'mark_chapters_manually',
        'create_book_root_shell',
      ],
      root: {
        kind: 'book',
        title: '无章节文本',
        confidence: {
          score: 0,
          level: 'unusable',
          lowConfidenceResolution: null,
        },
      },
    },
  },
} as const;

export function createStructureFixtureIdFactory(idPrefix: string): StructureCandidateIdFactory {
  let nodeIndex = 0;
  let rangeIndex = 0;

  return {
    createStructureNodeId: (kind) =>
      `${idPrefix}:${kind}:${nodeIndex++}` as StructureNodeId,
    createStorySegmentRangeId: () =>
      `${idPrefix}:story-range:${++rangeIndex}` as StorySegmentRangeId,
  };
}

function expectedHeadingNode(
  kind: 'volume' | 'chapter',
  idIndex: number,
  title: string,
  parentId: string,
  headingIndex: number,
) {
  const rawHeadingText = multilingualHeadings[headingIndex];
  const startOffset = multilingualHeadingStarts[headingIndex];
  const nextHeadingStart = multilingualHeadingStarts[headingIndex + 1];

  return {
    id: `fixture:multilingual:${kind}:${idIndex}`,
    kind,
    title,
    parentId,
    startOffset,
    endOffset: kind === 'volume' || nextHeadingStart === undefined
      ? multilingualSourceText.length
      : nextHeadingStart,
    rawHeadingText,
    headingStartOffset: startOffset,
    headingEndOffset: startOffset + rawHeadingText.length,
  };
}
