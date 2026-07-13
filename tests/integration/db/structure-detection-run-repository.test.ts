import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { JobService } from '../../../src/main/jobs/job-service';
import { StructureDetectionRunRepository } from '../../../src/main/structure/persistence/structure-detection-run-repository';
import type { BreakdownBookId, JobId, SourceTextId, StructureDetectionRunId } from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];
const queuedAt = '2026-07-11T00:00:00.000Z';
const runningAt = '2026-07-11T00:01:00.000Z';
const finishedAt = '2026-07-11T00:02:00.000Z';

afterEach(() => databases.splice(0).forEach((database) => database.close()));

describe('StructureDetectionRunRepository', () => {
  it('persists a run paired with a Job created by JobService', () => {
    const database = structureDatabase();
    createJob(database);
    const repository = new StructureDetectionRunRepository(database);
    const created = repository.createQueued(createInput());

    expect(created).toMatchObject({
      detectionRun: { id: 'run-1', state: 'queued', job: { jobId: 'job-1' } },
      job: { id: 'job-1', state: 'queued', completedUnits: 0, totalUnits: 1 },
    });
  });

  it('updates only the run while Job transitions remain owned by JobService', () => {
    const database = structureDatabase();
    createJob(database);
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());

    repository.markRunning('run-1' as StructureDetectionRunId, runningAt);
    expect(database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get()).toBe('queued');
    expect(database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get()).toBe('running');
  });

  it('finds active runs and rejects an invalid direct completion', () => {
    const database = structureDatabase();
    createJob(database);
    const repository = new StructureDetectionRunRepository(database);
    repository.createQueued(createInput());
    expect(repository.findActiveByBook('book-1' as BreakdownBookId)).not.toBeNull();
    expect(() => repository.markCompleted('run-1' as StructureDetectionRunId, finishedAt))
      .toThrow('queued -> completed');
  });

  it('rejects a source snapshot that does not match current imported source metadata', () => {
    const database = structureDatabase();
    createJob(database);
    const repository = new StructureDetectionRunRepository(database);
    expect(() => repository.createQueued({
      ...createInput(),
      sourceSnapshot: { ...createInput().sourceSnapshot, contentHash: 'sha256:not-imported' },
    })).toThrow('source snapshot');
    expect(database.prepare('SELECT id FROM structure_detection_runs').all()).toEqual([]);
  });

  it('rejects a historical source after the Book current source changes', () => {
    const database = structureDatabase();
    database.prepare(`
      INSERT INTO source_texts (
        id, book_id, format, content_hash, encoding, source_edition, relative_path,
        imported_at, original_file_name, size_bytes
      ) VALUES ('source-2', 'book-1', 'md', 'sha256:reimport', 'utf-8', 2,
        'source/source-2/example.md', ?, 'example.md', 140)
    `).run(runningAt);
    database.prepare("UPDATE books SET current_source_text_id = 'source-2' WHERE id = 'book-1'").run();
    createJob(database);
    expect(() => new StructureDetectionRunRepository(database).createQueued(createInput()))
      .toThrow('current imported source');
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
  database.prepare("INSERT INTO books (id, title, created_at, updated_at) VALUES ('book-1', 'Example', ?, ?)")
    .run(queuedAt, queuedAt);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES ('source-1', 'book-1', 'md', 'sha256:source', 'utf-8', 1,
      'source/source-1/example.md', ?, 'example.md', 120)
  `).run(queuedAt);
  database.prepare("UPDATE books SET current_source_text_id = 'source-1' WHERE id = 'book-1'").run();
  return database;
}

function createJob(database: SqliteDatabase): void {
  new JobService({ database }).createQueued({
    id: 'job-1' as JobId,
    bookId: 'book-1' as BreakdownBookId,
    kind: 'structure_detection',
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { title: 'Detect structure', sourceTextId: 'source-1', sourceTextEdition: 1, contentHash: 'sha256:source' },
    createdAt: queuedAt,
    updatedAt: queuedAt,
  });
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
