import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { JobService } from '../../../src/main/jobs/job-service';
import type { JobId, SourceTextId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const createdAt = '2026-07-12T02:00:00.000Z';
const runningAt = '2026-07-12T02:01:00.000Z';
const completedAt = '2026-07-12T02:02:00.000Z';
const jobId = 'job-service-test' as JobId;
const sourceTextId = 'source-service-test' as SourceTextId;

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('JobService', () => {
  it('owns queued -> running -> completed transitions', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.create(sourceImportJob());
      expect(service.transition(jobId, 'running', runningAt)).toMatchObject({
        id: jobId,
        state: 'running',
      });
      expect(service.transition(jobId, 'completed', completedAt, {
        completedUnits: 1,
        totalUnits: 1,
      })).toMatchObject({
        id: jobId,
        state: 'completed',
        completedUnits: 1,
        totalUnits: 1,
      });
    } finally {
      database.close();
    }
  });

  it('rejects completed -> running without changing the row', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.create({ ...sourceImportJob(), state: 'completed', completedUnits: 1, totalUnits: 1 });
      expect(() => service.transition(jobId, 'running', runningAt)).toThrowError(
        expect.objectContaining({ reason: 'invalid_transition' }),
      );
      expect(service.get(jobId)?.state).toBe('completed');
    } finally {
      database.close();
    }
  });

  it('assigns monotonically increasing checkpoint sequence numbers', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.create(sourceImportJob());
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
      expect(() => service.create({
        ...sourceImportJob(),
        payload: { unexpected: true },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(() => service.create({
        ...sourceImportJob(),
        payloadSchemaVersion: 2,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_payload' }));
      expect(service.list()).toEqual([]);
    } finally {
      database.close();
    }
  });
});

function sourceImportJob() {
  return {
    id: jobId,
    bookId: null,
    kind: 'source_import',
    state: 'queued' as const,
    completedUnits: 0,
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { sourceTextId },
    errorCode: null,
    errorDetails: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function migratedDatabase(): SqliteDatabase {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-job-service-'));
  tempDirs.push(directory);
  const database = openSqliteDatabase(path.join(directory, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}
