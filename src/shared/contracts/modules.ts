import { z } from 'zod';
import { MODULE_INSTANCE_STATUSES } from '../domain/status';
import {
  analysisModuleIdSchema,
  analysisModuleInstanceIdSchema,
  breakdownBookIdSchema,
  isoDateTimeStringSchema,
  storySegmentRangeIdSchema,
  structureNodeIdSchema,
} from './common';

export const scopeRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('book'), bookId: breakdownBookIdSchema }).strict(),
  z.object({ kind: z.literal('volume'), nodeId: structureNodeIdSchema }).strict(),
  z.object({ kind: z.literal('chapter'), nodeId: structureNodeIdSchema }).strict(),
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
}).strict();

export type ModuleInstanceSummary = z.infer<typeof moduleInstanceSummarySchema>;

export const updateModuleBodyRequestSchema = z.object({
  instanceId: analysisModuleInstanceIdSchema,
  body: z.string(),
}).strict();
