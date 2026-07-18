import { z } from 'zod';
import {
  breakdownBookIdSchema,
  isoDateTimeStringSchema,
  libraryIdSchema,
  sourceTextIdSchema,
} from './common';
import {
  analysisConfigurationSnapshotSchema,
  bookTypeBindingReadSchema,
} from '../domain/type-library';

export const bookSummarySchema = z.object({
  id: breakdownBookIdSchema,
  libraryId: libraryIdSchema,
  title: z.string().min(1),
  sourceTextId: sourceTextIdSchema.nullable(),
  sourceTextEdition: z.number().int().positive().nullable(),
  structureEdition: z.number().int().positive().nullable(),
  mainTypeDisplayName: z.string().min(1).nullable(),
  contentFocusDisplayNames: z.array(z.string().min(1)).max(3),
  updatedAt: isoDateTimeStringSchema,
}).strict();

export type BookSummary = z.infer<typeof bookSummarySchema>;

export const bookMetadataDetailSchema = z.object({
  book: bookSummarySchema,
  currentTypeBinding: bookTypeBindingReadSchema,
  latestAnalysisConfigurationSnapshot: analysisConfigurationSnapshotSchema.nullable(),
}).strict().superRefine((detail, context) => {
  if (detail.currentTypeBinding.bookId !== detail.book.id) {
    context.addIssue({
      code: 'custom',
      path: ['currentTypeBinding', 'bookId'],
      message: 'Book metadata binding identity mismatch.',
    });
  }
  if (detail.latestAnalysisConfigurationSnapshot !== null &&
    detail.latestAnalysisConfigurationSnapshot.bookId !== detail.book.id) {
    context.addIssue({
      code: 'custom',
      path: ['latestAnalysisConfigurationSnapshot', 'bookId'],
      message: 'Book metadata snapshot identity mismatch.',
    });
  }
});

export type BookMetadataDetail = z.infer<typeof bookMetadataDetailSchema>;

export const bookRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
}).strict();

export const optionalBookRequestSchema = z.object({
  bookId: breakdownBookIdSchema.optional(),
}).strict();
