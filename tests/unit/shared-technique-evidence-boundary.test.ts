import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  techniqueEntrySchema,
  type ReusableTechniqueCandidate,
  type ReusableTechniqueCandidateId,
  type SourceSnapshot,
  type SourceSnapshotId,
  type SourceSnapshotRedactedText,
  type TechniqueEntry,
  type TechniqueEntryId,
  type WorkTechniqueObservation,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type { BreakdownBookId, EvidenceAnchorId, LibraryId } from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const libraryId = 'library-1' as LibraryId;
const evidenceAnchorId = 'evidence-1' as EvidenceAnchorId;
const observationId = 'observation-1' as WorkTechniqueObservationId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const sourceSnapshotId = 'snapshot-1' as SourceSnapshotId;
const techniqueEntryId = 'technique-entry-1' as TechniqueEntryId;

const candidateTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'character_specific_actions',
  'plot_reenactment',
] as const;

const patternTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'character_specific_actions',
  'plot_reenactment',
] as const;

const snapshotTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'full_original_excerpts',
] as const;

const observation = {
  id: observationId,
  ownerKind: 'breakdown_book',
  bookId,
  evidenceAnchorIds: [evidenceAnchorId],
} satisfies WorkTechniqueObservation;

const candidate = {
  id: candidateId,
  ownerKind: 'breakdown_book',
  bookId,
  sourceObservationIds: [observationId],
  evidenceAnchorIds: [evidenceAnchorId],
  reusablePrinciple: {
    kind: 'reusable_principle',
    text: 'Convert a private decision into a public consequence through an abstract story mechanism.',
    excludes: candidateTextExcludes,
  },
  applicableScope: {
    kind: 'applicable_scope',
    text: 'Useful when a local choice needs broader scene pressure without source-specific lore.',
    excludes: candidateTextExcludes,
  },
  limitations: [
    {
      kind: 'limitation',
      text: 'Requires a previously established rule or social consequence.',
      excludes: candidateTextExcludes,
    },
  ],
  problemSolutionPattern: {
    problemType: {
      kind: 'problem_type',
      text: 'Private choice needs public consequence.',
      excludes: patternTextExcludes,
    },
    setupConditions: {
      kind: 'setup_conditions',
      text: 'A local decision has stakes but lacks visible story pressure.',
      excludes: patternTextExcludes,
    },
    solutionMechanism: {
      kind: 'solution_mechanism',
      text: 'Externalize the decision through a consequence other people can react to.',
      excludes: patternTextExcludes,
    },
    rhythmPosition: {
      kind: 'rhythm_position',
      text: 'Mid-scene reversal.',
      excludes: patternTextExcludes,
    },
    emotionalFunction: {
      kind: 'emotional_function',
      text: 'Converts hesitation into urgency.',
      excludes: patternTextExcludes,
    },
    applicableLimits: [
      {
        kind: 'applicable_limit',
        text: 'Requires an established rule.',
        excludes: patternTextExcludes,
      },
    ],
  },
} satisfies ReusableTechniqueCandidate;

const evidenceSummary = {
  kind: 'redacted_evidence_summary',
  text: 'Evidence summarized as abstract function and scope after adoption.',
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

const techniqueEntry = {
  id: techniqueEntryId,
  ownerKind: 'technique_library',
  libraryId,
  status: 'draft',
  sourceSnapshot,
} satisfies TechniqueEntry;

const invalidDuplicateEntryEvidenceSummary = {
  ...techniqueEntry,
  // @ts-expect-error TechniqueEntry reads evidence summary from SourceSnapshot, not a second writable field.
  evidenceSummary,
} satisfies TechniqueEntry;

const invalidEntryEvidenceAnchorReference = {
  ...techniqueEntry,
  // @ts-expect-error TechniqueEntry must use SourceSnapshot + evidenceSummary, not EvidenceAnchorId references.
  evidenceAnchorIds: [evidenceAnchorId],
} satisfies TechniqueEntry;

const invalidEntryEvidenceStateMutation = {
  ...techniqueEntry,
  // @ts-expect-error TechniqueEntry edits must not mutate source EvidenceAnchor state.
  sourceEvidenceStatusPatch: {
    evidenceAnchorId,
    status: 'stale',
  },
} satisfies TechniqueEntry;

const invalidObservationSnapshotReference = {
  ...observation,
  // @ts-expect-error Breakdown-book observations reference EvidenceAnchorId, not SourceSnapshot.
  sourceSnapshot,
} satisfies WorkTechniqueObservation;

describe('technique evidence chain boundary', () => {
  it('keeps breakdown-book observations and candidates on EvidenceAnchorId references', () => {
    expect(observation.evidenceAnchorIds).toEqual([evidenceAnchorId]);
    expect(candidate.evidenceAnchorIds).toEqual([evidenceAnchorId]);
    expect('sourceSnapshot' in observation).toBe(false);
    expect('sourceSnapshot' in candidate).toBe(false);
  });

  it('keeps technique entries on SourceSnapshot with nested redacted evidenceSummary', () => {
    expect(techniqueEntry.sourceSnapshot).toBe(sourceSnapshot);
    expect(techniqueEntry.sourceSnapshot.evidenceSummary).toBe(evidenceSummary);
    expect('evidenceSummary' in techniqueEntry).toBe(false);
    expect('evidenceAnchorIds' in techniqueEntry).toBe(false);
    expect('sourceEvidenceStatusPatch' in techniqueEntry).toBe(false);
  });

  it('rejects TechniqueEntry evidence summary drift at runtime', () => {
    expect(techniqueEntrySchema.safeParse(techniqueEntry).success).toBe(true);

    expect(
      techniqueEntrySchema.safeParse({
        ...techniqueEntry,
        evidenceSummary: {
          kind: 'redacted_evidence_summary',
          text: 'A second evidence summary that can drift from the snapshot.',
          excludes: snapshotTextExcludes,
        },
      }).success,
    ).toBe(false);
  });

  it('locks EvidenceAnchor out of cross-domain mutable technique library facts', () => {
    expect(TECHNIQUE_EVIDENCE_CHAIN_POLICY).toEqual({
      breakdownBookAssets: {
        workTechniqueObservation: {
          evidenceReferenceField: 'evidenceAnchorIds',
          mayUseEvidenceAnchorIds: true,
          mayUseSourceSnapshot: false,
        },
        reusableTechniqueCandidate: {
          evidenceReferenceField: 'evidenceAnchorIds',
          mayUseEvidenceAnchorIds: true,
          mayUseSourceSnapshot: false,
        },
      },
      techniqueEntry: {
        sourceSnapshotField: 'sourceSnapshot',
        evidenceSummarySource: 'sourceSnapshot.evidenceSummary',
        mayUseEvidenceAnchorIds: false,
        mayMutateSourceEvidenceState: false,
        sourceEvidenceStateIsReadonly: true,
      },
    });
  });

  it('keeps source evidence changes from becoming technique library edits', () => {
    const sourceEvidenceChange = {
      evidenceAnchorId,
      from: 'confirmed',
      to: 'stale',
    };

    expect(sourceEvidenceChange.to).toBe('stale');
    expect(techniqueEntry.sourceSnapshot.traceability).toBe('readonly_source_trace');
    expect(TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry.mayMutateSourceEvidenceState).toBe(false);
  });
});
