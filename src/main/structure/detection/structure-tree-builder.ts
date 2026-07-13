import type {
  StructureConfidence,
  StructureNodeId,
  StructureSetNodeDto,
} from '../../../shared/domain';
import { confidenceFromScore } from './structure-confidence';
import type { StructureCandidateIdFactory } from './structure-candidate-id-factory';
import type { ScannedStructureHeading } from './structure-heading-scanner';

export type BuildStructureNodesInput = {
  readonly root: StructureSetNodeDto;
  readonly headings: readonly ScannedStructureHeading[];
  readonly sourceTextLength: number;
  readonly idFactory: StructureCandidateIdFactory;
};

type DetectedStructureHeading = ScannedStructureHeading & {
  readonly id: StructureNodeId;
  readonly parentId: StructureNodeId;
  readonly order: number;
  readonly confidence: StructureConfidence;
};

export function buildStructureNodes(input: BuildStructureNodesInput): StructureSetNodeDto[] {
  const detectedHeadings = buildDetectedHeadings(input);

  return [input.root, ...detectedHeadings.map((heading, index) => ({
    id: heading.id,
    originId: null,
    kind: heading.kind,
    title: heading.title,
    parentId: heading.parentId,
    order: heading.order,
    startOffset: heading.startOffset,
    endOffset: findNodeEndOffset(detectedHeadings, index, input.sourceTextLength),
    heading: {
      rawHeadingText: heading.rawHeadingText,
      headingStartOffset: heading.startOffset,
      headingEndOffset: heading.headingEndOffset,
    },
    confidence: heading.confidence,
  }))];
}

function buildDetectedHeadings(input: BuildStructureNodesInput): DetectedStructureHeading[] {
  const headings: DetectedStructureHeading[] = [];
  const nextOrderByParent = new Map<StructureNodeId, number>([[input.root.id, 0]]);
  let currentVolumeId = input.root.id;
  let chapterNumber: number | null = null;
  let volumeNumber: number | null = null;

  for (const heading of input.headings) {
    const previousNumber = heading.kind === 'volume' ? volumeNumber : chapterNumber;
    const confidence = confidenceFromScore(scoreHeadingContinuity(
      heading.baseScore,
      heading.number,
      previousNumber,
    ));
    const id = input.idFactory.createStructureNodeId(heading.kind);
    const parentId = heading.kind === 'volume' ? input.root.id : currentVolumeId;
    const order = nextOrderByParent.get(parentId) ?? 0;
    nextOrderByParent.set(parentId, order + 1);

    headings.push({ ...heading, id, parentId, order, confidence });

    if (heading.kind === 'volume') {
      currentVolumeId = id;
      volumeNumber = heading.number;
      chapterNumber = null;
      nextOrderByParent.set(id, 0);
    } else {
      chapterNumber = heading.number;
    }
  }

  return headings;
}

function findNodeEndOffset(
  headings: readonly DetectedStructureHeading[],
  index: number,
  sourceTextLength: number,
): number {
  const current = headings[index];

  for (let nextIndex = index + 1; nextIndex < headings.length; nextIndex += 1) {
    const next = headings[nextIndex];

    if (current.kind === 'volume' && next.kind === 'volume') {
      return next.startOffset;
    }

    if (current.kind === 'chapter') {
      return next.startOffset;
    }
  }

  return sourceTextLength;
}

function scoreHeadingContinuity(
  baseScore: number,
  number: number | null,
  previousNumber: number | null,
): number {
  if (number === null || previousNumber === null) {
    return baseScore;
  }

  if (number <= previousNumber) {
    return baseScore - 0.5;
  }

  if (number > previousNumber + 1) {
    return baseScore - 0.35;
  }

  return baseScore;
}
