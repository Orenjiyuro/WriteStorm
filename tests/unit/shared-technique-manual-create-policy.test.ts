import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
  type TechniqueLibraryManualCreatePolicy,
} from '../../src/shared/domain';

const manualCreatePolicy = {
  manualCreatePrimaryActionEnabled: false,
  emptyStateCopySource: 'adopted_candidates',
  emptyStateCopyText: '来自已采纳候选',
  futureManualCreateRequiresProductDecision: true,
  directCreatePrimaryFlowEnabled: false,
  mayBypassAdoptedCandidateForPrimaryCreate: false,
} satisfies TechniqueLibraryManualCreatePolicy;

const invalidEnabledManualCreate = {
  ...manualCreatePolicy,
  // @ts-expect-error V1 does not allow a manual create primary action.
  manualCreatePrimaryActionEnabled: true,
} satisfies TechniqueLibraryManualCreatePolicy;

const invalidDirectCreateFlow = {
  ...manualCreatePolicy,
  // @ts-expect-error V1 does not allow bypassing accepted candidates through a direct create flow.
  directCreatePrimaryFlowEnabled: true,
} satisfies TechniqueLibraryManualCreatePolicy;

describe('technique library manual create policy', () => {
  it('disables the manual create primary action for V1', () => {
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.manualCreatePrimaryActionEnabled).toBe(false);
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.directCreatePrimaryFlowEnabled).toBe(false);
  });

  it('anchors empty-state copy on adopted candidates', () => {
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopySource).toBe('adopted_candidates');
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopyText).toBe('来自已采纳候选');
  });

  it('requires a future product decision before manual creation can open', () => {
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.futureManualCreateRequiresProductDecision).toBe(true);
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.mayBypassAdoptedCandidateForPrimaryCreate).toBe(
      false,
    );
  });
});
