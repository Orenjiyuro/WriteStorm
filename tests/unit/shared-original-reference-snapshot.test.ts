import { describe, expect, it } from 'vitest';
import {
  ORIGINAL_REFERENCE_SNAPSHOT_POLICY,
  originalReferenceSnapshotSchema,
  type OriginalReferenceSnapshot,
  type ReusableTechniqueCandidateId,
  type SourceSnapshot,
  type SourceSnapshotId,
  type SourceSnapshotRedactedText,
  type TechniqueEntryId,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type { BreakdownBookId, EvidenceAnchorId } from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const observationId = 'observation-1' as WorkTechniqueObservationId;
const sourceSnapshotId = 'snapshot-1' as SourceSnapshotId;
const techniqueEntryId = 'technique-entry-1' as TechniqueEntryId;
const evidenceAnchorId = 'evidence-1' as EvidenceAnchorId;

const snapshotTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'full_original_excerpts',
] as const;

const evidenceSummary = {
  kind: 'redacted_evidence_summary',
  text: 'Evidence summarized as abstract function and scope for future original reference.',
  excludes: snapshotTextExcludes,
} satisfies SourceSnapshotRedactedText;

const sourceSnapshot = {
  id: sourceSnapshotId,
  sourceBookId: bookId,
  sourceCandidateId: candidateId,
  sourceObservationIds: [observationId],
  capturedAt: '2026-07-08T00:00:00.000Z',
  summary: {
    kind: 'redacted_summary',
    text: 'Technique source summarized without source-specific names or sentences.',
    excludes: snapshotTextExcludes,
  },
  evidenceSummary,
  traceability: 'readonly_source_trace',
} satisfies SourceSnapshot;

const confirmedCandidateReference = {
  snapshotKind: 'original_reference_snapshot',
  sourceTechniqueAssetKind: 'reusable_technique_candidate',
  sourceCandidateId: candidateId,
  sourceCandidateReviewStatus: 'confirmed',
  capturedAt: '2026-07-08T00:00:00.000Z',
  sourceSnapshot,
  followsSourceMutations: false,
  mayReferenceRawEvidenceAnchor: false,
  mayReferenceDraftTechniqueEntry: false,
  mayReferenceUnconfirmedAiAsset: false,
} satisfies OriginalReferenceSnapshot;

const organizedEntryReference = {
  snapshotKind: 'original_reference_snapshot',
  sourceTechniqueAssetKind: 'technique_entry',
  sourceTechniqueEntryId: techniqueEntryId,
  sourceTechniqueEntryStatus: 'organized',
  capturedAt: '2026-07-08T00:00:00.000Z',
  sourceSnapshot,
  followsSourceMutations: false,
  mayReferenceRawEvidenceAnchor: false,
  mayReferenceDraftTechniqueEntry: false,
  mayReferenceUnconfirmedAiAsset: false,
} satisfies OriginalReferenceSnapshot;

const invalidPendingCandidateReference = {
  ...confirmedCandidateReference,
  // @ts-expect-error Original references require confirmed candidate review status.
  sourceCandidateReviewStatus: 'pending',
} satisfies OriginalReferenceSnapshot;

const invalidDraftEntryReference = {
  ...organizedEntryReference,
  // @ts-expect-error Original references require organized TechniqueEntry status.
  sourceTechniqueEntryStatus: 'draft',
} satisfies OriginalReferenceSnapshot;

const invalidRawEvidenceReference = {
  ...organizedEntryReference,
  // @ts-expect-error OriginalReferenceSnapshot must not reference raw EvidenceAnchor ids.
  evidenceAnchorIds: [evidenceAnchorId],
} satisfies OriginalReferenceSnapshot;

const invalidOriginalBookData = {
  ...organizedEntryReference,
  // @ts-expect-error Task 4.7 reserves a placeholder only and must not create OriginalBook data.
  originalBookId: 'original-book-1',
} satisfies OriginalReferenceSnapshot;

describe('original reference snapshot placeholder contract', () => {
  it('allows only confirmed candidates or organized technique entries as future sources', () => {
    expect(ORIGINAL_REFERENCE_SNAPSHOT_POLICY.allowedSources).toEqual([
      {
        sourceTechniqueAssetKind: 'reusable_technique_candidate',
        requiredReviewStatus: 'confirmed',
      },
      {
        sourceTechniqueAssetKind: 'technique_entry',
        requiredEntryStatus: 'organized',
      },
    ]);
  });

  it('stores a snapshot and never follows source mutations', () => {
    expect(confirmedCandidateReference.sourceSnapshot).toBe(sourceSnapshot);
    expect(organizedEntryReference.sourceSnapshot).toBe(sourceSnapshot);
    expect(ORIGINAL_REFERENCE_SNAPSHOT_POLICY.storesSourceSnapshot).toBe(true);
    expect(ORIGINAL_REFERENCE_SNAPSHOT_POLICY.followsSourceMutations).toBe(false);
  });

  it('blocks raw evidence, draft entries, unconfirmed AI assets, and OriginalBook data', () => {
    expect(ORIGINAL_REFERENCE_SNAPSHOT_POLICY).toMatchObject({
      mayReferenceRawEvidenceAnchor: false,
      mayReferenceDraftTechniqueEntry: false,
      mayReferenceUnconfirmedAiAsset: false,
      createsOriginalBookData: false,
    });
  });

  it('validates placeholder snapshots at runtime', () => {
    expect(originalReferenceSnapshotSchema.safeParse(confirmedCandidateReference).success).toBe(true);
    expect(originalReferenceSnapshotSchema.safeParse(organizedEntryReference).success).toBe(true);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...confirmedCandidateReference,
        sourceCandidateReviewStatus: 'pending',
      }).success,
    ).toBe(false);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...organizedEntryReference,
        sourceTechniqueEntryStatus: 'draft',
      }).success,
    ).toBe(false);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...organizedEntryReference,
        evidenceAnchorIds: [evidenceAnchorId],
      }).success,
    ).toBe(false);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...organizedEntryReference,
        originalBookId: 'original-book-1',
      }).success,
    ).toBe(false);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...organizedEntryReference,
        capturedAt: 'not-a-date',
      }).success,
    ).toBe(false);

    expect(
      originalReferenceSnapshotSchema.safeParse({
        ...organizedEntryReference,
        sourceSnapshot: {
          ...sourceSnapshot,
          capturedAt: 'not-a-date',
        },
      }).success,
    ).toBe(false);
  });
});
