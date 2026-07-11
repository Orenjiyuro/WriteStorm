import { randomUUID } from 'node:crypto';
import type {
  StorySegmentRangeId,
  StructureNodeId,
} from '../../../shared/domain';
import type { StructureNodeKind } from '../../../shared/domain/status';

export type StructureCandidateIdFactory = {
  readonly createStructureNodeId: (kind: StructureNodeKind) => StructureNodeId;
  readonly createStorySegmentRangeId: () => StorySegmentRangeId;
};

export function createRandomStructureCandidateIdFactory(): StructureCandidateIdFactory {
  return {
    createStructureNodeId: (kind) => `${kind}:${randomUUID()}` as StructureNodeId,
    createStorySegmentRangeId: () => `story-range:${randomUUID()}` as StorySegmentRangeId,
  };
}
