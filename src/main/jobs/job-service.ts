import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { canTransitionJob, type JobId, type JobState } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import {
  JobRepository,
  type JobCheckpointRecord,
  type JobRecord,
} from './job-repository';

export type JobServiceErrorReason =
  | 'invalid_payload'
  | 'invalid_progress'
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

export type CreateQueuedJobInput = Omit<
  JobRecord,
  'state' | 'completedUnits' | 'errorCode' | 'errorDetails'
>;

export type CompleteJobInput = {
  readonly bookId: NonNullable<JobRecord['bookId']>;
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly updatedAt: string;
  readonly checkpoint: Omit<JobCheckpointRecord, 'jobId' | 'sequence'>;
};

const sourceTextIdPayloadSchema = z.object({
  sourceTextId: z.string().min(1),
}).strict();

const structureDetectionPayloadSchema = z.object({
  title: z.literal('Detect structure'),
  sourceTextId: z.string().min(1),
  sourceTextEdition: z.number().int().positive(),
  contentHash: z.string().min(1),
}).strict();

export const JOB_PAYLOAD_SCHEMAS: JobPayloadSchemaRegistry = {
  'source_import@1': sourceTextIdPayloadSchema,
  'source_import_completed@1': sourceTextIdPayloadSchema,
  'structure_detection@1': structureDetectionPayloadSchema,
  'structure_detection_completed@1': structureDetectionPayloadSchema,
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

  createQueued(input: CreateQueuedJobInput): JobRecord {
    const job: JobRecord = {
      ...input,
      state: 'queued',
      completedUnits: 0,
      errorCode: null,
      errorDetails: null,
    };
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
    if (nextState === 'completed') {
      throw new JobServiceError(
        'invalid_transition',
        'completed jobs require completeWithCheckpoint',
      );
    }
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

  fail(
    jobId: JobId,
    updatedAt: string,
    failure: {
      readonly errorCode: string;
      readonly errorDetails?: unknown | null;
    },
  ): JobRecord {
    return this.transition(jobId, 'failed', updatedAt, {
      errorCode: failure.errorCode,
      errorDetails: failure.errorDetails ?? null,
    });
  }

  completeWithCheckpoint(
    jobId: JobId,
    input: CompleteJobInput,
  ): { readonly job: JobRecord; readonly checkpoint: JobCheckpointRecord } {
    this.validatePayload(
      input.checkpoint.kind,
      input.checkpoint.payloadSchemaVersion,
      input.checkpoint.payload,
    );
    if (input.totalUnits < 0 || input.completedUnits !== input.totalUnits) {
      throw new JobServiceError(
        'invalid_progress',
        `${input.completedUnits}/${input.totalUnits}`,
      );
    }

    return this.database.transaction(() => {
      const current = this.require(jobId);
      if (!canTransitionJob(current.state, 'completed')) {
        throw new JobServiceError('invalid_transition', `${current.state} -> completed`);
      }
      if (
        input.checkpoint.kind !== `${current.kind}_completed` ||
        !isDeepStrictEqual(input.checkpoint.payload, current.payload)
      ) {
        throw new JobServiceError('invalid_payload', 'final checkpoint does not match queued Job');
      }
      const job = this.repository.updateState(this.database, {
        ...current,
        bookId: input.bookId,
        state: 'completed',
        completedUnits: input.completedUnits,
        totalUnits: input.totalUnits,
        errorCode: null,
        errorDetails: null,
        updatedAt: input.updatedAt,
      });
      const checkpoint = this.repository.appendCheckpoint(this.database, {
        ...input.checkpoint,
        jobId,
      });
      return { job, checkpoint };
    })();
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
