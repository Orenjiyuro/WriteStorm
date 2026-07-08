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
  STRUCTURE_NODE_KINDS,
  type AnalysisModuleId,
  type AnalysisModuleInstanceId,
  type BookSummary,
  type BreakdownBookId,
  type ExportId,
  type ExportStatusDto,
  type JobId,
  type JobSummary,
  type LibraryId,
  type LibrarySummary,
  type ModuleInstanceSummary,
  type SourceTextId,
  type SourceTextMetadata,
  type StorySegmentRangeDto,
  type StorySegmentRangeId,
  type StructureNodeDto,
  type StructureNodeId,
} from '../domain';

const isoDateTimeStringSchema = z.iso.datetime({ offset: true });
const idSchema = <T extends string>() => z.string().min(1) as unknown as z.ZodType<T>;

export const libraryIdSchema = idSchema<LibraryId>();
export const breakdownBookIdSchema = idSchema<BreakdownBookId>();
export const sourceTextIdSchema = idSchema<SourceTextId>();
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

export const importSourceRequestSchema = z.object({
  title: z.string().min(1).optional(),
}).strict();

export const bookRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
}).strict();

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
