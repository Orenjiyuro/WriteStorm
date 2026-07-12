import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import path from 'node:path';
import type { ContractRequest, ContractResponse, JobSummary } from '../../shared/contracts';
import type {
  BreakdownBookId,
  JobId,
  SourceTextId,
} from '../../shared/domain';
import { createDomainError } from '../../shared/errors';
import type { LibraryService } from '../library/library-service';
import { LibraryUnitOfWorkError } from '../library/library-unit-of-work';
import { BookService, BookServiceError } from './book-service';
import {
  type ImportFileDialogOptions,
  type ImportFileDialogResult,
  PendingImportStore,
  selectImportSourceFile,
} from './book-import-entry';
import { copySourceTextToLibrarySource } from '../source-text/source-text-copy';
import { detectSourceTextDuplicateByHash } from '../source-text/source-text-conflicts';
import { decodeSourceTextBytes } from '../source-text/source-text-encoding';
import { importBookWithSourceText } from '../source-text/source-text-import-transaction';
import { buildSourceTextImportMetadata } from '../source-text/source-text-metadata';
import { preflightSourceTextFile } from '../source-text/source-text-preflight';

export type BookImportIpcDependencies = {
  readonly list: () => ContractResponse<'books:list'>;
  readonly clearPendingImports: () => void;
  readonly importSource: (
    request: ContractRequest<'books:import-source'>,
  ) => Promise<ContractResponse<'books:import-source'>>;
};

export type BookImportIpcOptions = {
  readonly service: LibraryService;
  readonly env?: Record<string, string | undefined>;
  readonly showOpenDialog: (options: ImportFileDialogOptions) => Promise<ImportFileDialogResult>;
  readonly now?: () => string;
  readonly createBookId?: () => BreakdownBookId;
  readonly createSourceTextId?: () => SourceTextId;
  readonly createJobId?: () => JobId;
  readonly createPendingImportId?: () => string;
  readonly pendingImportTtlMs?: number;
  readonly nowMs?: () => number;
};

export function createBookImportIpcDependencies(options: BookImportIpcOptions): BookImportIpcDependencies {
  const unitOfWork = options.service.getUnitOfWork();
  const bookService = new BookService({ libraryService: options.service });
  const now = options.now ?? (() => new Date().toISOString());
  const nowMs = options.nowMs ?? (() => Date.now());
  const createBookId = options.createBookId ?? (() => randomUUID() as BreakdownBookId);
  const createSourceTextId = options.createSourceTextId ?? (() => randomUUID() as SourceTextId);
  const createJobId = options.createJobId ?? (() => randomUUID() as JobId);
  const pendingImports = new PendingImportStore({
    createId: options.createPendingImportId ?? randomUUID,
    now: nowMs,
    ttlMs: options.pendingImportTtlMs ?? 10 * 60 * 1000,
  });

  return {
    list: () => listBooks(bookService),
    clearPendingImports: () => pendingImports.clearAll(),
    importSource: async (request) => {
      const current = options.service.getCurrent();

      if (!current) {
        return importFailure('no_current_library', 'Open or create a library before importing source text.');
      }

      pendingImports.clearExpired(nowMs());

      let selectedPath: string;
      let requestedTitle: string | undefined;
      let pendingImportId: string | undefined;
      const encodingOverride = 'pendingImportId' in request ? request.encodingOverride : undefined;

      if ('pendingImportId' in request) {
        const pendingImport = pendingImports.resolve(request.pendingImportId, {
          libraryRootPath: current.library.rootPath,
          sessionId: current.sessionId,
          now: nowMs(),
        });

        if (!pendingImport) {
          return importFailure('pending_import_not_found', 'The pending source import could not be found.', {
            pendingImportId: request.pendingImportId,
          });
        }

        selectedPath = pendingImport.sourcePath;
        requestedTitle = pendingImport.title;
        pendingImportId = request.pendingImportId;
      } else {
        const dialogPath = await selectImportSourceFile({
          env: options.env,
          showOpenDialog: options.showOpenDialog,
        });

        const activeSession = options.service.getCurrent();
        if (!activeSession || activeSession.sessionId !== current.sessionId) {
          return importFailure('library_session_changed', 'The library changed while choosing a source file. Start the import again.');
        }

        if (!dialogPath) {
          return importFailure('dialog_cancelled', 'Source import was cancelled.');
        }

        selectedPath = dialogPath;
        requestedTitle = normalizeTitleOverride(request.title);
      }

      const preflight = preflightSourceTextFile(selectedPath);
      if (!preflight.ok) {
        return importFailure(preflight.reason, preflight.message, preflight.details);
      }

      if (!preflight.bytes) {
        return importFailure('not_readable', 'Source file could not be read from the validated file descriptor.');
      }

      const bytes = preflight.bytes;
      const decoded = decodeSourceTextBytes(bytes, encodingOverride ? { encodingOverride } : undefined);
      if (!decoded.ok) {
        const pendingToken = pendingImportId
          ? { pendingImportId }
          : pendingImports.create({
            libraryRootPath: current.library.rootPath,
            sessionId: current.sessionId,
            sourcePath: preflight.filePath,
            ...(requestedTitle === undefined ? {} : { title: requestedTitle }),
          });

        return importFailure(decoded.reason, decoded.message, {
          pendingImportId: pendingToken.pendingImportId,
          supportedEncodings: [...decoded.supportedEncodings],
        });
      }

      const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      const duplicate = unitOfWork.read((session) =>
        detectSourceTextDuplicateByHash(session.database, { contentHash }));
      if (!duplicate.ok) {
        return importFailure(duplicate.reason, duplicate.message, {
          existingBookId: duplicate.existingBookId,
          existingSourceTextId: duplicate.existingSourceTextId,
        });
      }

      const bookId = createBookId();
      const sourceTextId = createSourceTextId();
      const importedAt = now();
      const copyResult = copySourceTextToLibrarySource({
        libraryRootPath: current.library.rootPath,
        sourcePath: preflight.filePath,
        sourceBytes: bytes,
        sourceTextId,
        originalFileName: preflight.originalFileName,
      });

      if (!copyResult.ok) {
        return importFailure(copyResult.reason, copyResult.message, copyResult.relativePath
          ? { relativePath: copyResult.relativePath }
          : undefined);
      }

      const title = requestedTitle ||
        path.basename(preflight.originalFileName, path.extname(preflight.originalFileName));
      const sourceText = buildSourceTextImportMetadata({
        bookId,
        sourceTextId,
        originalFileName: preflight.originalFileName,
        format: preflight.format,
        sizeBytes: copyResult.sizeBytes,
        encoding: decoded.encoding,
        contentHash: copyResult.contentHash,
        relativePath: copyResult.relativePath,
        importedAt,
      });

      try {
        const job = buildCompletedImportJob({
          createJobId,
          bookId,
          now: importedAt,
        });
        const importResult = unitOfWork.write((session) => {
          if (session.sessionId !== current.sessionId) {
            throw new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED');
          }
          return importBookWithSourceText(session.database, {
            libraryId: session.library.id,
            bookId,
            title,
            sourceText,
            job: {
              sourceTextId,
              summary: job,
            },
            updatedAt: importedAt,
          });
        });

        return {
          ok: true,
          data: {
            ...importResult,
            job,
          },
        };
      } catch (error) {
        rmSync(copyResult.targetPath, { force: true });

        if (isContentHashUniqueConstraintError(error)) {
          const duplicate = unitOfWork.read((session) =>
            detectSourceTextDuplicateByHash(session.database, { contentHash }));
          if (!duplicate.ok) {
            return importFailure(duplicate.reason, duplicate.message, {
              existingBookId: duplicate.existingBookId,
              existingSourceTextId: duplicate.existingSourceTextId,
            });
          }
        }

        if (error instanceof LibraryUnitOfWorkError) {
          return importFailure('library_session_changed', error.message);
        }
        return importFailure('database_write_failed', 'Source import could not be saved to the library database.');
      } finally {
        if (pendingImportId) {
          pendingImports.clear(pendingImportId);
        }
      }
    },
  };
}

function normalizeTitleOverride(title: string | undefined): string | undefined {
  const trimmedTitle = title?.trim();

  return trimmedTitle ? trimmedTitle : undefined;
}

function listBooks(service: BookService): ContractResponse<'books:list'> {
  try {
    return {
      ok: true,
      data: service.list(),
    };
  } catch (error) {
    if (!(error instanceof BookServiceError)) throw error;
    return {
      ok: false,
      error: createDomainError({
        code: 'LIBRARY_ERROR',
        message: error.message,
        recoverable: true,
        details: { reason: error.reason },
      }),
    };
  }
}

function buildCompletedImportJob(input: {
  readonly createJobId: () => JobId;
  readonly bookId: BreakdownBookId;
  readonly now: string;
}): JobSummary {
  const job: JobSummary = {
    id: input.createJobId(),
    bookId: input.bookId,
    state: 'completed',
    title: 'Import source',
    completedUnits: 1,
    totalUnits: 1,
    checkpointSummary: 'Source imported.',
    failureReason: null,
    updatedAt: input.now,
  };

  return job;
}

function isContentHashUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';

  return code === 'SQLITE_CONSTRAINT_UNIQUE' && (
    message.includes('source_texts.content_hash') ||
    message.includes('idx_source_texts_content_hash')
  );
}

function importFailure(
  reason: string,
  message: string,
  details?: Record<string, unknown>,
): ContractResponse<'books:import-source'> {
  return {
    ok: false,
    error: createDomainError({
      code: 'IMPORT_ERROR',
      message,
      recoverable: true,
      details: {
        reason,
        ...(details ?? {}),
      },
    }),
  } as ContractResponse<'books:import-source'>;
}
