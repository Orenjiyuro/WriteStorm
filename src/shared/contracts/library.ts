import { z } from 'zod';
import { libraryIdSchema } from './common';

export const librarySummarySchema = z.object({
  id: libraryIdSchema,
  name: z.string().min(1),
  rootPath: z.string().min(1),
  schemaVersion: z.number().int().nonnegative(),
  appVersion: z.string().min(1),
}).strict();

export type LibrarySummary = z.infer<typeof librarySummarySchema>;

export const librarySessionSummarySchema = z.object({
  sessionId: z.string().uuid(),
  library: librarySummarySchema,
}).strict();

export type LibrarySessionSummary = z.infer<typeof librarySessionSummarySchema>;
