import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CRITICAL_CONCLUSION_EVIDENCE_POLICY,
  EVIDENCE_POLICIES,
  ANALYSIS_INSUFFICIENT_EVIDENCE_PARTICIPATION_POLICY,
  ANALYSIS_MODULE_INSTANCE_CONTRACT,
  ANALYSIS_REVIEW_ASSET_CONTRACT,
  ANALYSIS_REVIEW_CONFIRMATION_EVIDENCE_POLICY,
  ANALYSIS_REVIEW_TRANSITION_POLICY,
  MODULE_INSTANCE_STATUSES,
  REVIEW_ASSET_STATUSES,
  type AnalysisCriticalConclusionEvidencePolicy,
  type AnalysisEvidenceAnchorRequirement,
  type AnalysisInsufficientEvidenceParticipationPolicy,
  type AnalysisReviewConfirmationEvidencePolicy,
  type AnalysisReviewTransitionPolicy,
  type EvidencePolicy,
  type ReviewAssetStatus,
} from '../../src/shared/domain';

const confirmedReviewStatus: ReviewAssetStatus = 'confirmed';
const evidenceRequirement: AnalysisEvidenceAnchorRequirement = 'valid_evidence_anchor';
const requiredEvidencePolicy: EvidencePolicy = 'required_for_confirmation';

// @ts-expect-error Review assets use pending, not the module instance generation status.
const invalidReviewStatus: ReviewAssetStatus = 'generated_pending_review';

// @ts-expect-error User acceptance is not an evidence policy.
const invalidEvidencePolicy: EvidencePolicy = 'user_subjective_acceptance';

// @ts-expect-error User acceptance is not a valid evidence anchor.
const invalidEvidenceRequirement: AnalysisEvidenceAnchorRequirement = 'user_subjective_acceptance';

const expectedReviewStatuses = [
  'pending',
  'confirmed',
  'rejected',
  'excluded',
  'needs_evidence',
  'stale',
] as const satisfies readonly ReviewAssetStatus[];

const expectedTransitionPolicy = {
  statusField: 'reviewStatus',
  structuredStatusFieldKind: 'review_status',
  initialStatus: 'pending',
  statuses: expectedReviewStatuses,
  definesCompleteWorkflow: false,
  allowedTransitions: [
    {
      from: 'pending',
      to: 'confirmed',
      evidenceGate: 'uses_review_asset_evidence_policy',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'needs_evidence',
      to: 'confirmed',
      evidenceGate: 'uses_review_asset_evidence_policy',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'needs_evidence',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'rejected',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'excluded',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'confirmed',
      to: 'stale',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'stale',
      to: 'needs_evidence',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
  ],
} as const satisfies AnalysisReviewTransitionPolicy;

const expectedConfirmationEvidencePolicy = {
  statusField: 'reviewStatus',
  evidencePolicyField: 'evidencePolicy',
  confirmationStatus: 'confirmed',
  evidenceRequiredWhenPolicy: 'required_for_confirmation',
  evidenceNotRequiredPolicyValues: ['not_required', 'optional'],
  requiredEvidenceAnchor: 'valid_evidence_anchor',
  userAcceptanceMaySubstituteEvidence: false,
} as const satisfies AnalysisReviewConfirmationEvidencePolicy;

const expectedCriticalConclusionEvidencePolicy = {
  appliesTo: 'critical_conclusion',
  confirmationStatus: 'confirmed',
  requiredEvidencePolicy: 'required_for_confirmation',
  requiredEvidenceAssetKind: 'evidence_anchor',
  requiredEvidenceAnchor: 'valid_evidence_anchor',
  userAcceptanceMaySubstituteEvidence: false,
} as const satisfies AnalysisCriticalConclusionEvidencePolicy;

const expectedInsufficientEvidencePolicy = {
  insufficientEvidenceStatus: 'needs_evidence',
  blockedAssetKinds: ['reusable_technique_candidate'],
  blockedTargets: ['technique_entry', 'original_context'],
  mayCreateReusableTechniqueCandidate: false,
  mayReferenceFromOriginalContext: false,
} as const satisfies AnalysisInsufficientEvidenceParticipationPolicy;

describe('analysis review state contract', () => {
  it('keeps revision state out of module instance identity', () => {
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.identityFields).toEqual([
      'id',
      'bookId',
      'moduleId',
      'scope',
    ]);
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.identityFields).not.toContain(
      'analysisRevision',
    );
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.revisionField).toBe('analysisRevision');
  });

  it('defines the minimum review asset status vocabulary separately from module instance statuses', () => {
    expect(confirmedReviewStatus).toBe('confirmed');
    expect(REVIEW_ASSET_STATUSES).toEqual(expectedReviewStatuses);
    expect(REVIEW_ASSET_STATUSES).not.toContain('generated_pending_review');
    expect(MODULE_INSTANCE_STATUSES).toContain('generated_pending_review');
  });

  it('defines the minimum evidence policy vocabulary without replacing EvidenceAnchor validation', () => {
    expect(requiredEvidencePolicy).toBe('required_for_confirmation');
    expect(EVIDENCE_POLICIES).toEqual([
      'not_required',
      'optional',
      'required_for_confirmation',
    ]);
    expect(ANALYSIS_REVIEW_ASSET_CONTRACT.evidencePolicyField).toBe('evidencePolicy');
  });

  it('uses ReviewAsset evidencePolicy to decide whether confirmation requires evidence', () => {
    expect(ANALYSIS_REVIEW_CONFIRMATION_EVIDENCE_POLICY).toEqual(
      expectedConfirmationEvidencePolicy,
    );
    expect(
      ANALYSIS_REVIEW_TRANSITION_POLICY.allowedTransitions
        .filter((transition) => transition.to === 'confirmed')
        .every((transition) => transition.evidenceGate === 'uses_review_asset_evidence_policy'),
    ).toBe(true);
    expect(
      ANALYSIS_REVIEW_CONFIRMATION_EVIDENCE_POLICY.evidenceNotRequiredPolicyValues,
    ).toEqual(['not_required', 'optional']);
  });

  it('anchors review transitions on ReviewAsset status instead of a scheduler workflow', () => {
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY).toEqual(expectedTransitionPolicy);
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY.statusField).toBe(
      ANALYSIS_REVIEW_ASSET_CONTRACT.statusField,
    );
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY.statuses).toEqual(REVIEW_ASSET_STATUSES);
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY.definesCompleteWorkflow).toBe(false);
  });

  it('requires valid EvidenceAnchor before any critical conclusion can be confirmed', () => {
    expect(evidenceRequirement).toBe('valid_evidence_anchor');
    expect(ANALYSIS_CRITICAL_CONCLUSION_EVIDENCE_POLICY).toEqual(
      expectedCriticalConclusionEvidencePolicy,
    );

    const confirmationTransitions = ANALYSIS_REVIEW_TRANSITION_POLICY.allowedTransitions.filter(
      (transition) => transition.to === 'confirmed',
    );

    expect(confirmationTransitions.length).toBeGreaterThan(0);
    expect(ANALYSIS_CRITICAL_CONCLUSION_EVIDENCE_POLICY.requiredEvidencePolicy).toBe(
      'required_for_confirmation',
    );
    expect(
      confirmationTransitions.every(
        (transition) => transition.evidenceGate === 'uses_review_asset_evidence_policy',
      ),
    ).toBe(true);
    expect(
      confirmationTransitions.every(
        (transition) => transition.userAcceptanceMaySubstituteEvidence === false,
      ),
    ).toBe(true);
  });

  it('blocks insufficient evidence from technique candidates and original context references', () => {
    expect(ANALYSIS_INSUFFICIENT_EVIDENCE_PARTICIPATION_POLICY).toEqual(
      expectedInsufficientEvidencePolicy,
    );
  });
});
