import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  JobService,
  type CreateQueuedJobInput,
} from '../../../src/main/jobs/job-service';
import type { BreakdownBookId, JobId, SourceTextId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const createdAt = '2026-07-12T02:00:00.000Z';
const runningAt = '2026-07-12T02:01:00.000Z';
const completedAt = '2026-07-12T02:02:00.000Z';
const jobId = 'job-service-test' as JobId;
const bookId = 'book-service-test' as BreakdownBookId;
const sourceTextId = 'source-service-test' as SourceTextId;

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('JobService', () => {
  it('owns queued -> running -> completed transitions', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      expect(service.transition(jobId, 'running', runningAt)).toMatchObject({
        id: jobId,
        state: 'running',
      });
      expect(() => service.transition(jobId, 'completed', completedAt, {
        completedUnits: 1,
        totalUnits: 1,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_transition' }));
      insertBook(database);
      const completed = service.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: {
          id: `${jobId}:completed`,
          kind: 'source_import_completed',
          payloadSchemaVersion: 1,
          payload: { sourceTextId },
          createdAt: completedAt,
        },
      });
      expect(completed.job).toMatchObject({
        id: jobId,
        bookId,
        state: 'completed',
        completedUnits: 1,
        totalUnits: 1,
      });
      expect(completed.checkpoint).toMatchObject({
        jobId,
        sequence: 1,
        kind: 'source_import_completed',
      });
    } finally {
      database.close();
    }
  });

  it('only creates queued jobs and rejects bypassing running before completion', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      expect(service.createQueued(sourceImportJob())).toMatchObject({
        state: 'queued',
        completedUnits: 0,
        errorCode: null,
      });
      insertBook(database);
      expect(() => service.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: completedCheckpoint(),
      })).toThrowError(expect.objectContaining({ reason: 'invalid_transition' }));
      expect(service.get(jobId)?.state).toBe('queued');
    } finally {
      database.close();
    }
  });

  it('assigns monotonically increasing checkpoint sequence numbers', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      const first = service.appendCheckpoint({
        id: `${jobId}:first`,
        jobId,
        kind: 'source_import_completed',
        payloadSchemaVersion: 1,
        payload: { sourceTextId },
        createdAt,
      });
      const second = service.appendCheckpoint({
        id: `${jobId}:second`,
        jobId,
        kind: 'source_import_completed',
        payloadSchemaVersion: 1,
        payload: { sourceTextId },
        createdAt: completedAt,
      });
      expect([first.sequence, second.sequence]).toEqual([1, 2]);
    } finally {
      database.close();
    }
  });

  it('rejects unregistered or malformed versioned payloads before persistence', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      expect(() => service.createQueued({
        ...sourceImportJob(),
        payload: { unexpected: true },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(() => service.createQueued({
        ...sourceImportJob(),
        payloadSchemaVersion: 2,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(service.list()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('rolls back completion, book binding, and progress when final checkpoint persistence fails', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      insertBook(database);
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      service.appendCheckpoint({
        ...completedCheckpoint(),
        id: 'duplicate-checkpoint-id',
        jobId,
      });

      expect(() => service.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: {
          ...completedCheckpoint(),
          id: 'duplicate-checkpoint-id',
        },
      })).toThrow();

      expect(service.get(jobId)).toMatchObject({
        bookId: null,
        state: 'running',
        completedUnits: 0,
      });
      expect(database.prepare('SELECT COUNT(*) FROM job_checkpoints WHERE job_id = ?')
        .pluck().get(jobId)).toBe(1);
    } finally {
      database.close();
    }
  });

  it('rejects a final checkpoint whose kind or payload does not match the queued Job', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      insertBook(database);
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      expect(() => service.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: { ...completedCheckpoint(), kind: 'source_import' },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(() => service.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: {
          ...completedCheckpoint(),
          payload: { sourceTextId: 'different-source' },
        },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(service.get(jobId)).toMatchObject({ state: 'running', bookId: null });
    } finally {
      database.close();
    }
  });

  it('fails an abandoned running job through transition policy', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      expect(service.fail(jobId, completedAt, {
        errorCode: 'SOURCE_IMPORT_ABANDONED',
        errorDetails: { reason: 'startup_recovery' },
      })).toMatchObject({
        state: 'failed',
        errorCode: 'SOURCE_IMPORT_ABANDONED',
        errorDetails: { reason: 'startup_recovery' },
      });
      expect(() => service.fail(jobId, completedAt, {
        errorCode: 'SOURCE_IMPORT_ABANDONED',
      })).toThrowError(expect.objectContaining({ reason: 'invalid_transition' }));
    } finally {
      database.close();
    }
  });
});

function sourceImportJob(): CreateQueuedJobInput {
  return {
    id: jobId,
    bookId: null,
    kind: 'source_import',
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { sourceTextId },
    createdAt,
    updatedAt: createdAt,
  };
}

function completedCheckpoint() {
  return {
    id: `${jobId}:completed`,
    kind: 'source_import_completed',
    payloadSchemaVersion: 1,
    payload: { sourceTextId },
    createdAt: completedAt,
  };
}

function insertBook(database: SqliteDatabase): void {
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(bookId, 'Job Service Book', createdAt, createdAt);
}

function migratedDatabase(): SqliteDatabase {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-job-service-'));
  tempDirs.push(directory);
  const database = openSqliteDatabase(path.join(directory, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}
