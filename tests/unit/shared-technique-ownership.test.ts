import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_ASSET_OWNERSHIP,
  type ReusableTechniqueCandidate,
  type ReusableTechniqueCandidateId,
  type TechniqueEntry,
  type TechniqueEntryId,
  type WorkTechniqueObservation,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type {
  BreakdownBookId,
  EvidenceAnchorId,
  LibraryId,
  SourceSnapshot,
  SourceSnapshotId,
  SourceSnapshotRedactedText,
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const libraryId = 'library-1' as LibraryId;
const evidenceAnchorId = 'evidence-1' as EvidenceAnchorId;
const observationId = 'observation-1' as WorkTechniqueObservationId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const sourceSnapshotId = 'source-snapshot-1' as SourceSnapshotId;
const techniqueEntryId = 'technique-entry-1' as TechniqueEntryId;

const observation = {
  id: observationId,
  ownerKind: 'breakdown_book',
  bookId,
  evidenceAnchorIds: [evidenceAnchorId],
} satisfies WorkTechniqueObservation;

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

const snapshotTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'full_original_excerpts',
] as const;

const evidenceSummary = {
  kind: 'redacted_evidence_summary',
  text: 'Evidence summarized by function and scope, not by source evidence anchor mutation.',
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

const entry = {
  id: techniqueEntryId,
  ownerKind: 'technique_library',
  libraryId,
  status: 'draft',
  sourceSnapshot,
} satisfies TechniqueEntry;

// @ts-expect-error WorkTechniqueObservation stays in the breakdown book domain.
const invalidObservationOwner = { ...observation, ownerKind: 'technique_library' } satisfies WorkTechniqueObservation;

// @ts-expect-error ReusableTechniqueCandidate stays in the breakdown book domain.
const invalidCandidateOwner = { ...candidate, ownerKind: 'technique_library' } satisfies ReusableTechniqueCandidate;

// @ts-expect-error TechniqueEntry is a technique library asset, not a breakdown book asset.
const invalidEntryOwner = { ...entry, ownerKind: 'breakdown_book', bookId } satisfies TechniqueEntry;

// @ts-expect-error TechniqueEntry cannot carry a patch that overwrites its source candidate.
const invalidEntrySourceOverwrite = { ...entry, sourceCandidatePatch: candidate } satisfies TechniqueEntry;

// @ts-expect-error TechniqueEntry and ReusableTechniqueCandidate are separate object layers.
const invalidEntryAsCandidate: ReusableTechniqueCandidate = entry;

describe('technique asset ownership contract', () => {
  it('keeps observations and reusable candidates owned by the breakdown book', () => {
    expect(observation.ownerKind).toBe('breakdown_book');
    expect(candidate.ownerKind).toBe('breakdown_book');
    expect(candidate.sourceObservationIds).toEqual([observationId]);
  });

  it('keeps technique entries owned by the technique library', () => {
    expect(entry.ownerKind).toBe('technique_library');
    expect(entry.libraryId).toBe(libraryId);
    expect('bookId' in entry).toBe(false);
    expect('sourceCandidatePatch' in entry).toBe(false);
  });

  it('locks the three technique object layers without a mutable mirror relationship', () => {
    expect(TECHNIQUE_ASSET_OWNERSHIP).toEqual({
      workTechniqueObservation: {
        assetKind: 'work_technique_observation',
        ownerKind: 'breakdown_book',
        ownerIdField: 'bookId',
        mayCreateTechniqueEntry: false,
        canBeEditedFromTechniqueLibrary: false,
      },
      reusableTechniqueCandidate: {
        assetKind: 'reusable_technique_candidate',
        ownerKind: 'breakdown_book',
        ownerIdField: 'bookId',
        mayCreateTechniqueEntry: true,
        canBeEditedFromTechniqueLibrary: false,
      },
      techniqueEntry: {
        assetKind: 'technique_entry',
        ownerKind: 'technique_library',
        ownerIdField: 'libraryId',
        mayCreateTechniqueEntry: false,
        canBeEditedFromTechniqueLibrary: true,
        writesBackToSourceCandidate: false,
        isMutableMirrorOfSourceCandidate: false,
      },
    });
  });
});
