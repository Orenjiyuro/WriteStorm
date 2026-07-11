import { z } from 'zod';
import { JOB_STATES } from '../domain/job';
import { breakdownBookIdSchema, jobIdSchema } from './common';

export const jobStateSchema = z.enum(JOB_STATES);

export const jobRequestSchema = z.object({ jobId: jobIdSchema }).strict();

export const jobSummarySchema = z.object({
  id: jobIdSchema,
  bookId: breakdownBookIdSchema.nullable(),
  state: jobStateSchema,
  title: z.string().min(1),
  completedUnits: z.number().int().nonnegative(),
  totalUnits: z.number().int().nonnegative().nullable(),
  checkpointSummary: z.string().nullable(),
  failureReason: z.string().nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict();

export type JobSummary = z.infer<typeof jobSummarySchema>;

export const versionedJobPayloadEnvelopeSchema = z.object({
  payloadSchemaVersion: z.number().int().positive(),
  payload: z.json(),
}).strict();

export type VersionedJobPayloadEnvelope = z.infer<
  typeof versionedJobPayloadEnvelopeSchema
>;

export const jobCheckpointSchema = versionedJobPayloadEnvelopeSchema.extend({
  id: z.string().min(1),
  jobId: jobIdSchema,
  sequence: z.number().int().positive(),
  kind: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
}).strict();

export type JobCheckpointDto = z.infer<typeof jobCheckpointSchema>;
