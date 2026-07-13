import type { ContractRequest, ContractResponse } from '../../shared/contracts';
import { createDomainError } from '../../shared/errors';
import { BookServiceError, type BookService } from './book-service';
import {
  selectImportSourceFile,
  type ImportFileDialogOptions,
  type ImportFileDialogResult,
} from './book-import-entry';
import type {
  SourceImportService,
  SourceImportServiceResult,
} from '../source-text/source-import-service';

export type BookImportIpcDependencies = {
  readonly list: () => ContractResponse<'books:list'>;
  readonly clearPendingImports: () => void;
  readonly invalidateWindowSelections: () => void;
  readonly importSource: (
    request: ContractRequest<'books:import-source'>,
  ) => Promise<ContractResponse<'books:import-source'>>;
};

export type BookImportIpcOptions = {
  readonly books: Pick<BookService, 'list'>;
  readonly sourceImport: Pick<SourceImportService, 'import' | 'clearPendingImports'>;
  readonly getCurrentSession: () => { readonly sessionId: string } | null;
  readonly env?: Record<string, string | undefined>;
  readonly showOpenDialog: (
    options: ImportFileDialogOptions,
  ) => Promise<ImportFileDialogResult>;
};

export function createBookImportIpcDependencies(
  options: BookImportIpcOptions,
): BookImportIpcDependencies {
  let windowGeneration = 0;
  return {
    list: () => listBooks(options.books),
    clearPendingImports: () => options.sourceImport.clearPendingImports(),
    invalidateWindowSelections: () => { windowGeneration += 1; },
    importSource: async (request) => {
      const invocationWindowGeneration = windowGeneration;
      const current = options.getCurrentSession();
      if (!current) {
        return importFailure(
          'no_current_library',
          'Open or create a library before importing source text.',
        );
      }

      if ('pendingImportId' in request) {
        return mapImportResult(await options.sourceImport.import({
          pendingImportId: request.pendingImportId,
          encodingOverride: request.encodingOverride,
          expectedSessionId: current.sessionId,
        }));
      }

      const sourcePath = await selectImportSourceFile({
        env: options.env,
        showOpenDialog: options.showOpenDialog,
      });
      if (!sourcePath) {
        return importFailure('dialog_cancelled', 'Source import was cancelled.');
      }
      if (invocationWindowGeneration !== windowGeneration) {
        return importFailure(
          'library_session_changed',
          'The application window changed while choosing a source file.',
        );
      }

      return mapImportResult(await options.sourceImport.import({
        sourcePath,
        title: request.title,
        expectedSessionId: current.sessionId,
      }));
    },
  };
}

function listBooks(books: Pick<BookService, 'list'>): ContractResponse<'books:list'> {
  try {
    return { ok: true, data: books.list() };
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

function mapImportResult(
  result: SourceImportServiceResult,
): ContractResponse<'books:import-source'> {
  if (result.ok) return result;
  return importFailure(
    String(result.error.details.reason),
    result.error.message,
    result.error.details,
  );
}

function importFailure(
  reason: string,
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): ContractResponse<'books:import-source'> {
  return {
    ok: false,
    error: createDomainError({
      code: 'IMPORT_ERROR',
      message,
      recoverable: true,
      details: { ...details, reason },
    }),
  } as ContractResponse<'books:import-source'>;
}
