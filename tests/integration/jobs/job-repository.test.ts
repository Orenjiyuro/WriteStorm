import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  JobRepository,
  JobRepositoryError,
  type JobRecord,
} from '../../../src/main/jobs/job-repository';
import type { BreakdownBookId, JobId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const bookA = 'book-a' as BreakdownBookId;
const bookB = 'book-b' as BreakdownBookId;

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('JobRepository persistence reads', () => {
  it('lists every Library Job by newest update while Book filtering remains optional', () => {
    const database = migratedDatabase();
    const repository = new JobRepository();
    try {
      insertBook(database, bookA);
      insertBook(database, bookB);
      repository.insert(database, job('job-a-old', bookA, '2026-07-16T01:00:00.000Z'));
      repository.insert(database, job('job-a-new', bookA, '2026-07-16T02:00:00.000Z'));
      repository.insert(database, job('job-b-new', bookB, '2026-07-16T02:00:00.000Z'));
      repository.insert(database, job('job-null', null, '2026-07-16T03:00:00.000Z'));

      expect(repository.list(database).map(({ id }) => id)).toEqual([
        'job-null',
        'job-b-new',
        'job-a-new',
        'job-a-old',
      ]);
      expect(repository.list(database, bookA).map(({ id }) => id)).toEqual([
        'job-a-new',
        'job-a-old',
      ]);
    } finally {
      database.close();
    }
  });

  it('reads ordered checkpoint detail after closing and reopening SQLite', () => {
    const directory = tempDirectory();
    const databasePath = path.join(directory, 'writestorm.sqlite');
    let database = migratedDatabase(databasePath);
    const repository = new JobRepository();
    repository.insert(database, job('job-detail', null, '2026-07-16T01:00:00.000Z'));
    repository.appendCheckpoint(database, checkpoint('checkpoint-1', 'job-detail', {
      sourceTextId: 'source-1',
    }));
    repository.appendCheckpoint(database, checkpoint('checkpoint-2', 'job-detail', {
      sourceTextId: 'source-2',
    }));
    database.close();

    database = openSqliteDatabase(databasePath);
    try {
      expect(repository.getWithCheckpoints(database, 'job-detail' as JobId)).toMatchObject({
        job: { id: 'job-detail', kind: 'source_import' },
        checkpoints: [
          { id: 'checkpoint-1', sequence: 1, payload: { sourceTextId: 'source-1' } },
          { id: 'checkpoint-2', sequence: 2, payload: { sourceTextId: 'source-2' } },
        ],
      });
      expect(repository.getWithCheckpoints(database, 'missing' as JobId)).toBeNull();
    } finally {
      database.close();
    }
  });

  it('fails closed for unknown persisted Job types and malformed persisted JSON', () => {
    const database = migratedDatabase();
    const repository = new JobRepository();
    try {
      database.prepare(`
        INSERT INTO jobs (
          id, book_id, kind, state, completed_units, total_units,
          payload_schema_version, payload_json, error_code, error_details_json,
          created_at, updated_at
        ) VALUES ('unknown-type', NULL, 'future_unknown', 'queued', 0, 1,
          1, '{}', NULL, NULL, '2026-07-16T01:00:00.000Z', '2026-07-16T01:00:00.000Z')
      `).run();
      expect(() => repository.list(database)).toThrowError(expect.objectContaining({
        reason: 'invalid_persisted_job_type',
      } satisfies Partial<JobRepositoryError>));

      database.prepare('DELETE FROM jobs').run();
      repository.insert(database, job('malformed-job', null, '2026-07-16T01:00:00.000Z'));
      database.prepare("UPDATE jobs SET payload_json = '{' WHERE id = 'malformed-job'").run();
      expect(() => repository.get(database, 'malformed-job' as JobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_persisted_json' } satisfies Partial<JobRepositoryError>),
      );

      database.prepare("UPDATE jobs SET payload_json = '{}' WHERE id = 'malformed-job'").run();
      database.prepare(
        "UPDATE jobs SET error_details_json = '{' WHERE id = 'malformed-job'",
      ).run();
      expect(() => repository.get(database, 'malformed-job' as JobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_persisted_json' } satisfies Partial<JobRepositoryError>),
      );

      database.prepare(
        "UPDATE jobs SET error_details_json = NULL WHERE id = 'malformed-job'",
      ).run();
      repository.appendCheckpoint(database, checkpoint('malformed-checkpoint', 'malformed-job', {
        sourceTextId: 'source-1',
      }));
      database.prepare(
        "UPDATE job_checkpoints SET payload_json = '{' WHERE id = 'malformed-checkpoint'",
      ).run();
      expect(() => repository.getWithCheckpoints(database, 'malformed-job' as JobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_persisted_json' } satisfies Partial<JobRepositoryError>),
      );
    } finally {
      database.close();
    }
  });
});

function job(id: string, bookId: BreakdownBookId | null, updatedAt: string): JobRecord {
  return {
    id: id as JobId,
    bookId,
    kind: 'source_import',
    state: 'queued',
    completedUnits: 0,
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { sourceTextId: `source-for-${id}` },
    errorCode: null,
    errorDetails: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt,
  };
}

function checkpoint(id: string, jobId: string, payload: unknown) {
  return {
    id,
    jobId: jobId as JobId,
    kind: 'source_import_completed',
    payloadSchemaVersion: 1,
    payload,
    createdAt: '2026-07-16T04:00:00.000Z',
  };
}

function insertBook(database: SqliteDatabase, bookId: BreakdownBookId): void {
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES (?, ?, '2026-07-16T00:00:00.000Z', '2026-07-16T00:00:00.000Z')
  `).run(bookId, bookId);
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-job-repository-'));
  tempDirs.push(directory);
  return directory;
}

function migratedDatabase(databasePath?: string): SqliteDatabase {
  const resolvedPath = databasePath ?? path.join(tempDirectory(), 'writestorm.sqlite');
  const database = openSqliteDatabase(resolvedPath);
  runMigrations(database, APP_MIGRATIONS);
  return database;
}
