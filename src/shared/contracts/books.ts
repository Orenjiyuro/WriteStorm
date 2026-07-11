import { z } from 'zod';
import {
  breakdownBookIdSchema,
  isoDateTimeStringSchema,
  libraryIdSchema,
  sourceTextIdSchema,
} from './common';

export const bookSummarySchema = z.object({
  id: breakdownBookIdSchema,
  libraryId: libraryIdSchema,
  title: z.string().min(1),
  sourceTextId: sourceTextIdSchema.nullable(),
  sourceTextEdition: z.number().int().positive().nullable(),
  structureEdition: z.number().int().positive().nullable(),
  updatedAt: isoDateTimeStringSchema,
}).strict();

export type BookSummary = z.infer<typeof bookSummarySchema>;

export const bookRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
}).strict();

export const optionalBookRequestSchema = z.object({
  bookId: breakdownBookIdSchema.optional(),
}).strict();
