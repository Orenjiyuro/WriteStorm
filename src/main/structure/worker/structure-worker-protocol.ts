import { z } from 'zod';
import {
  structureConfidenceSchema,
  structureNodeIdSchema,
  structureSetNodeSchema,
  structureSetStoryRangeSchema,
} from '../../../shared/contracts/schemas';
import type { StructureDetectionResult } from '../detection/structure-detector';
import type { StoryRangeDetectionResult } from '../detection/story-range-detector';

export const STRUCTURE_WORKER_PROTOCOL_VERSION = 2 as const;

export type StructureWorkerDetectionInput = {
  readonly bookTitle: string;
  readonly sourceText: string;
};

export type StructureWorkerDetectionResult = {
  readonly structure: StructureDetectionResult;
  readonly storyRanges: StoryRangeDetectionResult | null;
};

export type StructureWorkerDetectionTelemetry = {
  readonly durationMs: number;
  readonly rssBeforeBytes: number;
  readonly rssAfterBytes: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly maxRssBytes: number;
};

type UtilityWorkerRequestBase = {
  readonly version: typeof STRUCTURE_WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
};

export type UtilityWorkerRequest = UtilityWorkerRequestBase & (
  | { readonly command: 'echo'; readonly payload: string }
  | { readonly command: 'hang' | 'crash' }
  | { readonly command: 'detect'; readonly input: StructureWorkerDetectionInput }
);

type UtilityWorkerResponseBase = {
  readonly version: typeof STRUCTURE_WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: true;
  readonly workerPid: number;
};

export type UtilityWorkerResponse = UtilityWorkerResponseBase & (
  | { readonly command: 'echo'; readonly payload: string }
  | {
    readonly command: 'detect';
    readonly result: StructureWorkerDetectionResult;
    readonly telemetry: StructureWorkerDetectionTelemetry;
  }
);

const requestBase = {
  version: z.literal(STRUCTURE_WORKER_PROTOCOL_VERSION),
  requestId: z.string().min(1),
} as const;

const utilityWorkerRequestSchema = z.discriminatedUnion('command', [
  z.object({
    ...requestBase,
    command: z.literal('echo'),
    payload: z.string(),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('hang'),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('crash'),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('detect'),
    input: z.object({
      bookTitle: z.string().min(1),
      sourceText: z.string(),
    }).strict(),
  }).strict(),
]) as z.ZodType<UtilityWorkerRequest>;

const structureDetectionResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.enum(['candidate_ready', 'needs_manual_review']),
    nodes: z.array(structureSetNodeSchema),
    aggregateConfidence: structureConfidenceSchema,
  }).strict(),
  z.object({
    status: z.literal('structure_detection_failed'),
    failureCode: z.literal('no_reliable_chapter'),
    recoveryActions: z.tuple([
      z.literal('adjust_rules'),
      z.literal('mark_chapters_manually'),
      z.literal('create_book_root_shell'),
    ]),
    root: structureSetNodeSchema,
  }).strict(),
]) as z.ZodType<StructureDetectionResult>;

const storyRangeDetectionResultSchema = z.object({
  status: z.enum(['story_ranges_ready', 'needs_manual_review', 'no_reliable_story_ranges']),
  reason: z.enum([
    'fewer_than_two_chapters',
    'no_boundary_signal',
    'no_cross_chapter_signal_group',
  ]).optional(),
  ranges: z.array(structureSetStoryRangeSchema),
  uncoveredChapterIds: z.array(structureNodeIdSchema),
}).strict() as z.ZodType<StoryRangeDetectionResult>;

const responseBase = {
  version: z.literal(STRUCTURE_WORKER_PROTOCOL_VERSION),
  requestId: z.string().min(1),
  ok: z.literal(true),
  workerPid: z.number().int().positive(),
} as const;

const utilityWorkerResponseSchema = z.discriminatedUnion('command', [
  z.object({
    ...responseBase,
    command: z.literal('echo'),
    payload: z.string(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('detect'),
    result: z.object({
      structure: structureDetectionResultSchema,
      storyRanges: storyRangeDetectionResultSchema.nullable(),
    }).strict(),
    telemetry: z.object({
      durationMs: z.number().nonnegative().finite(),
      rssBeforeBytes: z.number().int().nonnegative(),
      rssAfterBytes: z.number().int().nonnegative(),
      heapUsedBeforeBytes: z.number().int().nonnegative(),
      heapUsedAfterBytes: z.number().int().nonnegative(),
      maxRssBytes: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
]) as z.ZodType<UtilityWorkerResponse>;

export function isUtilityWorkerRequest(value: unknown): value is UtilityWorkerRequest {
  return utilityWorkerRequestSchema.safeParse(value).success;
}

export function isUtilityWorkerResponse(value: unknown): value is UtilityWorkerResponse {
  return utilityWorkerResponseSchema.safeParse(value).success;
}
