import type {
  StructureConfidence,
  StructureNodeId,
  StructureSetNodeDto,
} from '../../../shared/domain';
import { confidenceFromScore } from './structure-confidence';
import {
  createRandomStructureCandidateIdFactory,
  type StructureCandidateIdFactory,
} from './structure-candidate-id-factory';
import { scanStructureHeadings } from './structure-heading-scanner';
import { buildStructureNodes } from './structure-tree-builder';

export type DetectStructureCandidatesInput = {
  readonly bookTitle: string;
  readonly sourceText: string;
  readonly idFactory?: StructureCandidateIdFactory;
};

export type StructureDetectionCandidate = {
  readonly status: 'candidate_ready' | 'needs_manual_review';
  readonly nodes: StructureSetNodeDto[];
  readonly aggregateConfidence: StructureConfidence;
};

export type StructureDetectionFailure = {
  readonly status: 'structure_detection_failed';
  readonly failureCode: 'no_reliable_chapter';
  readonly recoveryActions: readonly [
    'adjust_rules',
    'mark_chapters_manually',
    'create_book_root_shell',
  ];
  readonly root: StructureSetNodeDto;
};

export type StructureDetectionResult =
  | StructureDetectionCandidate
  | StructureDetectionFailure;

export function detectStructureCandidates(
  input: DetectStructureCandidatesInput,
): StructureDetectionResult {
  const idFactory = input.idFactory ?? createRandomStructureCandidateIdFactory();
  const rootId = idFactory.createStructureNodeId('book');
  const root = createBookRoot(input.bookTitle, input.sourceText.length, 'high', rootId);
  const headings = scanStructureHeadings(input.sourceText);

  if (!headings.some((heading) => heading.kind === 'chapter')) {
    return {
      status: 'structure_detection_failed',
      failureCode: 'no_reliable_chapter',
      recoveryActions: [
        'adjust_rules',
        'mark_chapters_manually',
        'create_book_root_shell',
      ],
      root: createBookRoot(input.bookTitle, input.sourceText.length, 'unusable', rootId),
    };
  }

  const nodes = buildStructureNodes({
    root,
    headings,
    sourceTextLength: input.sourceText.length,
    idFactory,
  });
  const aggregateConfidence = confidenceFromScore(Math.min(
    ...nodes.slice(1).map((node) => node.confidence.score),
  ));

  return {
    status: aggregateConfidence.level === 'low' || aggregateConfidence.level === 'unusable'
      ? 'needs_manual_review'
      : 'candidate_ready',
    nodes,
    aggregateConfidence,
  };
}

function createBookRoot(
  title: string,
  sourceTextLength: number,
  confidenceLevel: 'high' | 'unusable',
  id: StructureNodeId,
): StructureSetNodeDto {
  return {
    id,
    originId: null,
    kind: 'book',
    title,
    parentId: null,
    order: 0,
    startOffset: 0,
    endOffset: sourceTextLength,
    heading: null,
    confidence: confidenceFromScore(confidenceLevel === 'high' ? 1 : 0),
  };
}
