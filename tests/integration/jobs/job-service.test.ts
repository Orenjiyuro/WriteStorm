import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
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
      expect(service.getWithCheckpoints(jobId)).toMatchObject({
        job: { id: jobId, state: 'completed' },
        checkpoints: [{ id: `${jobId}:completed`, sequence: 1 }],
      });
      expect(() => service.appendCheckpoint({
        ...completedCheckpoint(),
        id: `${jobId}:after-completion`,
        jobId,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_state' }));
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

  it('rejects final and cross-type checkpoints through generic append', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      expect(() => service.appendCheckpoint({
        id: `${jobId}:first`,
        jobId,
        kind: 'source_import_completed',
        payloadSchemaVersion: 1,
        payload: { sourceTextId },
        createdAt,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_kind' }));
      expect(() => service.appendCheckpoint({
        id: `${jobId}:cross-type`,
        jobId,
        kind: 'structure_detection_completed',
        payloadSchemaVersion: 1,
        payload: {
          title: 'Detect structure',
          sourceTextId,
          sourceTextEdition: 1,
          contentHash: 'sha256:source',
        },
        createdAt: completedAt,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_kind' }));
      expect(service.getWithCheckpoints(jobId)?.checkpoints).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('preserves Book ownership during completion', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      insertBook(database);
      database.prepare(`INSERT INTO books (id, title, created_at, updated_at)
        VALUES ('book-other', 'Other Book', ?, ?)`).run(createdAt, createdAt);
      service.createQueued({
        id: jobId,
        bookId,
        kind: 'structure_detection',
        totalUnits: 1,
        payloadSchemaVersion: 1,
        payload: {
          title: 'Detect structure',
          sourceTextId,
          sourceTextEdition: 1,
          contentHash: 'sha256:source',
        },
        createdAt,
        updatedAt: createdAt,
      });
      service.transition(jobId, 'running', runningAt);
      expect(() => service.completeWithCheckpoint(jobId, {
        bookId: 'book-other' as BreakdownBookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: {
          id: `${jobId}:completed`,
          kind: 'structure_detection_completed',
          payloadSchemaVersion: 1,
          payload: service.get(jobId)!.payload,
          createdAt: completedAt,
        },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_book_ownership' }));
      expect(service.get(jobId)).toMatchObject({ bookId, state: 'running' });
    } finally {
      database.close();
    }
  });

  it('only permits source_import to bind Book ownership from null', () => {
    const importDatabase = migratedDatabase();
    const structureDatabase = migratedDatabase();
    try {
      insertBook(importDatabase);
      const imports = new JobService({ database: importDatabase });
      imports.createQueued({ ...sourceImportJob(), bookId });
      imports.transition(jobId, 'running', runningAt);
      expect(() => imports.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: completedCheckpoint(),
      })).toThrowError(expect.objectContaining({ reason: 'invalid_book_ownership' }));

      insertBook(structureDatabase);
      const structures = new JobService({ database: structureDatabase });
      const payload = {
        title: 'Detect structure' as const,
        sourceTextId,
        sourceTextEdition: 1,
        contentHash: 'sha256:source',
      };
      structures.createQueued({
        id: jobId,
        bookId: null,
        kind: 'structure_detection',
        totalUnits: 1,
        payloadSchemaVersion: 1,
        payload,
        createdAt,
        updatedAt: createdAt,
      });
      structures.transition(jobId, 'running', runningAt);
      expect(() => structures.completeWithCheckpoint(jobId, {
        bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: completedAt,
        checkpoint: {
          id: `${jobId}:completed`,
          kind: 'structure_detection_completed',
          payloadSchemaVersion: 1,
          payload,
          createdAt: completedAt,
        },
      })).toThrowError(expect.objectContaining({ reason: 'invalid_book_ownership' }));
    } finally {
      importDatabase.close();
      structureDatabase.close();
    }
  });

  it('rejects queued checkpoints when the Job type has no preparation-checkpoint policy', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      expect(() => service.appendCheckpoint({
        ...completedCheckpoint(),
        jobId,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_state' }));
      expect(service.getWithCheckpoints(jobId)?.checkpoints).toEqual([]);
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

  it('rejects contract-only Job types even when a payload schema is injected', () => {
    const database = migratedDatabase();
    const service = new JobService({
      database,
      payloadSchemas: { 'export@1': z.object({}).strict() },
    });
    try {
      expect(() => service.createQueued({
        id: jobId,
        bookId: null,
        kind: 'export',
        totalUnits: 0,
        payloadSchemaVersion: 1,
        payload: {},
        createdAt,
        updatedAt: createdAt,
      })).toThrowError(expect.objectContaining({ reason: 'job_not_creatable' }));
      expect(service.list()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('enforces monotonic progress and one-way total discovery', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      expect(() => service.createQueued({
        ...sourceImportJob(),
        totalUnits: -1,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(() => service.createQueued({
        ...sourceImportJob(),
        totalUnits: 0.5,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));

      service.createQueued({ ...sourceImportJob(), totalUnits: null });
      service.transition(jobId, 'running', runningAt);
      expect(service.transition(jobId, 'paused', completedAt, {
        completedUnits: 1,
        totalUnits: 3,
      })).toMatchObject({ completedUnits: 1, totalUnits: 3 });
      expect(() => service.transition(jobId, 'running', completedAt, {
        completedUnits: 0,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(() => service.transition(jobId, 'running', completedAt, {
        completedUnits: 4,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(() => service.transition(jobId, 'running', completedAt, {
        completedUnits: 1.5,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(() => service.transition(jobId, 'running', completedAt, {
        totalUnits: 4,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(() => service.transition(jobId, 'running', completedAt, {
        totalUnits: null,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_progress' }));
      expect(service.get(jobId)).toMatchObject({
        state: 'paused',
        completedUnits: 1,
        totalUnits: 3,
      });
    } finally {
      database.close();
    }
  });

  it('cancels dormant Jobs but requires runtime-owner confirmation for running work', () => {
    const dormantDatabase = migratedDatabase();
    try {
      const dormant = new JobService({ database: dormantDatabase });
      dormant.createQueued(sourceImportJob());
      expect(dormant.cancel(jobId, completedAt, { runtimeOwner: 'none' })).toMatchObject({
        state: 'cancelled',
      });
    } finally {
      dormantDatabase.close();
    }

    const runningDatabase = migratedDatabase();
    try {
      const running = new JobService({ database: runningDatabase });
      running.createQueued(sourceImportJob());
      running.transition(jobId, 'running', runningAt);
      expect(() => running.cancel(jobId, completedAt, { runtimeOwner: 'none' }))
        .toThrowError(expect.objectContaining({ reason: 'runtime_owner_not_stopped' }));
      expect(running.get(jobId)?.state).toBe('running');
      expect(running.cancel(jobId, completedAt, { runtimeOwner: 'confirmed_stopped' }))
        .toMatchObject({ state: 'cancelled' });
    } finally {
      runningDatabase.close();
    }
  });

  it('rejects cancellation for transaction-owned Job types', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued({
        id: jobId,
        bookId: null,
        kind: 'structure_edition',
        totalUnits: 1,
        payloadSchemaVersion: 1,
        payload: {
          title: 'Freeze structure edition',
          structureSetId: 'structure-set-1',
          structureEdition: 1,
        },
        createdAt,
        updatedAt: createdAt,
      });
      expect(() => service.cancel(jobId, completedAt, {
        runtimeOwner: 'confirmed_stopped',
      })).toThrowError(expect.objectContaining({ reason: 'job_not_cancellable' }));
      expect(service.get(jobId)?.state).toBe('queued');
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
      database.prepare(`INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES ('duplicate-checkpoint-id', ?, 1, 'source_import_completed', 1, ?, ?)`)
        .run(jobId, JSON.stringify({ sourceTextId }), createdAt);

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

  it('fails closed for persisted checkpoint history that violates Job type or state', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      database.prepare(`INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES (?, ?, 1, 'structure_detection_completed', 1, ?, ?)`).run(
        `${jobId}:cross-type`,
        jobId,
        JSON.stringify({
          title: 'Detect structure',
          sourceTextId,
          sourceTextEdition: 1,
          contentHash: 'sha256:source',
        }),
        createdAt,
      );
      expect(() => service.getWithCheckpoints(jobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_checkpoint_kind' }),
      );

      database.prepare('DELETE FROM job_checkpoints WHERE job_id = ?').run(jobId);
      database.prepare(`INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES (?, ?, 1, 'source_import_completed', 1, ?, ?)`).run(
        `${jobId}:premature-final`,
        jobId,
        JSON.stringify({ sourceTextId }),
        createdAt,
      );
      expect(() => service.getWithCheckpoints(jobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_checkpoint_history' }),
      );

      database.prepare('DELETE FROM job_checkpoints WHERE job_id = ?').run(jobId);
      insertBook(database);
      database.prepare(`UPDATE jobs SET
        book_id = ?, state = 'completed', completed_units = 1, total_units = 1
        WHERE id = ?`).run(bookId, jobId);
      expect(() => service.getWithCheckpoints(jobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_checkpoint_history' }),
      );

      database.prepare(`INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES (?, ?, 1, 'source_import_completed', 1, ?, ?)`).run(
        `${jobId}:final-1`,
        jobId,
        JSON.stringify({ sourceTextId }),
        createdAt,
      );
      expect(service.getWithCheckpoints(jobId)?.checkpoints).toHaveLength(1);
      database.prepare(`INSERT INTO job_checkpoints (
        id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
      ) VALUES (?, ?, 2, 'source_import_completed', 1, ?, ?)`).run(
        `${jobId}:final-2`,
        jobId,
        JSON.stringify({ sourceTextId }),
        completedAt,
      );
      expect(() => service.getWithCheckpoints(jobId)).toThrowError(
        expect.objectContaining({ reason: 'invalid_checkpoint_history' }),
      );
    } finally {
      database.close();
    }
  });

  it('rejects blank failure codes and checkpoint appends across failed -> resumable', () => {
    const database = migratedDatabase();
    const service = new JobService({ database });
    try {
      service.createQueued(sourceImportJob());
      service.transition(jobId, 'running', runningAt);
      expect(() => service.fail(jobId, completedAt, {
        errorCode: '   ',
      })).toThrowError(expect.objectContaining({ reason: 'invalid_failure' }));
      service.fail(jobId, completedAt, { errorCode: 'SOURCE_IMPORT_FAILED' });
      expect(() => service.appendCheckpoint({
        ...completedCheckpoint(),
        id: `${jobId}:while-failed`,
        jobId,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_state' }));
      service.transition(jobId, 'resumable', completedAt);
      expect(() => service.appendCheckpoint({
        ...completedCheckpoint(),
        id: `${jobId}:after-resumable`,
        jobId,
      })).toThrowError(expect.objectContaining({ reason: 'invalid_checkpoint_kind' }));
      expect(service.getWithCheckpoints(jobId)?.checkpoints).toEqual([]);
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
