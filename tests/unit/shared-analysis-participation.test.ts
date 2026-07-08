import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY,
  ANALYSIS_AI_CONSTRAINT_PARTICIPATION_POLICY,
  ANALYSIS_EXPORT_PARTICIPATION_POLICY,
  ANALYSIS_ORIGINAL_CONTEXT_PARTICIPATION_POLICY,
  ANALYSIS_REVIEW_ASSET_CONTRACT,
  ANALYSIS_TECHNIQUE_LIBRARY_PARTICIPATION_POLICY,
  type AnalysisCandidateTechniqueLibraryParticipationState,
  type AnalysisExportParticipationKind,
  type AnalysisExportParticipationPolicy,
  type AnalysisTechniqueLibraryParticipationPolicy,
} from '../../src/shared/domain';

const bodyExportParticipation: AnalysisExportParticipationKind = 'exportable';
const structuredExportParticipation: AnalysisExportParticipationKind =
  'exportable_with_status_notice_when_unreviewed';
const adoptedCandidateState: AnalysisCandidateTechniqueLibraryParticipationState = 'adopted_candidate';

// @ts-expect-error Structured assets cannot be exported silently while unreviewed.
const invalidSilentStructuredExport: AnalysisExportParticipationKind = 'exportable_silently';

// @ts-expect-error Reusable technique candidates cannot enter the library before adoption.
const invalidTechniqueCandidateState: AnalysisCandidateTechniqueLibraryParticipationState =
  'unadopted_candidate';

const expectedExportParticipation = {
  bodyAssetKind: 'body',
  bodyParticipation: 'exportable',
  bodyRequiresStatusNotice: false,
  structuredAssetKinds: [
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
    'ai_constraint',
  ],
  structuredAssetParticipation: 'exportable_with_status_notice_when_unreviewed',
  unreviewedStructuredAssetRequiresStatusNotice: true,
} as const satisfies AnalysisExportParticipationPolicy;

const expectedTechniqueLibraryParticipation = {
  candidateAssetKind: 'reusable_technique_candidate',
  targetKind: 'technique_entry',
  requiredCandidateState: 'adopted_candidate',
  unadoptedCandidateMayCreateTechniqueEntry: false,
} as const satisfies AnalysisTechniqueLibraryParticipationPolicy;

describe('analysis module output participation rules', () => {
  it('allows body export without turning it into structured facts', () => {
    expect(bodyExportParticipation).toBe('exportable');
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY.bodyAssetKind).toBe('body');
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY.bodyParticipation).toBe('exportable');
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY.bodyRequiresStatusNotice).toBe(false);
  });

  it('requires status notice when unreviewed structured assets participate in export', () => {
    expect(structuredExportParticipation).toBe('exportable_with_status_notice_when_unreviewed');
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY).toEqual(expectedExportParticipation);
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY.structuredAssetKinds).toEqual(
      ANALYSIS_REVIEW_ASSET_CONTRACT.structuredAssetKinds,
    );
    expect(ANALYSIS_EXPORT_PARTICIPATION_POLICY.unreviewedStructuredAssetRequiresStatusNotice).toBe(true);
  });

  it('keeps reusable technique candidates out of the technique library until adoption', () => {
    expect(adoptedCandidateState).toBe('adopted_candidate');
    expect(ANALYSIS_TECHNIQUE_LIBRARY_PARTICIPATION_POLICY).toEqual(
      expectedTechniqueLibraryParticipation,
    );
  });

  it('blocks unconfirmed reusable candidates from original writing context', () => {
    expect(ANALYSIS_ORIGINAL_CONTEXT_PARTICIPATION_POLICY).toEqual({
      targetKind: 'original_context',
      candidateAssetKind: 'reusable_technique_candidate',
      requiresAdoptedCandidate: true,
      unconfirmedCandidateMayParticipate: false,
    });
  });

  it('limits AI constraint participation to confirmed source assets', () => {
    expect(ANALYSIS_AI_CONSTRAINT_PARTICIPATION_POLICY).toEqual({
      assetKind: 'ai_constraint',
      targetPageKey: 'ai_constraint_summary',
      requiresConfirmedSourceAssets: true,
      mayReferencePendingAssets: false,
      sourceAssetKinds: ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY.sourceAssetKinds,
    });
  });
});
