import { z } from 'zod';
import {
  DOMAIN_ERROR_CODES,
  type JsonValue,
} from '../errors';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  ExportId,
  JobId,
  LibraryId,
  SourceTextId,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../domain/ids';

const idSchema = <T extends string>() =>
  z.string().min(1).transform((value) => value as T);

export const isoDateTimeStringSchema = z.iso.datetime({ offset: true });
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
export const domainErrorDetailsSchema = z.record(z.string(), jsonValueSchema);
export const domainErrorSchema = z.object({
  code: z.enum(DOMAIN_ERROR_CODES),
  message: z.string().min(1),
  recoverable: z.boolean(),
  details: domainErrorDetailsSchema.optional(),
}).strict();

export const emptyRequestSchema = z.object({}).strict();

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
