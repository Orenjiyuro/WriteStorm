import type {
  BreakdownBookId,
  ReusableTechniqueCandidateId,
  SourceSnapshotId,
  WorkTechniqueObservationId,
} from './ids';
import type { IsoDateTimeString } from './dtos';
import { z } from 'zod';

const sourceSnapshotRedactedTextKinds = ['redacted_summary', 'redacted_evidence_summary'] as const;

const sourceSnapshotForbiddenContentKinds = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'full_original_excerpts',
] as const;

export type SourceSnapshotRedactedTextKind = (typeof sourceSnapshotRedactedTextKinds)[number];

export type SourceSnapshotForbiddenContentKind = (typeof sourceSnapshotForbiddenContentKinds)[number];

export type SourceSnapshotRedactedText = {
  readonly kind: SourceSnapshotRedactedTextKind;
  readonly text: string;
  readonly excludes: readonly SourceSnapshotForbiddenContentKind[];
};

export type EvidenceSummary = SourceSnapshotRedactedText & {
  readonly kind: Extract<SourceSnapshotRedactedTextKind, 'redacted_evidence_summary'>;
};

export type SourceSnapshotTraceability = 'readonly_source_trace';

export type SourceSnapshot = {
  readonly id: SourceSnapshotId;
  readonly sourceBookId: BreakdownBookId;
  readonly sourceCandidateId: ReusableTechniqueCandidateId;
  readonly sourceObservationIds: readonly WorkTechniqueObservationId[];
  readonly capturedAt: IsoDateTimeString;
  readonly summary: SourceSnapshotRedactedText & {
    readonly kind: Extract<SourceSnapshotRedactedTextKind, 'redacted_summary'>;
  };
  readonly evidenceSummary: EvidenceSummary;
  readonly traceability: SourceSnapshotTraceability;
};

export type SourceSnapshotTraceabilityPolicy = {
  readonly traceability: SourceSnapshotTraceability;
  readonly survivesSourceDeletion: true;
  readonly survivesSourceMutation: true;
  readonly mayWriteBackToSourceBook: false;
  readonly mayWriteBackToSourceCandidate: false;
  readonly mayWriteBackToSourceObservation: false;
};

export const SOURCE_SNAPSHOT_TRACEABILITY_POLICY = {
  traceability: 'readonly_source_trace',
  survivesSourceDeletion: true,
  survivesSourceMutation: true,
  mayWriteBackToSourceBook: false,
  mayWriteBackToSourceCandidate: false,
  mayWriteBackToSourceObservation: false,
} as const satisfies SourceSnapshotTraceabilityPolicy;

export type SourceSnapshotForbiddenFieldName =
  | 'originalText'
  | 'originalSentence'
  | 'originalExcerpt'
  | 'fullOriginalExcerpt'
  | 'characterName'
  | 'roleName'
  | 'properSettingName'
  | 'proprietarySettingName'
  | 'proprietarySettingBody';

export type SourceSnapshotContentPolicy = {
  readonly summaryKind: Extract<SourceSnapshotRedactedTextKind, 'redacted_summary'>;
  readonly evidenceSummaryKind: Extract<SourceSnapshotRedactedTextKind, 'redacted_evidence_summary'>;
  readonly forbiddenFieldNames: readonly SourceSnapshotForbiddenFieldName[];
  readonly forbiddenContentKinds: readonly SourceSnapshotForbiddenContentKind[];
};

export const SOURCE_SNAPSHOT_CONTENT_POLICY = {
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
  forbiddenContentKinds: sourceSnapshotForbiddenContentKinds,
} as const satisfies SourceSnapshotContentPolicy;

export type SourceSnapshotForbiddenContentFixture = {
  readonly characterName: string;
  readonly proprietarySettingTerm: string;
  readonly originalSentence: string;
  readonly fullOriginalExcerpt: string;
};

export function isSourceSnapshotContentShapeSafe(
  content: SourceSnapshotRedactedText,
  forbiddenContent: SourceSnapshotForbiddenContentFixture,
): boolean {
  const normalizedText = normalizeForSnapshotContentCheck(content.text);
  const forbiddenValues = [
    forbiddenContent.characterName,
    forbiddenContent.proprietarySettingTerm,
    forbiddenContent.originalSentence,
    forbiddenContent.fullOriginalExcerpt,
  ]
    .map(normalizeForSnapshotContentCheck)
    .filter((value) => value.length > 0);

  return forbiddenValues.every((forbiddenValue) => !normalizedText.includes(forbiddenValue));
}

function normalizeForSnapshotContentCheck(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

const sourceSnapshotForbiddenContentKindSchema = z.enum(sourceSnapshotForbiddenContentKinds);

function brandedIdSchema<TId extends string>() {
  return z.string().min(1).transform((value) => value as TId);
}

function isoDateTimeStringSchema() {
  return z
    .string()
    .refine(isIsoDateTimeString, {
      message: 'Expected an ISO datetime string with timezone.',
    })
    .transform((value) => value as IsoDateTimeString);
}

function requireCompleteSnapshotExcludes(
  excludes: readonly SourceSnapshotForbiddenContentKind[],
  addIssue: (message: string) => void,
): void {
  const missingKinds = SOURCE_SNAPSHOT_CONTENT_POLICY.forbiddenContentKinds.filter(
    (kind) => !excludes.includes(kind),
  );

  if (missingKinds.length > 0) {
    addIssue(`SourceSnapshot redaction excludes must cover: ${missingKinds.join(', ')}`);
  }
}

function createSourceSnapshotRedactedTextSchemaForKind<TKind extends SourceSnapshotRedactedTextKind>(
  kind: TKind,
  forbiddenContent?: SourceSnapshotForbiddenContentFixture,
) {
  return z
    .object({
      kind: z.literal(kind),
      text: z.string().min(1),
      excludes: z.array(sourceSnapshotForbiddenContentKindSchema),
    })
    .strict()
    .superRefine((content, context) => {
      requireCompleteSnapshotExcludes(content.excludes, (message) => {
        context.addIssue({
          code: 'custom',
          path: ['excludes'],
          message,
        });
      });

      if (forbiddenContent && !isSourceSnapshotContentShapeSafe(content, forbiddenContent)) {
        context.addIssue({
          code: 'custom',
          path: ['text'],
          message:
            'SourceSnapshot text must not include character names, proprietary settings, source sentences, or full excerpts.',
        });
      }
    });
}

export function createSourceSnapshotSchema(forbiddenContent?: SourceSnapshotForbiddenContentFixture) {
  return z
    .object({
      id: brandedIdSchema<SourceSnapshotId>(),
      sourceBookId: brandedIdSchema<BreakdownBookId>(),
      sourceCandidateId: brandedIdSchema<ReusableTechniqueCandidateId>(),
      sourceObservationIds: z.array(brandedIdSchema<WorkTechniqueObservationId>()),
      capturedAt: isoDateTimeStringSchema(),
      summary: createSourceSnapshotRedactedTextSchemaForKind('redacted_summary', forbiddenContent),
      evidenceSummary: createSourceSnapshotRedactedTextSchemaForKind(
        'redacted_evidence_summary',
        forbiddenContent,
      ),
      traceability: z.literal('readonly_source_trace'),
    })
    .strict();
}

export const sourceSnapshotRedactedTextSchema = z.union([
  createSourceSnapshotRedactedTextSchemaForKind('redacted_summary'),
  createSourceSnapshotRedactedTextSchemaForKind('redacted_evidence_summary'),
]);

export const evidenceSummarySchema = createSourceSnapshotRedactedTextSchemaForKind(
  'redacted_evidence_summary',
);

export const sourceSnapshotSchema = createSourceSnapshotSchema();

function isIsoDateTimeString(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}
