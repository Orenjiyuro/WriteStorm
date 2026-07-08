import { describe, expect, it } from 'vitest';
import {
  TECHNIQUE_ENTRY_STATE_MACHINE,
  TECHNIQUE_ENTRY_STATUSES,
  isTechniqueEntryStatusTransitionAllowed,
  techniqueEntrySchema,
  type ReusableTechniqueCandidateId,
  type SourceSnapshot,
  type SourceSnapshotId,
  type SourceSnapshotRedactedText,
  type TechniqueEntry,
  type TechniqueEntryId,
  type TechniqueEntryStatus,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type { BreakdownBookId, LibraryId } from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const libraryId = 'library-1' as LibraryId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const observationId = 'observation-1' as WorkTechniqueObservationId;
const sourceSnapshotId = 'snapshot-1' as SourceSnapshotId;
const techniqueEntryId = 'technique-entry-1' as TechniqueEntryId;

const snapshotTextExcludes = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'full_original_excerpts',
] as const;

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

const entry = {
  id: techniqueEntryId,
  ownerKind: 'technique_library',
  libraryId,
  status: 'draft',
  sourceSnapshot,
} satisfies TechniqueEntry;

// @ts-expect-error TechniqueEntryStatus is limited to the V1 state machine states.
const invalidStatus: TechniqueEntryStatus = 'merged';

// @ts-expect-error TechniqueEntry must not expose automatic merge output.
const invalidAutoMergeResult = { ...entry, autoMergedEntryId: techniqueEntryId } satisfies TechniqueEntry;

describe('technique entry state machine', () => {
  it('defines the V1 TechniqueEntry states', () => {
    expect(TECHNIQUE_ENTRY_STATUSES).toEqual(['draft', 'organized', 'pending_merge', 'deprecated']);
    expect(entry.status).toBe('draft');
  });

  it('locks allowed TechniqueEntry status transitions', () => {
    expect(TECHNIQUE_ENTRY_STATE_MACHINE).toEqual({
      initialStatus: 'draft',
      statuses: ['draft', 'organized', 'pending_merge', 'deprecated'],
      allowedTransitions: [
        { from: 'draft', to: 'organized' },
        { from: 'draft', to: 'deprecated' },
        { from: 'organized', to: 'pending_merge' },
        { from: 'organized', to: 'deprecated' },
        { from: 'pending_merge', to: 'organized' },
        { from: 'pending_merge', to: 'deprecated' },
      ],
      pendingMergeSemantics: {
        meaning: 'organization_only',
        triggersAutomaticMerge: false,
        createsMergedTechniqueEntry: false,
        requiresManualResolution: true,
      },
    });
  });

  it('checks status transitions without inventing automatic merge behavior', () => {
    expect(isTechniqueEntryStatusTransitionAllowed('draft', 'organized')).toBe(true);
    expect(isTechniqueEntryStatusTransitionAllowed('organized', 'pending_merge')).toBe(true);
    expect(isTechniqueEntryStatusTransitionAllowed('pending_merge', 'organized')).toBe(true);

    expect(isTechniqueEntryStatusTransitionAllowed('pending_merge', 'draft')).toBe(false);
    expect(isTechniqueEntryStatusTransitionAllowed('deprecated', 'organized')).toBe(false);
    expect(TECHNIQUE_ENTRY_STATE_MACHINE.pendingMergeSemantics.triggersAutomaticMerge).toBe(false);
    expect(TECHNIQUE_ENTRY_STATE_MACHINE.pendingMergeSemantics.createsMergedTechniqueEntry).toBe(false);
  });

  it('validates TechniqueEntry status at runtime', () => {
    expect(techniqueEntrySchema.safeParse(entry).success).toBe(true);

    expect(
      techniqueEntrySchema.safeParse({
        ...entry,
        status: 'merged',
      }).success,
    ).toBe(false);

    expect(
      techniqueEntrySchema.safeParse({
        ...entry,
        autoMergedEntryId: techniqueEntryId,
      }).success,
    ).toBe(false);
  });
});
