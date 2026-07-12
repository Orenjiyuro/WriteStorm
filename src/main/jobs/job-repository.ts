import type { BreakdownBookId, JobId } from '../../shared/domain';
import type { JobState } from '../../shared/domain/job';
import type { SqliteDatabase } from '../db/sqlite';

export type JobRecord = {
  readonly id: JobId;
  readonly bookId: BreakdownBookId | null;
  readonly kind: string;
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

  updateState(database: SqliteDatabase, job: JobRecord): JobRecord {
    database.prepare(`
      UPDATE jobs SET
        state = ?, completed_units = ?, total_units = ?, error_code = ?,
        error_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
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

  list(database: SqliteDatabase): JobRecord[] {
    return (database.prepare(`${JOB_SELECT} ORDER BY created_at ASC, id ASC`).all() as JobRow[])
      .map(mapJob);
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

type JobRow = Omit<JobRecord, 'payload' | 'errorDetails'> & {
  readonly payloadJson: string;
  readonly errorDetailsJson: string | null;
};

function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id as JobId,
    bookId: row.bookId as BreakdownBookId | null,
    kind: row.kind,
    state: row.state,
    completedUnits: row.completedUnits,
    totalUnits: row.totalUnits,
    payloadSchemaVersion: row.payloadSchemaVersion,
    payload: JSON.parse(row.payloadJson),
    errorCode: row.errorCode,
    errorDetails: row.errorDetailsJson === null ? null : JSON.parse(row.errorDetailsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
