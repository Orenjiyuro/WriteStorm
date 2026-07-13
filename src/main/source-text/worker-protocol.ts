import path from 'node:path';
import { z } from 'zod';
import type { SourceTextEncoding } from './source-text-encoding';

export const SOURCE_TEXT_WORKER_PROTOCOL_VERSION = 1 as const;

export type PrepareSourceImportInput = {
  readonly jobId: string;
  readonly sourcePath: string;
  readonly libraryRootPath: string;
  readonly maxSizeBytes: number;
  readonly encoding: SourceTextEncoding;
};

export type PrepareSourceImportResult = {
  readonly stagingRelativePath: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly encoding: SourceTextEncoding;
};

export type SourceTextWorkerErrorCode =
  | 'SOURCE_FILE_TOO_LARGE'
  | 'SOURCE_FILE_EMPTY'
  | 'SOURCE_FILE_NOT_READABLE'
  | 'SOURCE_TEXT_ENCODING_REQUIRED'
  | 'SOURCE_STAGING_CONFLICT'
  | 'SOURCE_STAGING_WRITE_FAILED';

type RequestBase = {
  readonly version: typeof SOURCE_TEXT_WORKER_PROTOCOL_VERSION;
  readonly origin: 'main';
  readonly requestId: string;
};

export type SourceTextWorkerRequest = RequestBase & (
  | { readonly command: 'prepare-import'; readonly input: PrepareSourceImportInput }
  | { readonly command: 'cancel'; readonly targetRequestId: string }
);

export type SourceTextWorkerResponse =
  | {
      readonly version: typeof SOURCE_TEXT_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'prepare-import';
      readonly ok: true;
      readonly workerPid: number;
      readonly result: PrepareSourceImportResult;
    }
  | {
      readonly version: typeof SOURCE_TEXT_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'prepare-import';
      readonly ok: false;
      readonly workerPid: number;
      readonly error: {
        readonly code: SourceTextWorkerErrorCode;
        readonly message: string;
      };
    }
  | {
      readonly version: typeof SOURCE_TEXT_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'cancel';
      readonly ok: true;
      readonly workerPid: number;
      readonly cancelledRequestId: string;
    };

const requestBase = {
  version: z.literal(SOURCE_TEXT_WORKER_PROTOCOL_VERSION),
  origin: z.literal('main'),
  requestId: z.string().min(1),
} as const;

const absolutePathSchema = z.string().min(1).refine((value) => path.isAbsolute(value));
const prepareInputSchema = z.object({
  jobId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
  sourcePath: absolutePathSchema,
  libraryRootPath: absolutePathSchema,
  maxSizeBytes: z.number().int().positive(),
  encoding: z.enum(['utf-8', 'gb18030']),
}).strict();

const requestSchema = z.discriminatedUnion('command', [
  z.object({
    ...requestBase,
    command: z.literal('prepare-import'),
    input: prepareInputSchema,
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('cancel'),
    targetRequestId: z.string().min(1),
  }).strict(),
]) as z.ZodType<SourceTextWorkerRequest>;

const responseBase = {
  version: z.literal(SOURCE_TEXT_WORKER_PROTOCOL_VERSION),
  requestId: z.string().min(1),
  workerPid: z.number().int().positive(),
} as const;
const prepareResultSchema = z.object({
  stagingRelativePath: z.string().regex(/^source\/\.staging\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.tmp$/),
  sizeBytes: z.number().int().positive(),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  encoding: z.enum(['utf-8', 'gb18030']),
}).strict();
const workerErrorSchema = z.object({
  code: z.enum([
    'SOURCE_FILE_TOO_LARGE',
    'SOURCE_FILE_EMPTY',
    'SOURCE_FILE_NOT_READABLE',
    'SOURCE_TEXT_ENCODING_REQUIRED',
    'SOURCE_STAGING_CONFLICT',
    'SOURCE_STAGING_WRITE_FAILED',
  ]),
  message: z.string().min(1),
}).strict();

const responseSchema = z.union([
  z.object({
    ...responseBase,
    command: z.literal('prepare-import'),
    ok: z.literal(true),
    result: prepareResultSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('prepare-import'),
    ok: z.literal(false),
    error: workerErrorSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('cancel'),
    ok: z.literal(true),
    cancelledRequestId: z.string().min(1),
  }).strict(),
]) as z.ZodType<SourceTextWorkerResponse>;

export function isSourceTextWorkerRequest(value: unknown): value is SourceTextWorkerRequest {
  return requestSchema.safeParse(value).success;
}

export function isSourceTextWorkerResponse(value: unknown): value is SourceTextWorkerResponse {
  return responseSchema.safeParse(value).success;
}
