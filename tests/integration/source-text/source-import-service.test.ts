import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryService } from '../../../src/main/library/library-service';
import { SourceImportService } from '../../../src/main/source-text/source-import-service';
import { SourceTextWorkerRunnerError } from '../../../src/main/source-text/worker-runner';
import type { PrepareSourceImportInput } from '../../../src/main/source-text/worker-protocol';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  SourceTextId,
} from '../../../src/shared/domain';

const tempDirs: string[] = [];
const libraries: LibraryService[] = [];
const importedAt = '2026-07-13T12:00:00.000Z';

afterEach(() => {
  vi.restoreAllMocks();
  for (const library of libraries.splice(0)) library.closeCurrent();
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('SourceImportService', () => {
  it('does not synthesize a completed JobSummary outside persistence', () => {
    const source = readFileSync('src/main/source-text/source-import-service.ts', 'utf8');
    expect(source).not.toContain('completedJobSummary');
    expect(source).not.toContain('data: { ...committed, job }');
  });

  it('rejects a stale dialog selection before queueing or starting the worker', async () => {
    const fixture = sourceImportFixture();
    const worker = successfulWorker(fixture.sourceBytes);
    const service = fixture.service({ worker });

    const result = await service.import({
      sourcePath: fixture.sourcePath,
      expectedSessionId: 'stale-session',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { details: { reason: 'library_session_changed' } },
    });
    expect(worker.prepareImport).not.toHaveBeenCalled();
    expect(fixture.rows('jobs')).toEqual([]);
  });

  it('cancels active worker imports and exposes an idle barrier for lifecycle cleanup', async () => {
    const fixture = sourceImportFixture();
    let workerStarted!: () => void;
    const started = new Promise<void>((resolve) => { workerStarted = resolve; });
    const worker = {
      prepareImport: vi.fn((_input: PrepareSourceImportInput, _timeout: number, options: { signal?: AbortSignal }) => (
        new Promise<never>((_resolve, reject) => {
          workerStarted();
          options.signal?.addEventListener('abort', () => reject(
            new SourceTextWorkerRunnerError('cancelled', 'internal cancellation'),
          ), { once: true });
        })
      )),
    };
    const service = fixture.service({ worker });
    const importing = service.import({ sourcePath: fixture.sourcePath });
    await started;

    expect(service.pauseImports()).toBe(1);
    await expect(service.import({ sourcePath: fixture.sourcePath })).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'library_session_changed' } },
    });
    expect(worker.prepareImport).toHaveBeenCalledOnce();
    await service.waitForIdle();
    await expect(importing).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'cancelled' } },
    });
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'cancelled',
      error_code: null,
    });
    service.resumeImports();
    service.pauseImports();
    service.pauseImports();
    service.resumeImports();
    await expect(service.import({ sourcePath: `${fixture.sourcePath}.pdf` })).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'library_session_changed' } },
    });
    service.resumeImports();
    await expect(service.import({ sourcePath: `${fixture.sourcePath}.pdf` })).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'invalid_extension' } },
    });
  });

  it('cancels the exact active import by jobId after its worker stops', async () => {
    const fixture = sourceImportFixture();
    let workerStarted!: () => void;
    const started = new Promise<void>((resolve) => { workerStarted = resolve; });
    let stateObservedDuringAbort: unknown;
    const worker = {
      prepareImport: vi.fn((input: PrepareSourceImportInput, _timeout: number, options: { signal?: AbortSignal }) => (
        new Promise<never>((_resolve, reject) => {
          workerStarted();
          options.signal?.addEventListener('abort', () => {
            stateObservedDuringAbort = jobRow(fixture.library, input.jobId).state;
            reject(new SourceTextWorkerRunnerError('cancelled', 'cancelled by jobs IPC'));
          }, { once: true });
        })
      )),
    };
    const service = fixture.service({ worker });
    const importing = service.import({ sourcePath: fixture.sourcePath });
    await started;

    await expect(service.cancelImport('job-other' as JobId)).resolves.toBe(false);
    expect(stateObservedDuringAbort).toBeUndefined();
    await expect(service.cancelImport('job-1' as JobId)).resolves.toBe(true);
    expect(stateObservedDuringAbort).toBe('queued');
    await expect(importing).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'cancelled' } },
    });
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'cancelled',
      error_code: null,
    });
    await expect(service.cancelImport('job-1' as JobId)).resolves.toBe(false);
  });

  it('owns queued -> running -> completed and commits Book, SourceText, Job, and checkpoint', async () => {
    const fixture = sourceImportFixture();
    const observedStates: string[] = [];
    const worker = successfulWorker(fixture.sourceBytes, (input) => {
      observedStates.push(jobRow(fixture.library, input.jobId).state as string);
    });
    const service = fixture.service({
      worker,
      beforeFinalWrite: ({ jobId }: { readonly jobId: JobId }) => {
        observedStates.push(jobRow(fixture.library, jobId).state as string);
      },
    });

    const result = await service.import({
      sourcePath: fixture.sourcePath,
      title: 'Imported title',
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        book: { id: 'book-1', title: 'Imported title', sourceTextId: 'source-1' },
        sourceText: { id: 'source-1', bookId: 'book-1', sourceTextEdition: 1 },
        job: { id: 'job-1', bookId: 'book-1', state: 'completed' },
      },
    });
    expect(observedStates).toEqual(['queued', 'running']);
    expect(readFileSync(fixture.finalPath, 'utf8')).toBe(fixture.sourceBytes.toString('utf8'));
    expect(existsSync(fixture.stagingPath)).toBe(false);
    expect(fixture.rows('books')).toHaveLength(1);
    expect(fixture.rows('source_texts')).toHaveLength(1);
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      book_id: 'book-1',
      state: 'completed',
      completed_units: 1,
      total_units: 1,
      error_code: null,
    });
    expect(fixture.rows('job_checkpoints')).toEqual([
      expect.objectContaining({
        job_id: 'job-1',
        sequence: 1,
        kind: 'source_import_completed',
      }),
    ]);
  });

  it('starts the post-commit structure hook only after the imported book is readable', async () => {
    const fixture = sourceImportFixture();
    const observed: unknown[] = [];
    const service = fixture.service({
      worker: successfulWorker(fixture.sourceBytes),
      afterImportCommitted: ({ bookId, sourceTextId }) => {
        observed.push({
          bookId, sourceTextId,
          bookCount: fixture.rows('books').length,
          importState: fixture.rows('jobs')[0]?.state,
        });
      },
    });
    await expect(service.import({ sourcePath: fixture.sourcePath })).resolves.toMatchObject({ ok: true });
    expect(observed).toEqual([{
      bookId: 'book-1', sourceTextId: 'source-1', bookCount: 1, importState: 'completed',
    }]);
  });

  it('preserves a completed import when the post-commit structure hook fails', async () => {
    const fixture = sourceImportFixture();
    const service = fixture.service({
      worker: successfulWorker(fixture.sourceBytes),
      afterImportCommitted: () => { throw new Error('structure detection could not start'); },
    });
    await expect(service.import({ sourcePath: fixture.sourcePath })).resolves.toMatchObject({
      ok: true, data: { book: { id: 'book-1' } },
    });
    expect(fixture.rows('books')).toHaveLength(1);
    expect(fixture.rows('source_texts')).toHaveLength(1);
    expect(fixture.rows('jobs')[0]).toMatchObject({ kind: 'source_import', state: 'completed' });
    expect(existsSync(fixture.finalPath)).toBe(true);
  });

  it('rejects a duplicate hash before promotion and fails the queued import Job', async () => {
    const fixture = sourceImportFixture();
    seedImportedSource(fixture.library, {
      bookId: 'existing-book',
      sourceTextId: 'existing-source',
      contentHash: sha256(fixture.sourceBytes),
    });
    const service = fixture.service({ worker: successfulWorker(fixture.sourceBytes) });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        details: {
          reason: 'duplicate_source_hash',
          existingBookId: 'existing-book',
          existingSourceTextId: 'existing-source',
        },
      },
    });
    expect(fixture.rows('books')).toHaveLength(1);
    expect(fixture.rows('source_texts')).toHaveLength(1);
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_DUPLICATE',
    });
    expect(existsSync(fixture.stagingPath)).toBe(false);
    expect(existsSync(fixture.finalPath)).toBe(false);
  });

  it('returns a pending token for encoding selection and reuses it for an explicit retry', async () => {
    const fixture = sourceImportFixture(Buffer.from([0x81, 0x40]));
    const attemptedEncodings: string[] = [];
    const worker = {
      prepareImport: vi.fn(async (input: PrepareSourceImportInput) => {
        attemptedEncodings.push(input.encoding);
        if (input.encoding === 'utf-8') {
          const error = new Error('Choose the source encoding.') as Error & {
            code: 'SOURCE_TEXT_ENCODING_REQUIRED';
          };
          error.code = 'SOURCE_TEXT_ENCODING_REQUIRED';
          throw error;
        }
        return writeStaging(input, fixture.sourceBytes);
      }),
    };
    const service = fixture.service({ worker });

    const first = await service.import({ sourcePath: fixture.sourcePath, title: 'GB text' });
    expect(first).toMatchObject({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        details: {
          reason: 'encoding_required',
          pendingImportId: 'pending-1',
          supportedEncodings: ['utf-8', 'gb18030'],
        },
      },
    });

    const retry = await service.import({
      sourcePath: fixture.sourcePath,
      pendingImportId: 'pending-1',
      encodingOverride: 'gb18030',
    });
    expect(retry).toMatchObject({ ok: true, data: { sourceText: { encoding: 'gb18030' } } });
    expect(attemptedEncodings).toEqual(['utf-8', 'gb18030']);
    expect(fixture.rows('jobs')).toHaveLength(1);
  });

  it('rejects a library session replacement after worker staging and does not publish the import', async () => {
    const fixture = sourceImportFixture();
    const originalRoot = fixture.rootPath;
    const replacementRoot = path.join(fixture.tempDir, 'replacement-library');
    const worker = successfulWorker(fixture.sourceBytes, () => {
      fixture.library.create({ rootPath: replacementRoot, name: 'Replacement' });
    });
    const service = fixture.service({ worker });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'IMPORT_ERROR', details: { reason: 'library_session_changed' } },
    });
    expect(fixture.library.getCurrent()?.library.rootPath).toBe(replacementRoot);
    expect(existsSync(path.join(originalRoot, 'source', '.staging', 'job-1.tmp'))).toBe(false);
    expect(existsSync(path.join(originalRoot, 'source', 'source-1', 'novel.md'))).toBe(false);

    await fixture.library.open({ rootPath: originalRoot });
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({ state: 'queued', error_code: null });
    await service.recoverAbandonedImports();
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_ABANDONED',
    });
    expect(fixture.rows('books')).toHaveLength(0);
  });

  it('maps a worker crash to a stable import failure and cleans staging', async () => {
    const fixture = sourceImportFixture();
    const worker = {
      prepareImport: vi.fn(async (input: PrepareSourceImportInput) => {
        writeStaging(input, fixture.sourceBytes);
        throw new SourceTextWorkerRunnerError('crash', 'process-specific crash details');
      }),
    };
    const service = fixture.service({ worker });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'IMPORT_ERROR', details: { reason: 'copy_failed' } },
    });
    expect(result).not.toEqual(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('process-specific') }),
    }));
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_WORKER_FAILED',
    });
    expect(existsSync(fixture.stagingPath)).toBe(false);
  });

  it('does not overwrite or delete an existing canonical target when promotion conflicts', async () => {
    const fixture = sourceImportFixture();
    mkdirSync(path.dirname(fixture.finalPath), { recursive: true });
    writeFileSync(fixture.finalPath, 'existing canonical bytes');
    const service = fixture.service({ worker: successfulWorker(fixture.sourceBytes) });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'IMPORT_ERROR', details: { reason: 'target_conflict' } },
    });
    expect(readFileSync(fixture.finalPath, 'utf8')).toBe('existing canonical bytes');
    expect(existsSync(fixture.stagingPath)).toBe(false);
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_PROMOTION_FAILED',
    });
  });

  it('removes the promoted final file and fails the Job when the final database write fails', async () => {
    const fixture = sourceImportFixture();
    const siblingPath = path.join(path.dirname(fixture.finalPath), 'keep-user-file.txt');
    mkdirSync(path.dirname(siblingPath), { recursive: true });
    writeFileSync(siblingPath, 'must survive compensation');
    fixture.library.getUnitOfWork().write((session) => session.database.exec(`
      CREATE TRIGGER reject_source_import
      BEFORE INSERT ON source_texts
      BEGIN
        SELECT RAISE(ABORT, 'test database failure');
      END;
    `));
    const service = fixture.service({ worker: successfulWorker(fixture.sourceBytes) });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'IMPORT_ERROR', details: { reason: 'database_write_failed' } },
    });
    expect(existsSync(fixture.finalPath)).toBe(false);
    expect(readFileSync(siblingPath, 'utf8')).toBe('must survive compensation');
    expect(fixture.rows('books')).toHaveLength(0);
    expect(fixture.rows('source_texts')).toHaveLength(0);
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_DATABASE_WRITE_FAILED',
    });
  });

  it('compensates the final file and reports the existing source when a unique-hash race wins', async () => {
    const fixture = sourceImportFixture();
    const service = fixture.service({
      worker: successfulWorker(fixture.sourceBytes),
      beforeFinalWrite: () => seedImportedSource(fixture.library, {
        bookId: 'race-book',
        sourceTextId: 'race-source',
        contentHash: sha256(fixture.sourceBytes),
      }),
    });

    const result = await service.import({ sourcePath: fixture.sourcePath });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        details: {
          reason: 'duplicate_source_hash',
          existingBookId: 'race-book',
          existingSourceTextId: 'race-source',
        },
      },
    });
    expect(existsSync(fixture.finalPath)).toBe(false);
    expect(fixture.rows('books')).toHaveLength(1);
    expect(fixture.rows('source_texts')).toHaveLength(1);
    expect(jobRow(fixture.library, 'job-1')).toMatchObject({ state: 'failed' });
  });

  it('fails abandoned queued/running imports and removes only their staging files', async () => {
    const fixture = sourceImportFixture();
    seedAbandonedJob(fixture.library, 'queued-job', 'queued');
    seedAbandonedJob(fixture.library, 'running-job', 'running');
    seedPreservedSourceImportRecoveryJob(fixture.library, 'failed-job', 'failed');
    seedPreservedSourceImportRecoveryJob(fixture.library, 'resumable-job', 'resumable');
    mkdirSync(path.join(fixture.rootPath, 'source', '.staging'), { recursive: true });
    writeFileSync(path.join(fixture.rootPath, 'source', '.staging', 'queued-job.tmp'), 'queued');
    writeFileSync(path.join(fixture.rootPath, 'source', '.staging', 'running-job.tmp'), 'running');
    writeFileSync(path.join(fixture.rootPath, 'source', '.staging', 'unrelated.tmp'), 'keep');
    const service = fixture.service({ worker: successfulWorker(fixture.sourceBytes) });

    expect(await service.recoverAbandonedImports()).toEqual({ recoveredJobIds: [
      'queued-job',
      'running-job',
    ] });
    expect(jobRow(fixture.library, 'queued-job')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_ABANDONED',
    });
    expect(jobRow(fixture.library, 'running-job')).toMatchObject({
      state: 'failed',
      error_code: 'SOURCE_IMPORT_ABANDONED',
    });
    expect(jobRow(fixture.library, 'failed-job')).toMatchObject({
      state: 'failed',
      error_code: 'PRESERVED_FAILURE',
    });
    expect(jobRow(fixture.library, 'resumable-job')).toMatchObject({
      state: 'resumable',
      error_code: 'PRESERVED_RECOVERY',
    });
    expect(existsSync(path.join(fixture.rootPath, 'source', '.staging', 'queued-job.tmp'))).toBe(false);
    expect(existsSync(path.join(fixture.rootPath, 'source', '.staging', 'running-job.tmp'))).toBe(false);
    expect(existsSync(path.join(fixture.rootPath, 'source', '.staging', 'unrelated.tmp'))).toBe(true);
  });
});

function sourceImportFixture(sourceBytes = Buffer.from('# Novel\nBody\n', 'utf8')) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-import-service-'));
  tempDirs.push(tempDir);
  const rootPath = path.join(tempDir, 'library');
  const sourcePath = path.join(tempDir, 'novel.md');
  writeFileSync(sourcePath, sourceBytes);
  const library = new LibraryService({
    appVersion: '0.1.0-test',
    createLibraryId: () => 'library-1' as LibraryId,
    createLibrarySessionId: sequence('session'),
  });
  libraries.push(library);
  library.create({ rootPath, name: 'Source Import Library' });

  const service = (overrides: {
    readonly worker: { readonly prepareImport: (...args: any[]) => Promise<any> };
    readonly beforeFinalWrite?: (...args: any[]) => void | Promise<void>;
    readonly afterImportCommitted?: (...args: any[]) => void | Promise<void>;
  }) => new SourceImportService({
    libraryService: library,
    worker: overrides.worker,
    now: () => importedAt,
    nowMs: () => Date.parse(importedAt),
    createBookId: () => 'book-1' as BreakdownBookId,
    createSourceTextId: () => 'source-1' as SourceTextId,
    createJobId: () => 'job-1' as JobId,
    createPendingImportId: () => 'pending-1',
    ...(overrides.beforeFinalWrite ? { beforeFinalWrite: overrides.beforeFinalWrite } : {}),
    ...(overrides.afterImportCommitted ? { afterImportCommitted: overrides.afterImportCommitted } : {}),
  });

  return {
    tempDir,
    rootPath,
    sourcePath,
    sourceBytes,
    library,
    service,
    stagingPath: path.join(rootPath, 'source', '.staging', 'job-1.tmp'),
    finalPath: path.join(rootPath, 'source', 'source-1', 'novel.md'),
    rows: (table: string): Record<string, unknown>[] => library.getUnitOfWork().read(
      (session) => session.database.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[],
    ),
  };
}

function successfulWorker(
  bytes: Buffer,
  beforeResult: (input: PrepareSourceImportInput) => void = () => undefined,
) {
  return {
    prepareImport: vi.fn(async (input: PrepareSourceImportInput) => {
      const result = writeStaging(input, bytes);
      beforeResult(input);
      return result;
    }),
  };
}

function writeStaging(input: PrepareSourceImportInput, bytes: Buffer) {
  const stagingPath = path.join(input.libraryRootPath, 'source', '.staging', `${input.jobId}.tmp`);
  mkdirSync(path.dirname(stagingPath), { recursive: true });
  writeFileSync(stagingPath, bytes);
  return {
    stagingRelativePath: `source/.staging/${input.jobId}.tmp`,
    sizeBytes: bytes.length,
    contentHash: sha256(bytes),
    encoding: input.encoding,
    workerPid: 1234,
  };
}

function seedImportedSource(
  library: LibraryService,
  input: { readonly bookId: string; readonly sourceTextId: string; readonly contentHash: string },
): void {
  library.getUnitOfWork().write((session) => {
    session.database.prepare(`
      INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
    `).run(input.bookId, 'Existing', importedAt, importedAt);
    session.database.prepare(`
      INSERT INTO source_texts (
        id, book_id, original_file_name, size_bytes, format, content_hash,
        encoding, source_edition, relative_path, imported_at
      ) VALUES (?, ?, 'existing.md', 1, 'md', ?, 'utf-8', 1, ?, ?)
    `).run(
      input.sourceTextId,
      input.bookId,
      input.contentHash,
      `source/${input.sourceTextId}/existing.md`,
      importedAt,
    );
    session.database.prepare(
      'UPDATE books SET current_source_text_id = ? WHERE id = ?',
    ).run(input.sourceTextId, input.bookId);
  });
}

function seedAbandonedJob(library: LibraryService, jobId: string, state: 'queued' | 'running'): void {
  library.getUnitOfWork().write((session) => session.database.prepare(`
    INSERT INTO jobs (
      id, book_id, kind, state, completed_units, total_units,
      payload_schema_version, payload_json, error_code, error_details_json,
      created_at, updated_at
    ) VALUES (?, NULL, 'source_import', ?, 0, 1, 1, ?, NULL, NULL, ?, ?)
  `).run(jobId, state, JSON.stringify({ sourceTextId: `${jobId}-source` }), importedAt, importedAt));
}

function seedPreservedSourceImportRecoveryJob(
  library: LibraryService,
  jobId: string,
  state: 'failed' | 'resumable',
): void {
  library.getUnitOfWork().write((session) => session.database.prepare(`
    INSERT INTO jobs (
      id, book_id, kind, state, completed_units, total_units,
      payload_schema_version, payload_json, error_code, error_details_json,
      created_at, updated_at
    ) VALUES (?, NULL, 'source_import', ?, 0, 1, 1, ?, ?, NULL, ?, ?)
  `).run(
    jobId,
    state,
    JSON.stringify({ sourceTextId: `${jobId}-source` }),
    state === 'failed' ? 'PRESERVED_FAILURE' : 'PRESERVED_RECOVERY',
    importedAt,
    importedAt,
  ));
}

function jobRow(library: LibraryService, jobId: string): Record<string, unknown> {
  return library.getUnitOfWork().read((session) => session.database.prepare(
    'SELECT * FROM jobs WHERE id = ?',
  ).get(jobId) as Record<string, unknown>);
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function sequence(prefix: string): () => string {
  let value = 0;
  return () => `${prefix}-${++value}`;
}
