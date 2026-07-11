import { detectStructureCandidates } from '../detection/structure-detector';
import { detectStorySegmentRanges } from '../detection/story-range-detector';
import type {
  StructureWorkerDetectionInput,
  StructureWorkerDetectionResult,
} from './structure-worker-protocol';

export function executeStructureWorkerDetection(
  input: StructureWorkerDetectionInput,
): StructureWorkerDetectionResult {
  const structure = detectStructureCandidates(input);

  if (structure.status === 'structure_detection_failed') {
    return { structure, storyRanges: null };
  }

  return {
    structure,
    storyRanges: detectStorySegmentRanges({
      sourceText: input.sourceText,
      chapters: structure.nodes.filter((node) => node.kind === 'chapter'),
    }),
  };
}
