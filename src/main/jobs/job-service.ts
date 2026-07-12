import { z } from 'zod';
import { canTransitionJob, type JobId, type JobState } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import {
  JobRepository,
  type JobCheckpointRecord,
  type JobRecord,
} from './job-repository';

export type JobServiceErrorReason =
  | 'invalid_payload'
  | 'invalid_transition'
  | 'job_not_found';

export class JobServiceError extends Error {
  readonly reason: JobServiceErrorReason;

  constructor(reason: JobServiceErrorReason, details?: string) {
    super(details ? `${reason}: ${details}` : reason);
    this.name = 'JobServiceError';
    this.reason = reason;
  }
}

export type JobPayloadSchemaRegistry = Readonly<Record<string, z.ZodType>>;

const sourceTextIdPayloadSchema = z.object({
  sourceTextId: z.string().min(1),
}).strict();

export const JOB_PAYLOAD_SCHEMAS: JobPayloadSchemaRegistry = {
  'source_import@1': sourceTextIdPayloadSchema,
  'source_import_completed@1': sourceTextIdPayloadSchema,
};

export class JobService {
  private readonly database: SqliteDatabase;
  private readonly repository: JobRepository;
  private readonly payloadSchemas: JobPayloadSchemaRegistry;

  constructor(options: {
    readonly database: SqliteDatabase;
    readonly repository?: JobRepository;
    readonly payloadSchemas?: JobPayloadSchemaRegistry;
  }) {
    this.database = options.database;
    this.repository = options.repository ?? new JobRepository();
    this.payloadSchemas = options.payloadSchemas ?? JOB_PAYLOAD_SCHEMAS;
  }

  create(job: JobRecord): JobRecord {
    this.validatePayload(job.kind, job.payloadSchemaVersion, job.payload);
    return this.repository.insert(this.database, job);
  }

  get(jobId: JobId): JobRecord | null {
    const job = this.repository.get(this.database, jobId);
    if (job) this.validatePayload(job.kind, job.payloadSchemaVersion, job.payload);
    return job;
  }

  transition(
    jobId: JobId,
    nextState: JobState,
    updatedAt: string,
    progress: {
      readonly completedUnits?: number;
      readonly totalUnits?: number | null;
      readonly errorCode?: string | null;
      readonly errorDetails?: unknown | null;
    } = {},
  ): JobRecord {
    const current = this.require(jobId);
    if (!canTransitionJob(current.state, nextState)) {
      throw new JobServiceError('invalid_transition', `${current.state} -> ${nextState}`);
    }
    return this.repository.updateState(this.database, {
      ...current,
      state: nextState,
      completedUnits: progress.completedUnits ?? current.completedUnits,
      totalUnits: progress.totalUnits === undefined ? current.totalUnits : progress.totalUnits,
      errorCode: progress.errorCode === undefined ? current.errorCode : progress.errorCode,
      errorDetails: progress.errorDetails === undefined ? current.errorDetails : progress.errorDetails,
      updatedAt,
    });
  }

  appendCheckpoint(
    checkpoint: Omit<JobCheckpointRecord, 'sequence'>,
  ): JobCheckpointRecord {
    this.require(checkpoint.jobId);
    this.validatePayload(
      checkpoint.kind,
      checkpoint.payloadSchemaVersion,
      checkpoint.payload,
    );
    return this.database.transaction(() =>
      this.repository.appendCheckpoint(this.database, checkpoint))();
  }

  list(): JobRecord[] {
    const jobs = this.repository.list(this.database);
    for (const job of jobs) {
      this.validatePayload(job.kind, job.payloadSchemaVersion, job.payload);
    }
    return jobs;
  }

  private require(jobId: JobId): JobRecord {
    const job = this.get(jobId);
    if (!job) throw new JobServiceError('job_not_found', jobId);
    return job;
  }

  private validatePayload(kind: string, version: number, payload: unknown): void {
    const schema = this.payloadSchemas[`${kind}@${version}`];
    if (!schema || !schema.safeParse(payload).success) {
      throw new JobServiceError('invalid_payload', `${kind}@${version}`);
    }
  }
}
