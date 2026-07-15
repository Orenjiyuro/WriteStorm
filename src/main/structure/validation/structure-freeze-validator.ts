import type { DraftStructureSet, StructureSourceSnapshot } from '../../../shared/domain';
import {
  validateStructureSet,
  type StructureValidationResult,
} from './structure-validator';

export type ValidateDraftForFreezeInput = {
  readonly draft: DraftStructureSet;
  readonly currentSourceSnapshot: StructureSourceSnapshot;
  readonly sourceText: string;
};

/** Pure validation seam. Persistence, Job, edition, and invalidation work belongs to the caller. */
export function validateDraftForFreeze(input: ValidateDraftForFreezeInput): StructureValidationResult {
  return validateStructureSet({
    structureSet: input.draft,
    currentSourceSnapshot: input.currentSourceSnapshot,
    sourceText: input.sourceText,
    purpose: 'freeze',
  });
}
