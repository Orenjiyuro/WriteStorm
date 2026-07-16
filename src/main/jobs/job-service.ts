import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import {
  JOB_CAPABILITIES,
  JOB_CANCELLATION_POLICY,
  JOB_CHECKPOINT_APPEND_STATES,
  JOB_PROGRESS_POLICY,
  canTransitionJob,
  type BreakdownBookId,
  type JobId,
  type JobState,
} from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import {
  JobRepository,
  type JobCheckpointRecord,
  type JobRecord,
  type PersistedJobDetail,
} from './job-repository';

export type JobServiceErrorReason =
  | 'invalid_payload'
  | 'invalid_progress'
  | 'invalid_transition'
  | 'invalid_checkpoint_state'
  | 'invalid_failure'
  | 'job_not_cancellable'
  | 'runtime_owner_not_stopped'
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

export type CancelJobInput = {
  readonly runtimeOwner: 'none' | 'confirmed_stopped';
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

const structureEditionPayloadSchema = z.object({
  title: z.literal('Freeze structure edition'),
  structureSetId: z.string().min(1),
  structureEdition: z.number().int().positive(),
}).strict();

const analysisModuleShellCreationPayloadSchema = z.object({
  title: z.literal('Create analysis module shells'),
  structureSetId: z.string().min(1),
  structureEdition: z.number().int().positive(),
  instanceIds: z.array(z.string().min(1)).length(7).refine(
    (instanceIds) => new Set(instanceIds).size === instanceIds.length,
    'instanceIds must be unique',
  ),
}).strict();

export const JOB_PAYLOAD_SCHEMAS: JobPayloadSchemaRegistry = {
  'source_import@1': sourceTextIdPayloadSchema,
  'source_import_completed@1': sourceTextIdPayloadSchema,
  'structure_detection@1': structureDetectionPayloadSchema,
  'structure_detection_completed@1': structureDetectionPayloadSchema,
  'structure_edition@1': structureEditionPayloadSchema,
  'structure_edition_completed@1': structureEditionPayloadSchema,
  'analysis_module_shell_creation@1': analysisModuleShellCreationPayloadSchema,
  'analysis_module_shell_creation_completed@1': analysisModuleShellCreationPayloadSchema,
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
    this.validateProgress({ completedUnits: 0, totalUnits: null }, 0, input.totalUnits);
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

  getWithCheckpoints(jobId: JobId): PersistedJobDetail | null {
    const detail = this.repository.getWithCheckpoints(this.database, jobId);
    if (!detail) return null;
    this.validatePayload(
      detail.job.kind,
      detail.job.payloadSchemaVersion,
      detail.job.payload,
    );
    for (const checkpoint of detail.checkpoints) {
      this.validatePayload(
        checkpoint.kind,
        checkpoint.payloadSchemaVersion,
        checkpoint.payload,
      );
    }
    return detail;
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
    const completedUnits = progress.completedUnits ?? current.completedUnits;
    const totalUnits = progress.totalUnits === undefined ? current.totalUnits : progress.totalUnits;
    this.validateProgress(current, completedUnits, totalUnits);
    return this.repository.updateState(this.database, {
      ...current,
      state: nextState,
      completedUnits,
      totalUnits,
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
    if (failure.errorCode.trim().length === 0) {
      throw new JobServiceError('invalid_failure', 'errorCode must be non-blank');
    }
    return this.transition(jobId, 'failed', updatedAt, {
      errorCode: failure.errorCode,
      errorDetails: failure.errorDetails ?? null,
    });
  }

  cancel(jobId: JobId, updatedAt: string, input: CancelJobInput): JobRecord {
    const current = this.require(jobId);
    if (!canTransitionJob(current.state, 'cancelled')) {
      throw new JobServiceError('invalid_transition', `${current.state} -> cancelled`);
    }
    if (JOB_CAPABILITIES[current.kind].cancellation !== 'runtime_owner_first') {
      throw new JobServiceError('job_not_cancellable', current.kind);
    }
    if (
      input.runtimeOwner === 'none' &&
      !(JOB_CANCELLATION_POLICY.dormantStateCandidates as readonly JobState[])
        .includes(current.state)
    ) {
      throw new JobServiceError('runtime_owner_not_stopped', current.state);
    }
    return this.transition(jobId, 'cancelled', updatedAt);
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
      this.validateProgress(current, input.completedUnits, input.totalUnits);
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
    const current = this.require(checkpoint.jobId);
    const allowsCurrentState = (JOB_CHECKPOINT_APPEND_STATES as readonly JobState[])
      .includes(current.state) || (
        current.state === 'queued' &&
        JOB_CAPABILITIES[current.kind].allowsQueuedPreparationCheckpoint
      );
    if (!allowsCurrentState) {
      throw new JobServiceError('invalid_checkpoint_state', current.state);
    }
    this.validatePayload(
      checkpoint.kind,
      checkpoint.payloadSchemaVersion,
      checkpoint.payload,
    );
    return this.database.transaction(() =>
      this.repository.appendCheckpoint(this.database, checkpoint))();
  }

  list(bookId?: BreakdownBookId): JobRecord[] {
    const jobs = this.repository.list(this.database, bookId);
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

  private validateProgress(
    current: Pick<JobRecord, 'completedUnits' | 'totalUnits'>,
    completedUnits: number,
    totalUnits: number | null,
  ): void {
    const invalidCompleted = !Number.isInteger(completedUnits) ||
      completedUnits < JOB_PROGRESS_POLICY.minimumCompletedUnits;
    const invalidTotal = totalUnits !== null && (
      !Number.isInteger(totalUnits) ||
      totalUnits < JOB_PROGRESS_POLICY.minimumKnownTotalUnits
    );
    const completedRegressed = JOB_PROGRESS_POLICY.completedUnitsMonotonic &&
      completedUnits < current.completedUnits;
    const completedExceedsTotal = !JOB_PROGRESS_POLICY.completedUnitsMayExceedKnownTotal &&
      totalUnits !== null && completedUnits > totalUnits;
    const unknownTotalBecameKnown = current.totalUnits === null && totalUnits !== null;
    const knownTotalBecameUnknown = current.totalUnits !== null && totalUnits === null;
    const knownTotalChanged = current.totalUnits !== null && totalUnits !== null &&
      totalUnits !== current.totalUnits;
    if (
      invalidCompleted || invalidTotal || completedRegressed ||
      completedExceedsTotal ||
      (unknownTotalBecameKnown && !JOB_PROGRESS_POLICY.totalUnitsMayBecomeKnownOnce) ||
      (knownTotalBecameUnknown && !JOB_PROGRESS_POLICY.totalUnitsMayReturnToUnknown) ||
      (knownTotalChanged && !JOB_PROGRESS_POLICY.totalUnitsMayChangeOnceKnown)
    ) {
      throw new JobServiceError(
        'invalid_progress',
        `${current.completedUnits}/${String(current.totalUnits)} -> ${completedUnits}/${String(totalUnits)}`,
      );
    }
  }
}
