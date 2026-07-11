import { z } from 'zod';
import {
  DOMAIN_ERROR_CODES,
  type DomainError,
  type DomainErrorDetails,
  type JsonValue,
} from '../errors';
import {
  JOB_STATES,
  MODULE_INSTANCE_STATUSES,
  STRUCTURE_CONFIDENCE_LEVELS,
  STRUCTURE_DETECTION_RUN_STATES,
  STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS,
  STRUCTURE_OFFSET_UNIT,
  STRUCTURE_SET_STAGES,
  STRUCTURE_STORY_RANGE_MODES,
  STRUCTURE_NODE_KINDS,
  type AnalysisModuleId,
  type AnalysisModuleInstanceId,
  type BookSummary,
  type BreakdownBookId,
  type ExportId,
  type ExportStatusDto,
  type ImportSourceResult,
  type JobId,
  type JobSummary,
  type LibraryId,
  type LibrarySummary,
  type ModuleInstanceSummary,
  type SourceTextId,
  type SourceTextMetadata,
  type StorySegmentRangeDto,
  type StorySegmentRangeId,
  type CandidateStructureSet,
  type DraftStructureSet,
  type FrozenStructureSet,
  type StructureConfidence,
  type StructureDetectionRun,
  type StructureDetectionRunId,
  type StructureDetectionStartResult,
  type StructureHeadingSpan,
  type StructureSetNodeDto,
  type StructureSetId,
  type StructureSetStoryRangeDto,
  type StructureSourceSnapshot,
  type StructureWorkspace,
  type StructureNodeDto,
  type StructureNodeId,
} from '../domain';

const isoDateTimeStringSchema = z.iso.datetime({ offset: true });
const idSchema = <T extends string>() => z.string().min(1) as unknown as z.ZodType<T>;

export const libraryIdSchema = idSchema<LibraryId>();
export const breakdownBookIdSchema = idSchema<BreakdownBookId>();
export const sourceTextIdSchema = idSchema<SourceTextId>();
export const structureSetIdSchema = idSchema<StructureSetId>();
export const structureDetectionRunIdSchema = idSchema<StructureDetectionRunId>();
export const structureNodeIdSchema = idSchema<StructureNodeId>();
export const storySegmentRangeIdSchema = idSchema<StorySegmentRangeId>();
export const analysisModuleIdSchema = idSchema<AnalysisModuleId>();
export const analysisModuleInstanceIdSchema = idSchema<AnalysisModuleInstanceId>();
export const jobIdSchema = idSchema<JobId>();
export const exportIdSchema = idSchema<ExportId>();

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

export const jsonValueSchema = z.custom<JsonValue>(isJsonValue);
export const domainErrorDetailsSchema = z.record(z.string(), jsonValueSchema) as z.ZodType<DomainErrorDetails>;
export const domainErrorSchema = z.object({
  code: z.enum(DOMAIN_ERROR_CODES),
  message: z.string().min(1),
  recoverable: z.boolean(),
  details: domainErrorDetailsSchema.optional(),
}).strict() as z.ZodType<DomainError>;

export const emptyRequestSchema = z.object({}).strict();

export const librarySummarySchema = z.object({
  id: libraryIdSchema,
  name: z.string().min(1),
  rootPath: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  appVersion: z.string().min(1),
}).strict() as z.ZodType<LibrarySummary>;

export const bookSummarySchema = z.object({
  id: breakdownBookIdSchema,
  libraryId: libraryIdSchema,
  title: z.string().min(1),
  sourceTextId: sourceTextIdSchema.nullable(),
  sourceTextEdition: z.number().int().positive().nullable(),
  structureEdition: z.number().int().positive().nullable(),
  updatedAt: isoDateTimeStringSchema,
}).strict() as z.ZodType<BookSummary>;

export const sourceTextMetadataSchema = z.object({
  id: sourceTextIdSchema,
  bookId: breakdownBookIdSchema,
  fileName: z.string().min(1),
  format: z.enum(['txt', 'md']),
  sizeBytes: z.number().int().nonnegative(),
  encoding: z.string().min(1),
  contentHash: z.string().min(1),
  sourceTextEdition: z.number().int().positive(),
  importedAt: isoDateTimeStringSchema,
}).strict() as z.ZodType<SourceTextMetadata>;

const structureSourceSnapshotSchemaRaw = z.object({
  sourceTextId: sourceTextIdSchema,
  sourceTextEdition: z.number().int().positive(),
  contentHash: z.string().min(1),
  decodedTextLength: z.number().int().nonnegative(),
  offsetUnit: z.literal(STRUCTURE_OFFSET_UNIT),
}).strict();

export const structureSourceSnapshotSchema =
  structureSourceSnapshotSchemaRaw as z.ZodType<StructureSourceSnapshot>;

const structureHeadingSpanSchemaRaw = z.object({
  rawHeadingText: z.string().min(1),
  headingStartOffset: z.number().int().nonnegative(),
  headingEndOffset: z.number().int().nonnegative(),
}).strict().superRefine((heading, context) => {
  if (heading.headingEndOffset <= heading.headingStartOffset) {
    context.addIssue({
      code: 'custom',
      path: ['headingEndOffset'],
      message: 'headingEndOffset must be greater than headingStartOffset.',
    });
  }
});

export const structureHeadingSpanSchema =
  structureHeadingSpanSchemaRaw as z.ZodType<StructureHeadingSpan>;

const structureConfidenceSchemaRaw = z.object({
  score: z.number().min(0).max(1),
  level: z.enum(STRUCTURE_CONFIDENCE_LEVELS),
  lowConfidenceResolution: z.enum(STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS).nullable(),
}).strict().superRefine((confidence, context) => {
  if (confidence.level === 'low' && confidence.lowConfidenceResolution === null) {
    context.addIssue({
      code: 'custom',
      path: ['lowConfidenceResolution'],
      message: 'Low-confidence items require an explicit review resolution.',
    });
  }

  if (confidence.level !== 'low' && confidence.lowConfidenceResolution !== null) {
    context.addIssue({
      code: 'custom',
      path: ['lowConfidenceResolution'],
      message: 'Only low-confidence items may carry a review resolution.',
    });
  }
});

export const structureConfidenceSchema = structureConfidenceSchemaRaw as z.ZodType<StructureConfidence>;

const structureSetNodeSchemaRaw = z.object({
  id: structureNodeIdSchema,
  originId: structureNodeIdSchema.nullable(),
  kind: z.enum(STRUCTURE_NODE_KINDS),
  title: z.string().min(1),
  parentId: structureNodeIdSchema.nullable(),
  order: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  heading: structureHeadingSpanSchemaRaw.nullable(),
  confidence: structureConfidenceSchemaRaw,
}).strict().superRefine((node, context) => {
  if (node.endOffset <= node.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }

  if (node.heading && (
    node.heading.headingStartOffset < node.startOffset ||
    node.heading.headingEndOffset > node.endOffset
  )) {
    context.addIssue({
      code: 'custom',
      path: ['heading'],
      message: 'Heading span must stay inside the node coverage range.',
    });
  }
});

export const structureSetNodeSchema = structureSetNodeSchemaRaw as z.ZodType<StructureSetNodeDto>;

const structureSetStoryRangeSchemaRaw = z.object({
  id: storySegmentRangeIdSchema,
  originId: storySegmentRangeIdSchema.nullable(),
  title: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  coveredChapterIds: z.array(structureNodeIdSchema).min(1),
  suggestedFunctionTags: z.array(z.string().min(1)),
  boundaryEvidence: z.array(z.object({
    kind: z.enum([
      'chapter_window',
      'explicit_separator',
      'blank_line_cluster',
      'markdown_subheading',
      'length_window',
      'transition_hint',
    ]),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
  }).strict().superRefine((evidence, context) => {
    if (evidence.endOffset <= evidence.startOffset) {
      context.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'Boundary evidence endOffset must be greater than startOffset.',
      });
    }
  })).min(1),
  startReason: z.string().min(1),
  endReason: z.string().min(1),
  confidence: structureConfidenceSchemaRaw,
}).strict().superRefine((range, context) => {
  if (range.endOffset <= range.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }
});

export const structureSetStoryRangeSchema =
  structureSetStoryRangeSchemaRaw as z.ZodType<StructureSetStoryRangeDto>;

const structureSetBaseSchema = z.object({
  id: structureSetIdSchema,
  bookId: breakdownBookIdSchema,
  sourceSnapshot: structureSourceSnapshotSchemaRaw,
  nodes: z.array(structureSetNodeSchemaRaw),
  storyRanges: z.array(structureSetStoryRangeSchemaRaw),
  storyRangeMode: z.enum(STRUCTURE_STORY_RANGE_MODES),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
}).strict().superRefine((set, context) => {
  if (set.storyRangeMode === 'skipped_by_user' && set.storyRanges.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['storyRanges'],
      message: 'Skipped story range mode cannot retain story ranges.',
    });
  }
});

const candidateStructureSetSchemaRaw = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[0]),
  detectionRunId: structureDetectionRunIdSchema,
  draftRevision: z.null(),
  structureEdition: z.null(),
}).superRefine((candidate, context) => {
  for (const [collection, items] of [
    ['nodes', candidate.nodes],
    ['storyRanges', candidate.storyRanges],
  ] as const) {
    items.forEach((item, index) => {
      if (item.confidence.level === 'unusable') {
        context.addIssue({
          code: 'custom',
          path: [collection, index, 'confidence', 'level'],
          message: 'Unusable structure items cannot enter ordinary candidate success.',
        });
      }
    });
  }
});
export const candidateStructureSetSchema =
  candidateStructureSetSchemaRaw as z.ZodType<CandidateStructureSet>;

const draftStructureSetSchemaRaw = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[1]),
  detectionRunId: z.null(),
  draftRevision: z.number().int().nonnegative(),
  structureEdition: z.null(),
});
export const draftStructureSetSchema = draftStructureSetSchemaRaw as z.ZodType<DraftStructureSet>;

const frozenStructureSetSchemaRaw = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[2]),
  detectionRunId: z.null(),
  draftRevision: z.null(),
  structureEdition: z.number().int().positive(),
  frozenAt: isoDateTimeStringSchema,
});
export const frozenStructureSetSchema = frozenStructureSetSchemaRaw as z.ZodType<FrozenStructureSet>;

const structureDetectionRunSchemaRaw = z.object({
  id: structureDetectionRunIdSchema,
  bookId: breakdownBookIdSchema,
  job: z.object({
    jobId: jobIdSchema,
    checkpointKind: z.literal('structure_draft'),
  }).strict(),
  sourceSnapshot: structureSourceSnapshotSchemaRaw,
  state: z.enum(STRUCTURE_DETECTION_RUN_STATES),
  failureReason: z.string().min(1).nullable(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
}).strict().superRefine((run, context) => {
  if (run.state === 'failed' && run.failureReason === null) {
    context.addIssue({
      code: 'custom',
      path: ['failureReason'],
      message: 'Failed structure detection runs require a failure reason.',
    });
  }

  if (run.state !== 'failed' && run.failureReason !== null) {
    context.addIssue({
      code: 'custom',
      path: ['failureReason'],
      message: 'Only failed structure detection runs may carry a failure reason.',
    });
  }
});

export const structureDetectionRunSchema =
  structureDetectionRunSchemaRaw as z.ZodType<StructureDetectionRun>;

const structureWorkspaceSchemaRaw = z.object({
  bookId: breakdownBookIdSchema,
  detectionRun: structureDetectionRunSchemaRaw.nullable(),
  candidate: candidateStructureSetSchemaRaw.nullable(),
  draft: draftStructureSetSchemaRaw.nullable(),
  frozen: frozenStructureSetSchemaRaw.nullable(),
}).strict().superRefine((workspace, context) => {
  for (const [key, value] of Object.entries({
    detectionRun: workspace.detectionRun,
    candidate: workspace.candidate,
    draft: workspace.draft,
    frozen: workspace.frozen,
  })) {
    if (value && value.bookId !== workspace.bookId) {
      context.addIssue({
        code: 'custom',
        path: [key, 'bookId'],
        message: 'Structure workspace records must belong to the requested book.',
      });
    }
  }
});

export const structureWorkspaceSchema = structureWorkspaceSchemaRaw as z.ZodType<StructureWorkspace>;

export const structureNodeSchema = z.object({
  id: structureNodeIdSchema,
  bookId: breakdownBookIdSchema,
  sourceTextId: sourceTextIdSchema,
  kind: z.enum(STRUCTURE_NODE_KINDS),
  title: z.string().min(1),
  parentId: structureNodeIdSchema.nullable(),
  order: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative().nullable(),
  structureEdition: z.number().int().positive(),
}).strict().superRefine((node, context) => {
  if (node.endOffset !== null && node.endOffset <= node.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be null or greater than startOffset.',
    });
  }
}) as z.ZodType<StructureNodeDto>;

export const storySegmentRangeSchema = z.object({
  id: storySegmentRangeIdSchema,
  bookId: breakdownBookIdSchema,
  sourceTextId: sourceTextIdSchema,
  title: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  coveredChapterIds: z.array(structureNodeIdSchema).min(1),
  functionTags: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  structureEdition: z.number().int().positive(),
}).strict().superRefine((range, context) => {
  if (range.endOffset <= range.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }
}) as z.ZodType<StorySegmentRangeDto>;

export const scopeRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('book'),
    bookId: breakdownBookIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('volume'),
    nodeId: structureNodeIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('chapter'),
    nodeId: structureNodeIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('story_segment_range'),
    rangeId: storySegmentRangeIdSchema,
  }).strict(),
]);

export const moduleInstanceSummarySchema = z.object({
  id: analysisModuleInstanceIdSchema,
  bookId: breakdownBookIdSchema,
  moduleId: analysisModuleIdSchema,
  scope: scopeRefSchema,
  status: z.enum(MODULE_INSTANCE_STATUSES),
  analysisRevision: z.number().int().nonnegative(),
  updatedAt: isoDateTimeStringSchema.nullable(),
}).strict() as z.ZodType<ModuleInstanceSummary>;

export const jobSummarySchema = z.object({
  id: jobIdSchema,
  bookId: breakdownBookIdSchema.nullable(),
  state: z.enum(JOB_STATES),
  title: z.string().min(1),
  completedUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().nonnegative().nullable(),
  checkpointSummary: z.string().nullable(),
  failureReason: z.string().nullable(),
  updatedAt: isoDateTimeStringSchema,
}).strict() as z.ZodType<JobSummary>;

export const structureDetectionStartResultSchema = z.object({
  detectionRun: structureDetectionRunSchemaRaw,
  job: jobSummarySchema,
}).strict() as z.ZodType<StructureDetectionStartResult>;

export const STRUCTURE_DETECTION_ERROR_REASONS = [
  'no_current_library',
  'book_not_found',
  'source_missing',
  'source_encoding_invalid',
  'source_read_failed',
  'source_decode_failed',
  'source_hash_mismatch',
  'library_session_changed',
  'source_snapshot_stale',
  'structure_detection_in_progress',
  'structure_detection_recovery_required',
  'structure_validation_failed',
  'candidate_persistence_failed',
  'structure_worker_failed',
  'UTILITY_WORKER_TIMEOUT',
  'UTILITY_WORKER_CRASH',
  'UTILITY_WORKER_CANCELLED',
  'UTILITY_WORKER_PROTOCOL',
  'UTILITY_WORKER_DISPOSED',
] as const;

export const structureDetectionErrorReasonSchema = z.enum(STRUCTURE_DETECTION_ERROR_REASONS);
export const structureDetectionErrorDetailsSchema = z.object({
  reason: structureDetectionErrorReasonSchema,
}).strict();

const structureDetectionDomainErrorSchema = domainErrorSchema.superRefine((error, context) => {
  if (error.code !== 'STRUCTURE_ERROR') {
    return;
  }

  if (!structureDetectionErrorDetailsSchema.safeParse(error.details).success) {
    context.addIssue({
      code: 'custom',
      path: ['details'],
      message: 'STRUCTURE_ERROR details must include a stable structure detection reason.',
    });
  }
});

export const structureDetectionResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: structureDetectionStartResultSchema,
  }).strict(),
  z.object({
    ok: z.literal(false),
    error: structureDetectionDomainErrorSchema,
  }).strict(),
]);

export const importSourceResultSchema = z.object({
  book: bookSummarySchema,
  sourceText: sourceTextMetadataSchema,
  job: jobSummarySchema,
}).strict() as z.ZodType<ImportSourceResult>;

export const IMPORT_SOURCE_ERROR_REASONS = [
  'no_current_library',
  'dialog_cancelled',
  'invalid_extension',
  'not_readable',
  'file_too_large',
  'empty_file',
  'encoding_required',
  'pending_import_not_found',
  'library_session_changed',
  'duplicate_source_hash',
  'target_conflict',
  'copy_failed',
  'database_write_failed',
] as const;

export const importSourceErrorReasonSchema = z.enum(IMPORT_SOURCE_ERROR_REASONS);
const importSourceGeneralErrorDetailsSchema = z.object({
  reason: importSourceErrorReasonSchema,
  pendingImportId: z.string().min(1).optional(),
  existingBookId: breakdownBookIdSchema.optional(),
  existingSourceTextId: sourceTextIdSchema.optional(),
  relativePath: z.string().min(1).optional(),
  maxSizeBytes: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  supportedEncodings: z.array(z.enum(['utf-8', 'gb18030'])).min(1).optional(),
}).strict();

const importSourceDuplicateHashErrorDetailsSchema = z.object({
  reason: z.literal('duplicate_source_hash'),
  existingBookId: breakdownBookIdSchema,
  existingSourceTextId: sourceTextIdSchema,
}).strict();

const importSourceTargetConflictErrorDetailsSchema = z.object({
  reason: z.literal('target_conflict'),
  relativePath: z.string().min(1),
}).strict();

export const importSourceErrorDetailsSchema = z.union([
  importSourceDuplicateHashErrorDetailsSchema,
  importSourceTargetConflictErrorDetailsSchema,
  importSourceGeneralErrorDetailsSchema.superRefine((details, context) => {
    if (details.reason === 'duplicate_source_hash' || details.reason === 'target_conflict') {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: `${details.reason} requires actionable import error details.`,
      });
    }
  }),
]);

export const exportStatusSchema = z.object({
  exportId: exportIdSchema.nullable(),
  bookId: breakdownBookIdSchema,
  availability: z.enum(['blocked', 'available', 'running', 'completed']),
  blockers: z.array(z.string().min(1)),
  latestJobId: jobIdSchema.nullable(),
  updatedAt: isoDateTimeStringSchema.nullable(),
}).strict() as z.ZodType<ExportStatusDto>;

export function contractResponseSchema<TDataSchema extends z.ZodTypeAny>(dataSchema: TDataSchema) {
  return z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      data: dataSchema,
    }).strict(),
    z.object({
      ok: z.literal(false),
      error: domainErrorSchema,
    }).strict(),
  ]);
}

const importSourceDomainErrorSchema = domainErrorSchema.superRefine((error, context) => {
  if (error.code !== 'IMPORT_ERROR') {
    return;
  }

  const detailsResult = importSourceErrorDetailsSchema.safeParse(error.details);

  if (!detailsResult.success) {
    context.addIssue({
      code: 'custom',
      path: ['details'],
      message: 'IMPORT_ERROR details must include a stable source import error reason.',
    });
  }
});

export const importSourceResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: importSourceResultSchema,
  }).strict(),
  z.object({
    ok: z.literal(false),
    error: importSourceDomainErrorSchema,
  }).strict(),
]);

const importSourceInitialRequestSchema = z.object({
  title: z.string().min(1).optional(),
}).strict();

const importSourceEncodingRetryRequestSchema = z.object({
  pendingImportId: z.string().min(1),
  encodingOverride: z.enum(['utf-8', 'gb18030']),
}).strict();

export const importSourceRequestSchema = z.union([
  importSourceInitialRequestSchema,
  importSourceEncodingRetryRequestSchema,
]);

export const bookRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
}).strict();

export const structureDetectionRequestSchema = bookRequestSchema;

export const updateStructureNodeRequestSchema = z.object({
  nodeId: structureNodeIdSchema,
  patch: z.object({
    title: z.string().min(1).optional(),
    parentId: structureNodeIdSchema.nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().nullable().optional(),
  }).strict().superRefine((patch, context) => {
    if (
      patch.startOffset !== undefined &&
      patch.endOffset !== undefined &&
      patch.endOffset !== null &&
      patch.endOffset <= patch.startOffset
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be null or greater than startOffset when both offsets are patched.',
      });
    }
  }),
}).strict();

export const updateStorySegmentRangeRequestSchema = z.object({
  rangeId: storySegmentRangeIdSchema,
  patch: z.object({
    title: z.string().min(1).optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    coveredChapterIds: z.array(structureNodeIdSchema).min(1).optional(),
    functionTags: z.array(z.string().min(1)).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).strict().superRefine((patch, context) => {
    if (
      patch.startOffset !== undefined &&
      patch.endOffset !== undefined &&
      patch.endOffset <= patch.startOffset
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be greater than startOffset when both offsets are patched.',
      });
    }
  }),
}).strict();

export const freezeStructureResponseDataSchema = z.object({
  bookId: breakdownBookIdSchema,
  structureEdition: z.number().int().positive(),
}).strict();

export const updateModuleBodyRequestSchema = z.object({
  instanceId: analysisModuleInstanceIdSchema,
  body: z.string(),
}).strict();

export const optionalBookRequestSchema = z.object({
  bookId: breakdownBookIdSchema.optional(),
}).strict();

export const jobRequestSchema = z.object({
  jobId: jobIdSchema,
}).strict();
