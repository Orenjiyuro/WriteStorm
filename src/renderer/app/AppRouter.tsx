import {
  useEffect,
  useState,
  type ReactElement,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { BookSummary, ContractRequest } from '../../shared/contracts';
import type { DomainError } from '../../shared/errors';
import type { WritestormApi } from '../../shared/contracts/preload-api';
import {
  bookListQueryOptions,
  createImportSourceMutationOptions,
} from '../features/breakdown-shelf/book-queries';
import {
  createSourceImportFailureViewModel,
  type SourceImportFailureAction,
  type SourceImportFailureViewModel,
} from '../features/breakdown-shelf/source-import-failure';
import {
  activateLibrarySession,
  currentLibraryQueryOptions,
} from '../features/library/library-queries';
import { rendererText } from '../i18n';
import {
  BreakdownShelfRoute,
  type LastImportPresentation,
} from '../routes/BreakdownShelfRoute';
import { DiagnosticsRoute } from '../routes/DiagnosticsRoute';
import {
  NoLibraryRoute,
  type LibraryAction,
} from '../routes/NoLibraryRoute';

type AppRoute = 'product' | 'diagnostics';

export function AppRouter(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => readRoute());
  const queryClient = useQueryClient();
  const rendererApi = typeof window === 'undefined' ? null : window.writestorm;
  const queryApi = rendererApi ?? ({} as WritestormApi);
  const currentLibraryQuery = useQuery({
    ...currentLibraryQueryOptions(queryApi),
    enabled: rendererApi !== null,
  });
  const currentLibrary = currentLibraryQuery.data ?? null;
  const booksQuery = useQuery({
    ...bookListQueryOptions(currentLibrary?.sessionId ?? 'no-library-session', queryApi),
    enabled: rendererApi !== null && currentLibrary !== null,
  });
  const importMutation = useMutation(createImportSourceMutationOptions(
    currentLibrary?.sessionId ?? 'no-library-session',
    queryApi,
  ));
  const [pendingLibraryAction, setPendingLibraryAction] = useState<LibraryAction | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<LastImportPresentation | null>(null);
  const [sourceImportFailure, setSourceImportFailure] =
    useState<SourceImportFailureViewModel | null>(null);
  const [openedBook, setOpenedBook] = useState<BookSummary | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateRoute = (): void => setRoute(readRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  if (route === 'diagnostics') return <DiagnosticsRoute />;

  const handleLibraryAction = async (action: LibraryAction): Promise<void> => {
    setPendingLibraryAction(action);
    setLibraryError(null);
    try {
      const response = action === 'create'
        ? await queryApi.library.create()
        : await queryApi.library.open();
      if (response.ok) {
        if (response.data) {
          await activateLibrarySession(queryClient, currentLibrary?.sessionId, response.data);
          setLastImport(null);
          setSourceImportFailure(null);
          setOpenedBook(null);
        }
      } else {
        setLibraryError(response.error.message);
      }
    } catch {
      setLibraryError(rendererText.emptyLibrary.actionError);
    } finally {
      setPendingLibraryAction(null);
    }
  };

  const runSourceImport = async (
    request: ContractRequest<'books:import-source'>,
  ): Promise<void> => {
    setSourceImportFailure(null);
    try {
      const result = await importMutation.mutateAsync(request);
      if (currentLibrary) setLastImport({ sessionId: currentLibrary.sessionId, result });
    } catch (error) {
      setSourceImportFailure(createSourceImportFailureViewModel(isDomainError(error) ? error : {
        code: 'IMPORT_ERROR',
        message: rendererText.sourceImport.actionError,
        recoverable: true,
        details: { reason: 'database_write_failed' },
      }));
    }
  };

  const handleFailureAction = async (action: SourceImportFailureAction): Promise<void> => {
    switch (action.kind) {
      case 'open_library':
        await handleLibraryAction('open');
        return;
      case 'choose_file':
      case 'choose_smaller_file':
      case 'retry_import':
        await runSourceImport({});
        return;
      case 'retry_encoding':
        await runSourceImport({
          pendingImportId: action.pendingImportId,
          encodingOverride: action.encodingOverride,
        });
        return;
      case 'open_existing_book': {
        try {
          const books = booksQuery.data ?? (await booksQuery.refetch()).data ?? [];
          const existingBook = books.find((book) => book.id === action.existingBookId);
          if (!existingBook) {
            setSourceImportFailure(createSourceImportFailureViewModel({
              code: 'IMPORT_ERROR',
              message: rendererText.sourceImport.failure.existingBookNotFound,
              recoverable: true,
              details: { reason: 'database_write_failed' },
            }));
            return;
          }
          setOpenedBook(existingBook);
          setSourceImportFailure(null);
        } catch {
          setSourceImportFailure(createSourceImportFailureViewModel({
            code: 'IMPORT_ERROR',
            message: rendererText.sourceImport.actionError,
            recoverable: true,
            details: { reason: 'database_write_failed' },
          }));
        }
      }
    }
  };

  return currentLibrary ? (
    <BreakdownShelfRoute
      library={currentLibrary}
      books={booksQuery.data ?? []}
      importPending={importMutation.isPending}
      lastImport={lastImport}
      failure={sourceImportFailure}
      openedBook={openedBook}
      onImport={() => void runSourceImport({})}
      onFailureAction={(action) => void handleFailureAction(action)}
    />
  ) : (
    <NoLibraryRoute
      pendingAction={pendingLibraryAction}
      error={libraryError ?? getQueryErrorMessage(currentLibraryQuery.error)}
      onAction={(action) => void handleLibraryAction(action)}
    />
  );
}

function readRoute(): AppRoute {
  return resolveAppRoute(typeof window === 'undefined' ? '' : window.location.hash);
}

export function resolveAppRoute(hash: string): AppRoute {
  return hash === '#/diagnostics' ? 'diagnostics' : 'product';
}

function getQueryErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function isDomainError(error: unknown): error is DomainError {
  return typeof error === 'object' && error !== null &&
    'code' in error && 'message' in error && 'recoverable' in error;
}
