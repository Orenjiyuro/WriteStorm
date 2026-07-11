import { z } from 'zod';
import {
  breakdownBookIdSchema,
  domainErrorSchema,
  isoDateTimeStringSchema,
  sourceTextIdSchema,
} from './common';
import { bookSummarySchema } from './books';
import { jobSummarySchema } from './jobs';

export const sourceTextMetadataSchema = z.object({
  id: sourceTextIdSchema,
  bookId: breakdownBookIdSchema,
  fileName: z.string().min(1),
  format: z.enum(['txt', 'md']),
  sizeBytes: z.number().int().positive(),
  encoding: z.string().min(1),
  contentHash: z.string().min(1),
  sourceTextEdition: z.number().int().positive(),
  importedAt: isoDateTimeStringSchema,
}).strict();

export type SourceTextMetadata = z.infer<typeof sourceTextMetadataSchema>;
export type SourceTextFormat = SourceTextMetadata['format'];

export const importSourceResultSchema = z.object({
  book: bookSummarySchema,
  sourceText: sourceTextMetadataSchema,
  job: jobSummarySchema,
}).strict();

export type ImportSourceResult = z.infer<typeof importSourceResultSchema>;

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

const importSourceDomainErrorSchema = domainErrorSchema.superRefine((error, context) => {
  if (error.code !== 'IMPORT_ERROR') {
    return;
  }

  if (!importSourceErrorDetailsSchema.safeParse(error.details).success) {
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
