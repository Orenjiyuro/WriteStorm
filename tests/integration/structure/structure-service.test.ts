import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import type { LibraryContext } from '../../../src/main/library/library-service';
import { StructureCandidateRepository } from '../../../src/main/structure/persistence/structure-candidate-repository';
import { StructureDetectionRunRepository } from '../../../src/main/structure/persistence/structure-detection-run-repository';
import { StructureService } from '../../../src/main/structure/structure-service';
import { executeStructureWorkerDetection } from '../../../src/main/structure/worker/structure-worker-detection';
import type {
  StructureWorkerDetectionInput,
} from '../../../src/main/structure/worker/structure-worker-protocol';
import { UtilityWorkerRunnerError } from '../../../src/main/structure/worker/structure-worker-runner';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  StructureDetectionRunId,
  StructureSetId,
} from '../../../src/shared/domain';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
});

describe('StructureService', () => {
  it('exposes only the queued active-registry detection entrypoint', () => {
    const service = new StructureService({
      libraryService: { getCurrentContext: () => null },
      worker: cancellationAwareWorker(),
    });

    expect(service).toHaveProperty('startDetection');
    expect(service).not.toHaveProperty('detectStructure');
  });

  it('returns a queued checkpoint before the deferred worker completes in background', async () => {
    const fixture = structureLibraryFixture();
    const deferred = deferredWorkerResult();
    const service = structureService(fixture, {
      detect: () => deferred.promise,
    });

    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });

    expect(started).toMatchObject({
      detectionRun: { id: 'run-1', state: 'queued' },
      job: { id: 'job-1', state: 'queued' },
    });
    expect(service.activeCount).toBe(1);
    expect(currentCandidateCount(fixture.database)).toBe(0);

    deferred.resolve({
      result: executeStructureWorkerDetection({
        bookTitle: 'Example Book',
        sourceText: fixture.decodedText,
      }),
      workerPid: 4242,
    });
    await service.waitForIdle();

    expectDetectionState(fixture.database, 'completed', 'completed');
    expect(currentCandidateCount(fixture.database)).toBe(1);
    expect(service.activeCount).toBe(0);
  });

  it('rejects a second active detection for the same book', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, cancellationAwareWorker());
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'structure_detection_in_progress' });

    expect(service.cancelAll()).toBe(1);
    await service.waitForIdle();
  });

  it('requires recovery when SQLite has an active run without an in-memory operation', async () => {
    const fixture = structureLibraryFixture();
    new StructureDetectionRunRepository(fixture.database).createQueued({
      runId: 'orphan-run' as StructureDetectionRunId,
      jobId: 'orphan-job' as JobId,
      bookId: 'book-1' as BreakdownBookId,
      sourceSnapshot: {
        sourceTextId: 'source-1' as import('../../../src/shared/domain').SourceTextId,
        sourceTextEdition: 1,
        contentHash: fixture.contentHash,
        decodedTextLength: fixture.decodedText.length,
        offsetUnit: 'utf16_code_unit',
      },
      createdAt: '2026-07-11T00:00:30.000Z',
    });
    const service = structureService(fixture, cancellationAwareWorker());

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'structure_detection_recovery_required' });

    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_detection_runs").pluck().get()).toBe(1);
  });

  it('persists cancellation before aborting the active worker', async () => {
    const fixture = structureLibraryFixture();
    let stateObservedDuringAbort: { run: unknown; job: unknown } | null = null;
    const service = structureService(fixture, cancellationAwareWorker(() => {
      stateObservedDuringAbort = {
        run: fixture.database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get(),
        job: fixture.database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get(),
      };
    }));
    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await new Promise((resolve) => setImmediate(resolve));

    expect(service.cancelDetection(started.job.id)).toBe(true);
    expect(stateObservedDuringAbort).toEqual({ run: 'failed', job: 'cancelled' });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'cancelled');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('contains a background timeout after the queued IPC-style result has returned', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_TIMEOUT', 'Timed out.');
      },
    });
    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 5 });

    expect(started.job.state).toBe('queued');
    await service.waitForIdle();

    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
    expect(service.activeCount).toBe(0);
  });

  it('rejects detection before a library is open', async () => {
    const service = new StructureService({
      libraryService: { getCurrentContext: () => null },
      worker: {
        async detect(input) {
          return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
        },
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'no_current_library' });
  });

  it('reads the current imported snapshot, runs the worker, validates, and atomically completes a candidate', async () => {
    const fixture = structureLibraryFixture();
    const workerInputs: StructureWorkerDetectionInput[] = [];
    const worker = {
      async detect(input: StructureWorkerDetectionInput) {
        workerInputs.push(input);
        return {
          result: executeStructureWorkerDetection(input),
          workerPid: 4242,
        };
      },
    };
    const service = new StructureService({
      libraryService: { getCurrentContext: () => fixture.context },
      worker,
      createRunId: () => 'run-1' as StructureDetectionRunId,
      createJobId: () => 'job-1' as JobId,
      createCandidateSetId: () => 'candidate-1' as StructureSetId,
      now: sequenceClock(),
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database).getCurrentCandidate(
      'book-1' as BreakdownBookId,
    );

    expect(workerInputs).toEqual([{
      bookTitle: 'Example Book',
      sourceText: fixture.decodedText,
    }]);
    expect(candidate).toMatchObject({
        id: 'candidate-1',
        stage: 'candidate',
        detectionRunId: 'run-1',
        storyRangeMode: 'included',
        sourceSnapshot: {
          sourceTextId: 'source-1',
          sourceTextEdition: 1,
          contentHash: fixture.contentHash,
          decodedTextLength: fixture.decodedText.length,
          offsetUnit: 'utf16_code_unit',
        },
    });
    expect(new StructureDetectionRunRepository(fixture.database).getById(
      'run-1' as StructureDetectionRunId,
    )).toMatchObject({
      detectionRun: { state: 'completed' },
      job: {
        state: 'completed',
        completedUnits: 1,
        checkpointSummary: 'Structure draft generated.',
      },
    });
  });

  it('marks a timed-out worker as failed without persisting a candidate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_TIMEOUT', 'Timed out.');
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 5 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('maps AbortSignal cancellation to cancelled Job state without a candidate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_CANCELLED', 'Cancelled.');
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, {
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'cancelled');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('returns deterministic detection failure and persists the failed checkpoint', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        return {
          result: executeStructureWorkerDetection({
            bookTitle: 'Example Book',
            sourceText: 'Only prose remains.',
          }),
          workerPid: 4242,
        };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expect(new StructureDetectionRunRepository(fixture.database).getById(
      'run-1' as StructureDetectionRunId,
    )).toMatchObject({
      detectionRun: { state: 'failed', failureReason: 'structure_detection_failed' },
      job: { state: 'failed', failureReason: 'structure_detection_failed' },
    });
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('blocks a candidate with validator errors and records a stable failure', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect(input) {
        const result = executeStructureWorkerDetection(input);
        if (result.structure.status === 'structure_detection_failed') {
          throw new Error('Expected a candidate fixture.');
        }
        result.structure.nodes[0].endOffset = input.sourceText.length - 1;
        return { result, workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rejects a source changed while the worker was running', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect(input) {
        const result = executeStructureWorkerDetection(input);
        writeFileSync(fixture.sourcePath, Buffer.from('Changed after worker start.', 'utf8'));
        return { result, workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rolls candidate insertion back when completed checkpoint persistence fails', async () => {
    const fixture = structureLibraryFixture();
    fixture.database.exec(`
      CREATE TRIGGER reject_structure_job_completed
      BEFORE UPDATE OF state ON jobs
      FOR EACH ROW
      WHEN NEW.state = 'completed' AND OLD.type = 'structure_detection'
      BEGIN
        SELECT RAISE(ABORT, 'reject completed checkpoint');
      END;
    `);
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rejects a changed source hash before creating a detection Job', async () => {
    const fixture = structureLibraryFixture();
    writeFileSync(fixture.sourcePath, Buffer.from('Externally changed.', 'utf8'));
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'source_hash_mismatch' });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE type = 'structure_detection'").pluck().get())
      .toBe(0);
  });

  it('rejects an imported relative path that escapes the library root before creating a Job', async () => {
    const fixture = structureLibraryFixture();
    fixture.database.prepare("UPDATE source_texts SET relative_path = '../outside.md' WHERE id = 'source-1'").run();
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'source_read_failed' });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE type = 'structure_detection'").pluck().get())
      .toBe(0);
  });
});

function structureLibraryFixture(): {
  readonly context: LibraryContext;
  readonly database: SqliteDatabase;
  readonly decodedText: string;
  readonly contentHash: string;
  readonly sourcePath: string;
} {
  const rootPath = mkdtempSync(path.join(os.tmpdir(), 'writestorm-structure-service-'));
  const database = openSqliteDatabase(':memory:');
  cleanups.push(() => database.close(), () => rmSync(rootPath, { recursive: true, force: true }));
  runMigrations(database, APP_MIGRATIONS);

  const decodedText = [
    'Chapter 1: Start',
    'Body',
    'Chapter 2: Continue',
    'Body',
    '',
    '---',
    '',
    'Chapter 3: Aftermath',
    'Body',
  ].join('\r\n');
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(decodedText, 'utf8')]);
  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const relativePath = 'source/source-1/example.md';
  const sourcePath = path.join(rootPath, ...relativePath.split('/'));
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, bytes);

  const now = '2026-07-11T00:00:00.000Z';
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example', '0.1.0', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES ('source-1', 'book-1', 'md', ?, 'utf-8', 1, ?, ?, 'example.md', ?)
  `).run(contentHash, relativePath, now, bytes.byteLength);
  database.prepare("UPDATE books SET source_text_id = 'source-1' WHERE id = 'book-1'").run();

  return {
    database,
    decodedText,
    contentHash,
    sourcePath,
    context: {
      sessionId: 'session-1',
      rootPath,
      manifestPath: path.join(rootPath, 'library.json'),
      databasePath: path.join(rootPath, 'library.sqlite'),
      database,
      summary: {
        id: 'library-1' as LibraryId,
        name: 'Example',
        rootPath,
        schemaVersion: 4,
        appVersion: '0.1.0',
      },
    },
  };
}

function structureService(
  fixture: ReturnType<typeof structureLibraryFixture>,
  worker: {
    detect(
      input: StructureWorkerDetectionInput,
      timeoutMs: number,
      options?: { readonly signal?: AbortSignal },
    ): Promise<{
      result: ReturnType<typeof executeStructureWorkerDetection>;
      workerPid: number;
    }>;
  },
): StructureService {
  return new StructureService({
    libraryService: { getCurrentContext: () => fixture.context },
    worker,
    createRunId: () => 'run-1' as StructureDetectionRunId,
    createJobId: () => 'job-1' as JobId,
    createCandidateSetId: () => 'candidate-1' as StructureSetId,
    now: sequenceClock(),
  });
}

function expectDetectionState(
  database: SqliteDatabase,
  runState: string,
  jobState: string,
): void {
  expect(database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get())
    .toBe(runState);
  expect(database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get()).toBe(jobState);
}

function currentCandidateCount(database: SqliteDatabase): number {
  return database.prepare(`
    SELECT COUNT(*) FROM structure_sets
    WHERE book_id = 'book-1' AND stage = 'candidate' AND is_current = 1
  `).pluck().get() as number;
}

function deferredWorkerResult() {
  let resolve!: (value: {
    result: ReturnType<typeof executeStructureWorkerDetection>;
    workerPid: number;
  }) => void;
  const promise = new Promise<{
    result: ReturnType<typeof executeStructureWorkerDetection>;
    workerPid: number;
  }>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cancellationAwareWorker(onAbort?: () => void) {
  return {
    detect(
      _input: StructureWorkerDetectionInput,
      _timeoutMs: number,
      options?: { readonly signal?: AbortSignal },
    ) {
      return new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          onAbort?.();
          reject(new UtilityWorkerRunnerError('UTILITY_WORKER_CANCELLED', 'Cancelled.'));
        }, { once: true });
      });
    },
  };
}

function sequenceClock(): () => string {
  const values = [
    '2026-07-11T00:01:00.000Z',
    '2026-07-11T00:02:00.000Z',
    '2026-07-11T00:03:00.000Z',
    '2026-07-11T00:04:00.000Z',
    '2026-07-11T00:05:00.000Z',
  ];
  let index = 0;
  return () => values[index++] ?? values.at(-1)!;
}
