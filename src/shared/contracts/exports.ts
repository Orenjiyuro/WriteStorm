import { z } from 'zod';
import {
  breakdownBookIdSchema,
  exportIdSchema,
  isoDateTimeStringSchema,
  jobIdSchema,
} from './common';

export const exportStatusSchema = z.object({
  exportId: exportIdSchema.nullable(),
  bookId: breakdownBookIdSchema,
  availability: z.enum(['blocked', 'available', 'running', 'completed']),
  blockers: z.array(z.string().min(1)),
  latestJobId: jobIdSchema.nullable(),
  updatedAt: isoDateTimeStringSchema.nullable(),
}).strict();

export type ExportStatusDto = z.infer<typeof exportStatusSchema>;
