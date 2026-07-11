import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { StructureDetectionRunRepository } from '../../../src/main/structure/persistence/structure-detection-run-repository';
import type {
  BreakdownBookId,
  JobId,
  SourceTextId,
  StructureDetectionRunId,
} from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];
const queuedAt = '2026-07-11T00:00:00.000Z';
const runningAt = '2026-07-11T00:01:00.000Z';
const finishedAt = '2026-07-11T00:02:00.000Z';

afterEach(() => {
  databases.splice(0).forEach((database) => database.close());
});

describe('StructureDetectionRunRepository', () => {
  it('creates and reads one queued Job and detection run atomically', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);

    const created = repository.createQueued(createInput());

    expect(created).toEqual({
      detectionRun: {
        id: 'run-1',
        bookId: 'book-1',
        job: {
          jobId: 'job-1',
          checkpointKind: 'structure_draft',
        },
        sourceSnapshot: {
          sourceTextId: 'source-1',
          sourceTextEdition: 1,
          contentHash: 'sha256:source',
          decodedTextLength: 120,
          offsetUnit: 'utf16_code_unit',
        },
        state: 'queued',
        failureReason: null,
        createdAt: queuedAt,
        updatedAt: queuedAt,
      },
      job: {
        id: 'job-1',
        bookId: 'book-1',
        state: 'queued',
        title: 'Detect structure',
        completedUnits: 0,
        totalUnits: 1,
        checkpointSummary: null,
        failureReason: null,
        updatedAt: queuedAt,
      },
    });
    expect(repository.getById('run-1' as StructureDetectionRunId)).toEqual(created);
    expect(database.prepare(`
      SELECT type, state, progress, payload_json, error_json
      FROM jobs WHERE id = 'job-1'
    `).get()).toEqual({
      type: 'structure_detection',
      state: 'queued',
      progress: 0,
      payload_json: JSON.stringify({
        title: 'Detect structure',
        completedUnits: 0,
        totalUnits: 1,
        checkpointKind: 'structure_draft',
        checkpointSummary: null,
      }),
      error_json: null,
    });
  });

  it('finds only queued or running detection checkpoints for a book', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    const queued = repository.createQueued(createInput());

    expect(repository.findActiveByBook('book-1' as BreakdownBookId)).toEqual(queued);

    const running = repository.markRunning('run-1' as StructureDetectionRunId, runningAt);
    expect(repository.findActiveByBook('book-1' as BreakdownBookId)).toEqual(running);

    repository.markFailed('run-1' as StructureDetectionRunId, 'test_failure', finishedAt);
    expect(repository.findActiveByBook('book-1' as BreakdownBookId)).toBeNull();
  });

  it('transitions queued to running to completed in paired transactions', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());

    expect(repository.markRunning('run-1' as StructureDetectionRunId, runningAt)).toMatchObject({
      detectionRun: { state: 'running', updatedAt: runningAt },
      job: { state: 'running', completedUnits: 0, updatedAt: runningAt },
    });
    expect(repository.markCompleted('run-1' as StructureDetectionRunId, finishedAt)).toMatchObject({
      detectionRun: { state: 'completed', failureReason: null, updatedAt: finishedAt },
      job: {
        state: 'completed',
        completedUnits: 1,
        totalUnits: 1,
        checkpointSummary: 'Structure draft generated.',
        failureReason: null,
        updatedAt: finishedAt,
      },
    });
    expect(database.prepare("SELECT progress FROM jobs WHERE id = 'job-1'").pluck().get()).toBe(1);
  });

  it('records worker failure on both the Job and detection run', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());
    repository.markRunning('run-1' as StructureDetectionRunId, runningAt);

    const failed = repository.markFailed(
      'run-1' as StructureDetectionRunId,
      'UTILITY_WORKER_TIMEOUT',
      finishedAt,
    );

    expect(failed).toMatchObject({
      detectionRun: { state: 'failed', failureReason: 'UTILITY_WORKER_TIMEOUT' },
      job: { state: 'failed', failureReason: 'UTILITY_WORKER_TIMEOUT' },
    });
    expect(database.prepare("SELECT error_json FROM jobs WHERE id = 'job-1'").pluck().get()).toBe(
      JSON.stringify({ failureReason: 'UTILITY_WORKER_TIMEOUT' }),
    );
    expect(database.prepare("SELECT id FROM books WHERE id = 'book-1'").pluck().get()).toBe('book-1');
    expect(database.prepare("SELECT id FROM source_texts WHERE id = 'source-1'").pluck().get()).toBe('source-1');
  });

  it('maps user cancellation to a cancelled Job and failed run without deleting history', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());

    const cancelled = repository.markCancelled('run-1' as StructureDetectionRunId, finishedAt);

    expect(cancelled).toMatchObject({
      detectionRun: { state: 'failed', failureReason: 'cancelled_by_user' },
      job: { state: 'cancelled', failureReason: null },
    });
    expect(repository.getById('run-1' as StructureDetectionRunId)).toEqual(cancelled);
  });

  it('rejects invalid terminal transitions without partially updating either row', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());

    expect(() => repository.markCompleted(
      'run-1' as StructureDetectionRunId,
      finishedAt,
    )).toThrow('queued -> completed');

    expect(repository.getById('run-1' as StructureDetectionRunId)).toMatchObject({
      detectionRun: { state: 'queued', updatedAt: queuedAt },
      job: { state: 'queued', updatedAt: queuedAt },
    });
  });

  it('rolls back the run insert when the paired Job id already exists', () => {
    const database = structureDatabase();
    database.prepare(`
      INSERT INTO jobs (
        id, book_id, type, state, progress, payload_json, error_json, created_at, updated_at
      ) VALUES ('job-1', 'book-1', 'other', 'queued', 0, '{}', NULL, ?, ?)
    `).run(queuedAt, queuedAt);
    const repository = new StructureDetectionRunRepository(database);

    expect(() => repository.createQueued(createInput())).toThrow();

    expect(database.prepare('SELECT id FROM structure_detection_runs').all()).toEqual([]);
    expect(database.prepare('SELECT type FROM jobs WHERE id = ?').pluck().get('job-1')).toBe('other');
  });

  it('rejects a source snapshot that does not match the imported source metadata', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);

    expect(() => repository.createQueued({
      ...createInput(),
      sourceSnapshot: {
        ...createInput().sourceSnapshot,
        contentHash: 'sha256:not-imported',
      },
    })).toThrow('source snapshot');

    expect(database.prepare('SELECT id FROM jobs').all()).toEqual([]);
    expect(database.prepare('SELECT id FROM structure_detection_runs').all()).toEqual([]);
  });

  it('rejects a historical source snapshot after the book points at a reimport', () => {
    const database = structureDatabase();
    database.prepare(`
      INSERT INTO source_texts (
        id, book_id, format, content_hash, encoding, source_edition, relative_path,
        imported_at, original_file_name, size_bytes
      ) VALUES (
        'source-2', 'book-1', 'md', 'sha256:reimport', 'utf-8', 2,
        'source/source-2/example.md', ?, 'example.md', 140
      )
    `).run(runningAt);
    database.prepare("UPDATE books SET source_text_id = 'source-2' WHERE id = 'book-1'").run();
    const repository = new StructureDetectionRunRepository(database);

    expect(() => repository.createQueued(createInput())).toThrow('current imported source');

    expect(database.prepare('SELECT id FROM jobs').all()).toEqual([]);
    expect(database.prepare('SELECT id FROM structure_detection_runs').all()).toEqual([]);
  });

  it('rejects a split-brain Job state and preserves both stored rows', () => {
    const database = structureDatabase();
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());
    database.prepare("UPDATE jobs SET state = 'running' WHERE id = 'job-1'").run();

    expect(() => repository.markRunning(
      'run-1' as StructureDetectionRunId,
      runningAt,
    )).toThrow('inconsistent');

    expect(database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get())
      .toBe('queued');
    expect(database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get()).toBe('running');
  });
});

function structureDatabase(): SqliteDatabase {
  const database = openSqliteDatabase(':memory:');
  databases.push(database);
  runMigrations(database, APP_MIGRATIONS);
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example', '0.1.0', ?, ?)
  `).run(queuedAt, queuedAt);
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)
  `).run(queuedAt, queuedAt);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES (
      'source-1', 'book-1', 'md', 'sha256:source', 'utf-8', 1,
      'source/source-1/example.md', ?, 'example.md', 120
    )
  `).run(queuedAt);
  database.prepare("UPDATE books SET source_text_id = 'source-1' WHERE id = 'book-1'").run();
  return database;
}

function createInput() {
  return {
    runId: 'run-1' as StructureDetectionRunId,
    jobId: 'job-1' as JobId,
    bookId: 'book-1' as BreakdownBookId,
    sourceSnapshot: {
      sourceTextId: 'source-1' as SourceTextId,
      sourceTextEdition: 1,
      contentHash: 'sha256:source',
      decodedTextLength: 120,
      offsetUnit: 'utf16_code_unit' as const,
    },
    createdAt: queuedAt,
  };
}
