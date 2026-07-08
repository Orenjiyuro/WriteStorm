import { describe, expect, it } from 'vitest';
import {
  SOURCE_SNAPSHOT_CONTENT_POLICY,
  SOURCE_SNAPSHOT_TRACEABILITY_POLICY,
  createSourceSnapshotSchema,
  isSourceSnapshotContentShapeSafe,
  sourceSnapshotSchema,
  type ReusableTechniqueCandidateId,
  type SourceSnapshot,
  type SourceSnapshotId,
  type SourceSnapshotRedactedText,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type { BreakdownBookId } from '../../src/shared/domain';

const sourceBookId = 'book-1' as BreakdownBookId;
const sourceCandidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const sourceObservationId = 'observation-1' as WorkTechniqueObservationId;
const sourceSnapshotId = 'snapshot-1' as SourceSnapshotId;

const redactedSummary = {
  kind: 'redacted_summary',
  text: 'A reusable escalation technique captured without proper nouns or source phrasing.',
  excludes: ['character_names', 'proprietary_setting_terms', 'original_sentences', 'full_original_excerpts'],
} satisfies SourceSnapshotRedactedText;

const redactedEvidenceSummary = {
  kind: 'redacted_evidence_summary',
  text: 'Evidence summarized by function and scope, not by copied source text.',
  excludes: ['character_names', 'proprietary_setting_terms', 'original_sentences', 'full_original_excerpts'],
} satisfies SourceSnapshotRedactedText;

const sourceSnapshot = {
  id: sourceSnapshotId,
  sourceBookId,
  sourceCandidateId,
  sourceObservationIds: [sourceObservationId],
  capturedAt: '2026-07-08T00:00:00.000Z',
  summary: redactedSummary,
  evidenceSummary: redactedEvidenceSummary,
  traceability: 'readonly_source_trace',
} satisfies SourceSnapshot;

const forbiddenFixture = {
  characterName: 'Lin Qiu',
  proprietarySettingTerm: 'Mirror Dominion',
  originalSentence: 'Lin Qiu opened the mirror gate and the city answered in blue fire.',
  fullOriginalExcerpt:
    'Lin Qiu opened the mirror gate and the city answered in blue fire. Every oath became a key, every key became a storm.',
};

// @ts-expect-error SourceSnapshot must store a capturedAt string, not a Date instance.
const invalidCapturedAt = { ...sourceSnapshot, capturedAt: new Date() } satisfies SourceSnapshot;

// @ts-expect-error SourceSnapshot summaries use redacted text envelopes, not raw source text strings.
const invalidRawSummary = { ...sourceSnapshot, summary: forbiddenFixture.originalSentence } satisfies SourceSnapshot;

const invalidOriginalExcerptField = {
  ...sourceSnapshot,
  // @ts-expect-error SourceSnapshot must not preserve complete source excerpts as a field.
  originalExcerpt: forbiddenFixture.fullOriginalExcerpt,
} satisfies SourceSnapshot;

const invalidCharacterNameField = {
  ...sourceSnapshot,
  // @ts-expect-error SourceSnapshot must not preserve character names as a field.
  characterName: forbiddenFixture.characterName,
} satisfies SourceSnapshot;

const invalidProprietarySettingField = {
  ...sourceSnapshot,
  // @ts-expect-error SourceSnapshot must not preserve proprietary setting names as a field.
  proprietarySettingName: forbiddenFixture.proprietarySettingTerm,
} satisfies SourceSnapshot;

describe('source snapshot contract', () => {
  it('captures stable source ids, captured time, summary, and evidence summary', () => {
    expect(sourceSnapshot).toEqual({
      id: sourceSnapshotId,
      sourceBookId,
      sourceCandidateId,
      sourceObservationIds: [sourceObservationId],
      capturedAt: '2026-07-08T00:00:00.000Z',
      summary: redactedSummary,
      evidenceSummary: redactedEvidenceSummary,
      traceability: 'readonly_source_trace',
    });
  });

  it('keeps source snapshots readonly after source candidates or observations change', () => {
    expect(SOURCE_SNAPSHOT_TRACEABILITY_POLICY).toEqual({
      traceability: 'readonly_source_trace',
      survivesSourceDeletion: true,
      survivesSourceMutation: true,
      mayWriteBackToSourceBook: false,
      mayWriteBackToSourceCandidate: false,
      mayWriteBackToSourceObservation: false,
    });
  });

  it('requires redacted summary envelopes instead of source text fields', () => {
    expect(SOURCE_SNAPSHOT_CONTENT_POLICY).toEqual({
      summaryKind: 'redacted_summary',
      evidenceSummaryKind: 'redacted_evidence_summary',
      forbiddenFieldNames: [
        'originalText',
        'originalSentence',
        'originalExcerpt',
        'fullOriginalExcerpt',
        'characterName',
        'roleName',
        'properSettingName',
        'proprietarySettingName',
        'proprietarySettingBody',
      ],
      forbiddenContentKinds: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'full_original_excerpts',
      ],
    });
  });

  it('rejects character names, proprietary settings, original sentences, and full excerpts as content shape', () => {
    const unsafeTexts = [
      forbiddenFixture.characterName,
      forbiddenFixture.proprietarySettingTerm,
      forbiddenFixture.originalSentence,
      forbiddenFixture.fullOriginalExcerpt,
    ];

    for (const unsafeText of unsafeTexts) {
      expect(
        isSourceSnapshotContentShapeSafe(
          {
            ...redactedSummary,
            text: unsafeText,
          },
          forbiddenFixture,
        ),
      ).toBe(false);
    }

    expect(isSourceSnapshotContentShapeSafe(redactedSummary, forbiddenFixture)).toBe(true);
  });

  it('rejects incomplete redaction envelopes and forbidden content at runtime', () => {
    expect(
      sourceSnapshotSchema.safeParse({
        ...sourceSnapshot,
        summary: {
          ...redactedSummary,
          excludes: [],
        },
      }).success,
    ).toBe(false);

    expect(
      createSourceSnapshotSchema(forbiddenFixture).safeParse({
        ...sourceSnapshot,
        evidenceSummary: {
          ...redactedEvidenceSummary,
          text: forbiddenFixture.fullOriginalExcerpt,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects non-ISO capturedAt values at runtime', () => {
    expect(
      sourceSnapshotSchema.safeParse({
        ...sourceSnapshot,
        capturedAt: 'not-a-date',
      }).success,
    ).toBe(false);
  });
});
