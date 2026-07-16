import type { BreakdownBookId, JobId } from '../../shared/domain';
import { JOB_TYPES, type JobState, type JobType } from '../../shared/domain/job';
import type { SqliteDatabase } from '../db/sqlite';

export type JobRepositoryErrorReason =
  | 'invalid_persisted_job_type'
  | 'invalid_persisted_json';

export class JobRepositoryError extends Error {
  constructor(
    readonly reason: JobRepositoryErrorReason,
    readonly recordId: string,
    readonly field: 'kind' | 'payload_json' | 'error_details_json',
  ) {
    super(`${reason}: ${recordId}.${field}`);
    this.name = 'JobRepositoryError';
  }
}

export type JobRecord = {
  readonly id: JobId;
  readonly bookId: BreakdownBookId | null;
  readonly kind: JobType;
  readonly state: JobState;
  readonly completedUnits: number;
  readonly totalUnits: number | null;
  readonly payloadSchemaVersion: number;
  readonly payload: unknown;
  readonly errorCode: string | null;
  readonly errorDetails: unknown | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type JobCheckpointRecord = {
  readonly id: string;
  readonly jobId: JobId;
  readonly sequence: number;
  readonly kind: string;
  readonly payloadSchemaVersion: number;
  readonly payload: unknown;
  readonly createdAt: string;
};

export type PersistedJobDetail = {
  readonly job: JobRecord;
  readonly checkpoints: readonly JobCheckpointRecord[];
};

export class JobRepository {
  insert(database: SqliteDatabase, job: JobRecord): JobRecord {
    database.prepare(`
      INSERT INTO jobs (
        id, book_id, kind, state, completed_units, total_units,
        payload_schema_version, payload_json, error_code, error_details_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.bookId,
      job.kind,
      job.state,
      job.completedUnits,
      job.totalUnits,
      job.payloadSchemaVersion,
      JSON.stringify(job.payload),
      job.errorCode,
      job.errorDetails === null ? null : JSON.stringify(job.errorDetails),
      job.createdAt,
      job.updatedAt,
    );
    return job;
  }

  get(database: SqliteDatabase, jobId: JobId): JobRecord | null {
    const row = database.prepare(`${JOB_SELECT} WHERE id = ?`).get(jobId) as JobRow | undefined;
    return row ? mapJob(row) : null;
  }

  getWithCheckpoints(database: SqliteDatabase, jobId: JobId): PersistedJobDetail | null {
    const job = this.get(database, jobId);
    return job ? { job, checkpoints: this.listCheckpoints(database, jobId) } : null;
  }

  updateState(database: SqliteDatabase, job: JobRecord): JobRecord {
    database.prepare(`
      UPDATE jobs SET
        book_id = ?, state = ?, completed_units = ?, total_units = ?, error_code = ?,
        error_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      job.bookId,
      job.state,
      job.completedUnits,
      job.totalUnits,
      job.errorCode,
      job.errorDetails === null ? null : JSON.stringify(job.errorDetails),
      job.updatedAt,
      job.id,
    );
    return job;
  }

  appendCheckpoint(
    database: SqliteDatabase,
    checkpoint: Omit<JobCheckpointRecord, 'sequence'>,
  ): JobCheckpointRecord {
    const previous = database.prepare(
      'SELECT MAX(sequence) FROM job_checkpoints WHERE job_id = ?',
    ).pluck().get(checkpoint.jobId);
    const sequence = (typeof previous === 'number' ? previous : 0) + 1;
    database.prepare(`
      INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkpoint.id,
      checkpoint.jobId,
      sequence,
      checkpoint.kind,
      checkpoint.payloadSchemaVersion,
      JSON.stringify(checkpoint.payload),
      checkpoint.createdAt,
    );
    return { ...checkpoint, sequence };
  }

  listCheckpoints(database: SqliteDatabase, jobId: JobId): JobCheckpointRecord[] {
    return (database.prepare(`
      ${JOB_CHECKPOINT_SELECT}
      WHERE job_id = ?
      ORDER BY sequence ASC, id ASC
    `).all(jobId) as JobCheckpointRow[]).map(mapCheckpoint);
  }

  list(database: SqliteDatabase, bookId?: BreakdownBookId): JobRecord[] {
    const rows = bookId === undefined
      ? database.prepare(`${JOB_SELECT} ORDER BY updated_at DESC, id DESC`).all()
      : database.prepare(`${JOB_SELECT} WHERE book_id = ? ORDER BY updated_at DESC, id DESC`)
        .all(bookId);
    return (rows as JobRow[]).map(mapJob);
  }
}

const JOB_SELECT = `
  SELECT
    id,
    book_id AS bookId,
    kind,
    state,
    completed_units AS completedUnits,
    total_units AS totalUnits,
    payload_schema_version AS payloadSchemaVersion,
    payload_json AS payloadJson,
    error_code AS errorCode,
    error_details_json AS errorDetailsJson,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM jobs
`;

const JOB_CHECKPOINT_SELECT = `
  SELECT
    id,
    job_id AS jobId,
    sequence,
    kind,
    payload_schema_version AS payloadSchemaVersion,
    payload_json AS payloadJson,
    created_at AS createdAt
  FROM job_checkpoints
`;

type JobRow = Omit<JobRecord, 'kind' | 'payload' | 'errorDetails'> & {
  readonly kind: string;
  readonly payloadJson: string;
  readonly errorDetailsJson: string | null;
};

type JobCheckpointRow = Omit<JobCheckpointRecord, 'payload'> & {
  readonly payloadJson: string;
};

function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id as JobId,
    bookId: row.bookId as BreakdownBookId | null,
    kind: parseJobType(row.kind, row.id),
    state: row.state,
    completedUnits: row.completedUnits,
    totalUnits: row.totalUnits,
    payloadSchemaVersion: row.payloadSchemaVersion,
    payload: parsePersistedJson(row.payloadJson, row.id, 'payload_json'),
    errorCode: row.errorCode,
    errorDetails: row.errorDetailsJson === null
      ? null
      : parsePersistedJson(row.errorDetailsJson, row.id, 'error_details_json'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCheckpoint(row: JobCheckpointRow): JobCheckpointRecord {
  return {
    id: row.id,
    jobId: row.jobId as JobId,
    sequence: row.sequence,
    kind: row.kind,
    payloadSchemaVersion: row.payloadSchemaVersion,
    payload: parsePersistedJson(row.payloadJson, row.id, 'payload_json'),
    createdAt: row.createdAt,
  };
}

function parseJobType(kind: string, recordId: string): JobType {
  if (!JOB_TYPES.includes(kind as JobType)) {
    throw new JobRepositoryError('invalid_persisted_job_type', recordId, 'kind');
  }
  return kind as JobType;
}

function parsePersistedJson(
  json: string,
  recordId: string,
  field: 'payload_json' | 'error_details_json',
): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new JobRepositoryError('invalid_persisted_json', recordId, field);
  }
}
