import { z } from 'zod';
import {
  analysisModuleIdSchema,
  analysisModuleInstanceIdSchema,
  breakdownBookIdSchema,
  domainErrorSchema,
  exportIdSchema,
  isoDateTimeStringSchema,
  jobIdSchema,
  sourceTextIdSchema,
  storySegmentRangeIdSchema,
  structureNodeIdSchema,
} from './common';
export {
  analysisModuleIdSchema,
  analysisModuleInstanceIdSchema,
  breakdownBookIdSchema,
  contractResponseSchema,
  domainErrorDetailsSchema,
  domainErrorSchema,
  emptyRequestSchema,
  exportIdSchema,
  isoDateTimeStringSchema,
  jobIdSchema,
  jsonValueSchema,
  libraryIdSchema,
  sourceTextIdSchema,
  storySegmentRangeIdSchema,
  structureNodeIdSchema,
} from './common';
import { bookRequestSchema } from './books';
export {
  bookRequestSchema,
  bookSummarySchema,
  optionalBookRequestSchema,
} from './books';
export { librarySummarySchema } from './library';
export {
  IMPORT_SOURCE_ERROR_REASONS,
  importSourceErrorDetailsSchema,
  importSourceErrorReasonSchema,
  importSourceRequestSchema,
  importSourceResponseSchema,
  importSourceResultSchema,
  sourceTextMetadataSchema,
} from './source-import';
import { jobSummarySchema } from './jobs';
export { jobSummarySchema } from './jobs';
import {
  MODULE_INSTANCE_STATUSES,
  STRUCTURE_NODE_KINDS,
  type ExportStatusDto,
  type ModuleInstanceSummary,
  type StorySegmentRangeDto,
  type StructureNodeDto,
} from '../domain';


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

export const exportStatusSchema = z.object({
  exportId: exportIdSchema.nullable(),
  bookId: breakdownBookIdSchema,
  availability: z.enum(['blocked', 'available', 'running', 'completed']),
  blockers: z.array(z.string().min(1)),
  latestJobId: jobIdSchema.nullable(),
  updatedAt: isoDateTimeStringSchema.nullable(),
}).strict() as z.ZodType<ExportStatusDto>;

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

export const jobRequestSchema = z.object({
  jobId: jobIdSchema,
}).strict();
