import { randomUUID } from 'node:crypto';
import { linkSync, mkdirSync, rmdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { ImportSourceResult, ImportSourceTypeBinding, SourceTextFormat } from '../../shared/contracts';
import type { BreakdownBookId, JobId, SourceTextId } from '../../shared/domain';
import { JobService } from '../jobs/job-service';
import type { LibraryService } from '../library/library-service';
import { LibraryUnitOfWorkError } from '../library/library-unit-of-work';
import { resolveLibraryRelativePath } from '../library/path-guard';
import { PendingImportStore } from '../books/book-import-entry';
import { detectSourceTextDuplicateByHash } from './source-text-conflicts';
import {
  importBookWithSourceText,
  type ImportBookWithSourceTextResultWithJob,
} from './source-text-import-transaction';
import { buildCanonicalSourceTextRelativePath, buildSourceTextImportMetadata } from './source-text-metadata';
import { MAX_IMPORT_SOURCE_SIZE_BYTES } from './source-text-preflight';
import { recoverAbandonedSourceImports } from './source-health';
import {
  SourceTextWorkerRunnerError,
  type SourceTextWorkerRunner,
} from './worker-runner';

export type SourceImportServiceErrorReason =
  | 'no_current_library'
  | 'invalid_extension'
  | 'pending_import_not_found'
  | 'encoding_required'
  | 'library_session_changed'
  | 'duplicate_source_hash'
  | 'target_conflict'
  | 'copy_failed'
  | 'cancelled'
  | 'database_write_failed';

export type SourceImportServiceResult =
  | { readonly ok: true; readonly data: ImportSourceResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'IMPORT_ERROR';
        readonly message: string;
        readonly details: Readonly<Record<string, unknown>> & {
          readonly reason: SourceImportServiceErrorReason;
        };
      };
    };

type SourceImportWorker = Pick<SourceTextWorkerRunner, 'prepareImport'>;

type ActiveSourceImport = {
  readonly controller: AbortController;
  readonly completion: Promise<SourceImportServiceResult>;
  cancelRequested: boolean;
};

export class SourceImportService {
  private readonly libraryService: LibraryService;
  private readonly worker: SourceImportWorker;
  private readonly now: () => string;
  private readonly createBookId: () => BreakdownBookId;
  private readonly createSourceTextId: () => SourceTextId;
  private readonly createJobId: () => JobId;
  private readonly nowMs: () => number;
  private readonly beforeFinalWrite?: (input: {
    readonly jobId: JobId;
    readonly bookId: BreakdownBookId;
    readonly sourceTextId: SourceTextId;
    readonly contentHash: string;
  }) => void | Promise<void>;
  private readonly afterImportCommitted?: (input: {
    readonly bookId: BreakdownBookId;
    readonly sourceTextId: SourceTextId;
  }) => void | Promise<void>;
  private readonly pendingImports: PendingImportStore;
  private readonly activeImports = new Map<JobId, ActiveSourceImport>();
  private importPauseDepth = 0;

  constructor(options: {
    readonly libraryService: LibraryService;
    readonly worker: SourceImportWorker;
    readonly now?: () => string;
    readonly nowMs?: () => number;
    readonly createBookId?: () => BreakdownBookId;
    readonly createSourceTextId?: () => SourceTextId;
    readonly createJobId?: () => JobId;
    readonly createPendingImportId?: () => string;
    readonly pendingImportTtlMs?: number;
    readonly beforeFinalWrite?: SourceImportService['beforeFinalWrite'];
    readonly afterImportCommitted?: SourceImportService['afterImportCommitted'];
  }) {
    this.libraryService = options.libraryService;
    this.worker = options.worker;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createBookId = options.createBookId ?? (() => randomUUID() as BreakdownBookId);
    this.createSourceTextId = options.createSourceTextId ?? (() => randomUUID() as SourceTextId);
    this.createJobId = options.createJobId ?? (() => randomUUID() as JobId);
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.beforeFinalWrite = options.beforeFinalWrite;
    this.afterImportCommitted = options.afterImportCommitted;
    this.pendingImports = new PendingImportStore({
      createId: options.createPendingImportId ?? randomUUID,
      now: this.nowMs,
      ttlMs: options.pendingImportTtlMs ?? 10 * 60 * 1000,
    });
  }

  import(input: {
    readonly sourcePath?: string;
    readonly title?: string;
    readonly pendingImportId?: string;
    readonly encodingOverride?: 'utf-8' | 'gb18030';
    readonly expectedSessionId?: string;
    readonly typeBinding?: ImportSourceTypeBinding;
  }): Promise<SourceImportServiceResult> {
    if (this.importPauseDepth > 0) {
      return Promise.resolve(failure(
        'library_session_changed',
        'Source imports are paused while the library session changes.',
      ));
    }
    const controller = new AbortController();
    let activeJobId: JobId | null = null;
    const operation = this.runImport(input, controller.signal, (jobId) => {
      activeJobId = jobId;
    }).finally(() => {
      if (activeJobId && this.activeImports.get(activeJobId)?.completion === operation) {
        this.activeImports.delete(activeJobId);
      }
    });
    if (activeJobId) {
      this.activeImports.set(activeJobId, { controller, completion: operation, cancelRequested: false });
    }
    return operation;
  }

  private async runImport(input: {
    readonly sourcePath?: string;
    readonly title?: string;
    readonly pendingImportId?: string;
    readonly encodingOverride?: 'utf-8' | 'gb18030';
    readonly expectedSessionId?: string;
    readonly typeBinding?: ImportSourceTypeBinding;
  }, signal: AbortSignal, registerJobId: (jobId: JobId) => void): Promise<SourceImportServiceResult> {
    const current = this.libraryService.getCurrent();
    if (!current) return failure('no_current_library', 'Open or create a library before importing source text.');
    if (input.expectedSessionId && input.expectedSessionId !== current.sessionId) {
      return failure('library_session_changed', 'The library changed while choosing a source file.');
    }

    const pending = input.pendingImportId
      ? this.pendingImports.take(input.pendingImportId, {
          libraryRootPath: current.library.rootPath,
          sessionId: current.sessionId,
          now: this.nowMs(),
        })
      : null;
    if (input.pendingImportId && !pending) {
      return failure('pending_import_not_found', 'The pending source import could not be found.');
    }

    const sourcePath = pending?.sourcePath ?? input.sourcePath;
    if (!sourcePath) {
      return failure('pending_import_not_found', 'The pending source import could not be found.');
    }
    const titleOverride = pending?.title ?? normalizeTitle(input.title);
    const typeBinding = pending?.typeBinding ?? input.typeBinding;
    const format = sourceFormat(sourcePath);
    if (!format) return failure('invalid_extension', 'Only .txt and .md source files can be imported.');

    const jobId = (pending?.jobId as JobId | undefined) ?? this.createJobId();
    registerJobId(jobId);
    const sourceTextId = (pending?.sourceTextId as SourceTextId | undefined) ?? this.createSourceTextId();
    const importedAt = this.now();
    const unitOfWork = this.libraryService.getUnitOfWork();

    if (!pending) {
      try {
        unitOfWork.write((session) => {
          assertSession(session.sessionId, current.sessionId);
          new JobService({ database: session.database }).createQueued({
            id: jobId,
            bookId: null,
            kind: 'source_import',
            totalUnits: 1,
            payloadSchemaVersion: 1,
            payload: { sourceTextId },
            createdAt: importedAt,
            updatedAt: importedAt,
          });
        });
      } catch {
        return failure('database_write_failed', 'Source import could not be queued.');
      }
    }

    let prepared: Awaited<ReturnType<SourceImportWorker['prepareImport']>>;
    try {
      prepared = await this.worker.prepareImport({
        jobId,
        sourcePath,
        libraryRootPath: current.library.rootPath,
        maxSizeBytes: MAX_IMPORT_SOURCE_SIZE_BYTES,
        encoding: input.encodingOverride ?? 'utf-8',
      }, 30_000, { signal });
    } catch (error) {
      removeStaging(current.library.rootPath, jobId);
      if (signal.aborted) {
        cancelCurrentImport(this.libraryService, current.sessionId, jobId, importedAt);
        return failure('cancelled', 'Source import was cancelled.');
      }
      if (isEncodingRequired(error)) {
        const token = this.pendingImports.create({
          libraryRootPath: current.library.rootPath,
          sessionId: current.sessionId,
          sourcePath,
          ...(titleOverride ? { title: titleOverride } : {}),
          jobId,
          sourceTextId,
          ...(typeBinding ? { typeBinding } : {}),
        });
        return failure('encoding_required', 'Choose the source text encoding and retry.', {
          pendingImportId: token.pendingImportId,
          supportedEncodings: ['utf-8', 'gb18030'],
        });
      }
      failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_WORKER_FAILED');
      return failure('copy_failed', 'Source import worker could not prepare the selected file.');
    }

    if (signal.aborted) {
      removeStaging(current.library.rootPath, jobId);
      cancelCurrentImport(this.libraryService, current.sessionId, jobId, importedAt);
      return failure('cancelled', 'Source import was cancelled.');
    }

    if (this.libraryService.getCurrent()?.sessionId !== current.sessionId) {
      removeStaging(current.library.rootPath, jobId);
      return failure('library_session_changed', 'The library changed while importing source text.');
    }

    try {
      unitOfWork.write((session) => {
        assertSession(session.sessionId, current.sessionId);
        new JobService({ database: session.database }).transition(jobId, 'running', importedAt);
      });
    } catch (error) {
      removeStaging(current.library.rootPath, jobId);
      if (error instanceof LibraryUnitOfWorkError) {
        return failure('library_session_changed', error.message);
      }
      return failure('database_write_failed', 'Source import could not enter the running state.');
    }

    let duplicate: ReturnType<typeof detectSourceTextDuplicateByHash>;
    try {
      duplicate = unitOfWork.read((session) => {
        assertSession(session.sessionId, current.sessionId);
        return detectSourceTextDuplicateByHash(session.database, { contentHash: prepared.contentHash });
      });
    } catch (error) {
      removeStaging(current.library.rootPath, jobId);
      failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_DATABASE_WRITE_FAILED');
      return error instanceof LibraryUnitOfWorkError
        ? failure('library_session_changed', error.message)
        : failure('database_write_failed', 'Source import duplicate policy could not be evaluated.');
    }
    if (!duplicate.ok) {
      removeStaging(current.library.rootPath, jobId);
      failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_DUPLICATE');
      return duplicateFailure(duplicate);
    }

    const originalFileName = path.basename(sourcePath);
    const relativePath = buildCanonicalSourceTextRelativePath(sourceTextId, originalFileName);
    const promoted = promoteStaging({
      libraryRootPath: current.library.rootPath,
      stagingRelativePath: prepared.stagingRelativePath,
      expectedJobId: jobId,
      finalRelativePath: relativePath,
    });
    if (!promoted.ok) {
      failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_PROMOTION_FAILED');
      return failure(promoted.reason, promoted.message, { relativePath });
    }

    const bookId = this.createBookId();
    const title = titleOverride ?? path.basename(originalFileName, path.extname(originalFileName));
    const sourceText = buildSourceTextImportMetadata({
      sourceTextId,
      bookId,
      originalFileName,
      format,
      sizeBytes: prepared.sizeBytes,
      encoding: prepared.encoding,
      contentHash: prepared.contentHash,
      relativePath,
      importedAt,
    });
    let committed: ImportBookWithSourceTextResultWithJob;
    try {
      await this.beforeFinalWrite?.({ jobId, bookId, sourceTextId, contentHash: prepared.contentHash });
      if (signal.aborted) {
        removePromoted(promoted.targetPath);
        cancelCurrentImport(this.libraryService, current.sessionId, jobId, importedAt);
        return failure('cancelled', 'Source import was cancelled.');
      }
      committed = unitOfWork.write((session) => {
        assertSession(session.sessionId, current.sessionId);
        return importBookWithSourceText(session.database, {
          libraryId: session.library.id,
          bookId,
          title,
          sourceText,
          ...(typeBinding ? { typeBinding } : {}),
          job: { id: jobId, sourceTextId, updatedAt: importedAt },
          updatedAt: importedAt,
        });
      });
    } catch (error) {
      removePromoted(promoted.targetPath);
      const duplicateAfterRace = readDuplicate(this.libraryService, current.sessionId, prepared.contentHash);
      if (duplicateAfterRace && !duplicateAfterRace.ok) {
        failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_DUPLICATE');
        return duplicateFailure(duplicateAfterRace);
      }
      failCurrentImport(this.libraryService, current.sessionId, jobId, importedAt, 'SOURCE_IMPORT_DATABASE_WRITE_FAILED');
      if (error instanceof LibraryUnitOfWorkError) {
        return failure('library_session_changed', error.message);
      }
      return failure('database_write_failed', 'Source import could not be saved to the library database.');
    }
    try {
      await this.afterImportCommitted?.({ bookId, sourceTextId });
    } catch {
      // Import is already committed. Structure workspace exposes Detect/Retry recovery separately.
    }
    return { ok: true, data: committed };
  }

  recoverAbandonedImports(): Promise<{ readonly recoveredJobIds: string[] }> {
    const result = this.libraryService.getUnitOfWork().write((session) => recoverAbandonedSourceImports({
      database: session.database,
      libraryRootPath: session.rootPath,
      recoveredAt: this.now(),
    }));
    return Promise.resolve(result);
  }

  clearPendingImports(): void {
    this.pendingImports.clearAll();
  }

  async cancelImport(jobId: JobId, expectedSessionId?: string): Promise<boolean> {
    const current = this.libraryService.getCurrent();
    if (expectedSessionId && current?.sessionId !== expectedSessionId) {
      throw new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED');
    }
    const active = this.activeImports.get(jobId);
    if (active) {
      if (!active.cancelRequested) {
        active.cancelRequested = true;
        active.controller.abort();
      }
      await active.completion;
      return true;
    }

    if (!current) return false;
    const pendingScope = {
      libraryRootPath: current.library.rootPath,
      sessionId: current.sessionId,
    };
    if (!this.pendingImports.hasByJobId(jobId, pendingScope)) return false;
    this.libraryService.getUnitOfWork().write((session) => {
      assertSession(session.sessionId, current.sessionId);
      new JobService({ database: session.database }).cancel(jobId, this.now(), {
        runtimeOwner: 'none',
      });
    });
    this.pendingImports.clearByJobId(jobId, pendingScope);
    return true;
  }

  cancelActiveImports(): number {
    for (const active of this.activeImports.values()) {
      active.cancelRequested = true;
      active.controller.abort();
    }
    return this.activeImports.size;
  }

  pauseImports(): number {
    this.importPauseDepth += 1;
    return this.cancelActiveImports();
  }

  resumeImports(): void {
    this.importPauseDepth = Math.max(0, this.importPauseDepth - 1);
  }

  async waitForIdle(): Promise<void> {
    await Promise.allSettled([...this.activeImports.values()].map(({ completion }) => completion));
  }
}

function assertSession(actual: string, expected: string): void {
  if (actual !== expected) throw new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED');
}

function sourceFormat(sourcePath: string): SourceTextFormat | null {
  const extension = path.extname(sourcePath).toLowerCase();
  return extension === '.txt' ? 'txt' : extension === '.md' ? 'md' : null;
}

function normalizeTitle(title: string | undefined): string | undefined {
  return title?.trim() || undefined;
}

function isEncodingRequired(error: unknown): boolean {
  if (error instanceof SourceTextWorkerRunnerError) {
    return error.workerErrorCode === 'SOURCE_TEXT_ENCODING_REQUIRED';
  }
  return typeof error === 'object' && error !== null && 'code' in error &&
    error.code === 'SOURCE_TEXT_ENCODING_REQUIRED';
}

function promoteStaging(input: {
  readonly libraryRootPath: string;
  readonly stagingRelativePath: string;
  readonly expectedJobId: JobId;
  readonly finalRelativePath: string;
}): { readonly ok: true; readonly targetPath: string } | {
  readonly ok: false;
  readonly reason: 'target_conflict' | 'copy_failed';
  readonly message: string;
} {
  const expectedStaging = `source/.staging/${input.expectedJobId}.tmp`;
  if (input.stagingRelativePath.replaceAll('\\', '/') !== expectedStaging) {
    removeStaging(input.libraryRootPath, input.expectedJobId);
    return { ok: false, reason: 'copy_failed', message: 'Source worker returned an invalid staging path.' };
  }
  const stagingPath = resolveLibraryRelativePath(input.libraryRootPath, expectedStaging);
  const targetPath = resolveLibraryRelativePath(input.libraryRootPath, input.finalRelativePath);
  try {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    linkSync(stagingPath, targetPath);
    removeStaging(input.libraryRootPath, input.expectedJobId);
    return { ok: true, targetPath };
  } catch (error) {
    removeStaging(input.libraryRootPath, input.expectedJobId);
    const conflict = typeof error === 'object' && error !== null && 'code' in error &&
      (error.code === 'EEXIST' || error.code === 'ENOTEMPTY');
    return conflict
      ? { ok: false, reason: 'target_conflict', message: 'The canonical source target already exists.' }
      : { ok: false, reason: 'copy_failed', message: 'Source staging could not be promoted.' };
  }
}

function removeStaging(libraryRootPath: string, jobId: JobId): void {
  try {
    rmSync(resolveLibraryRelativePath(libraryRootPath, `source/.staging/${jobId}.tmp`), { force: true });
  } catch {
    // Stable import errors take precedence; source health reports leftover staging.
  }
}

function removePromoted(targetPath: string): void {
  try {
    rmSync(targetPath, { force: true });
    rmdirSync(path.dirname(targetPath));
  } catch {
    // Preserve sibling/user files; source health reports leftovers or non-empty directories.
  }
}

function failCurrentImport(
  libraryService: LibraryService,
  sessionId: string,
  jobId: JobId,
  updatedAt: string,
  errorCode: string,
): void {
  try {
    libraryService.getUnitOfWork().write((session) => {
      assertSession(session.sessionId, sessionId);
      new JobService({ database: session.database }).fail(jobId, updatedAt, {
        errorCode,
        errorDetails: { reason: errorCode.toLowerCase() },
      });
    });
  } catch {
    // Session replacement and cleanup failures are recovered on the next library open.
  }
}

function cancelCurrentImport(
  libraryService: LibraryService,
  sessionId: string,
  jobId: JobId,
  updatedAt: string,
): void {
  try {
    libraryService.getUnitOfWork().write((session) => {
      assertSession(session.sessionId, sessionId);
      new JobService({ database: session.database }).cancel(jobId, updatedAt, {
        runtimeOwner: 'confirmed_stopped',
      });
    });
  } catch {
    // Session replacement owns cleanup; restart recovery handles an abandoned record.
  }
}

function readDuplicate(libraryService: LibraryService, sessionId: string, contentHash: string) {
  try {
    return libraryService.getUnitOfWork().read((session) => {
      assertSession(session.sessionId, sessionId);
      return detectSourceTextDuplicateByHash(session.database, { contentHash });
    });
  } catch {
    return null;
  }
}

function duplicateFailure(duplicate: Exclude<ReturnType<typeof detectSourceTextDuplicateByHash>, { ok: true }>): SourceImportServiceResult {
  return failure('duplicate_source_hash', duplicate.message, {
    existingBookId: duplicate.existingBookId,
    existingSourceTextId: duplicate.existingSourceTextId,
  });
}

function failure(
  reason: SourceImportServiceErrorReason,
  message: string,
  details: Record<string, unknown> = {},
): SourceImportServiceResult {
  return {
    ok: false,
    error: {
      code: 'IMPORT_ERROR',
      message,
      details: { reason, ...details },
    },
  };
}
