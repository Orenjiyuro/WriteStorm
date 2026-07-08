import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CRITICAL_CONCLUSION_EVIDENCE_POLICY,
  ANALYSIS_INSUFFICIENT_EVIDENCE_PARTICIPATION_POLICY,
  ANALYSIS_REVIEW_ASSET_CONTRACT,
  ANALYSIS_REVIEW_STATUSES,
  ANALYSIS_REVIEW_TRANSITION_POLICY,
  MODULE_INSTANCE_STATUSES,
  type AnalysisCriticalConclusionEvidencePolicy,
  type AnalysisEvidenceAnchorRequirement,
  type AnalysisInsufficientEvidenceParticipationPolicy,
  type AnalysisReviewStatus,
  type AnalysisReviewTransitionPolicy,
} from '../../src/shared/domain';

const confirmedReviewStatus: AnalysisReviewStatus = 'confirmed';
const evidenceRequirement: AnalysisEvidenceAnchorRequirement = 'valid_evidence_anchor';

// @ts-expect-error Review assets use pending, not the module instance generation status.
const invalidReviewStatus: AnalysisReviewStatus = 'generated_pending_review';

// @ts-expect-error User acceptance is not a valid evidence anchor.
const invalidEvidenceRequirement: AnalysisEvidenceAnchorRequirement = 'user_subjective_acceptance';

const expectedReviewStatuses = [
  'pending',
  'confirmed',
  'rejected',
  'excluded',
  'needs_evidence',
  'stale',
] as const satisfies readonly AnalysisReviewStatus[];

const expectedTransitionPolicy = {
  statusFieldKind: 'review_status',
  initialStatus: 'pending',
  statuses: expectedReviewStatuses,
  allowedTransitions: [
    {
      from: 'pending',
      to: 'confirmed',
      requiresValidEvidenceAnchor: true,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'needs_evidence',
      to: 'confirmed',
      requiresValidEvidenceAnchor: true,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'needs_evidence',
      requiresValidEvidenceAnchor: false,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'rejected',
      requiresValidEvidenceAnchor: false,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'excluded',
      requiresValidEvidenceAnchor: false,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'confirmed',
      to: 'stale',
      requiresValidEvidenceAnchor: false,
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'stale',
      to: 'needs_evidence',
      requiresValidEvidenceAnchor: false,
      userAcceptanceMaySubstituteEvidence: false,
    },
  ],
} as const satisfies AnalysisReviewTransitionPolicy;

const expectedCriticalConclusionEvidencePolicy = {
  appliesTo: 'critical_conclusion',
  confirmationStatus: 'confirmed',
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
  it('defines the minimum review asset status vocabulary separately from module instance statuses', () => {
    expect(confirmedReviewStatus).toBe('confirmed');
    expect(ANALYSIS_REVIEW_STATUSES).toEqual(expectedReviewStatuses);
    expect(ANALYSIS_REVIEW_STATUSES).not.toContain('generated_pending_review');
    expect(MODULE_INSTANCE_STATUSES).toContain('generated_pending_review');
  });

  it('anchors review transitions on ReviewAsset status instead of a scheduler workflow', () => {
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY).toEqual(expectedTransitionPolicy);
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY.statusFieldKind).toBe(
      ANALYSIS_REVIEW_ASSET_CONTRACT.statusFieldKind,
    );
    expect(ANALYSIS_REVIEW_TRANSITION_POLICY.statuses).toEqual(ANALYSIS_REVIEW_STATUSES);
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
    expect(
      confirmationTransitions.every((transition) => transition.requiresValidEvidenceAnchor),
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
