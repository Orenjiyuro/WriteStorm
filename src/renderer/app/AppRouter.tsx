import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { BookSummary, ContractRequest } from '../../shared/contracts';
import type { JobId } from '../../shared/domain';
import type { DomainError } from '../../shared/errors';
import type { WritestormApi } from '../../shared/contracts/preload-api';
import {
  bookListQueryOptions,
  createImportSourceMutationOptions,
} from '../features/breakdown-shelf/book-queries';
import {
  createStructureActionMutationOptions,
  structureWorkspaceQueryOptions,
} from '../features/structure-review/structure-queries';
import { moduleInstancesQueryOptions } from '../features/module-workbench/module-instance-queries';
import {
  createCancelJobMutationOptions,
  jobDetailQueryOptions,
  jobListQueryOptions,
} from '../features/job-recovery/job-queries';
import {
  exportStatusQueryOptions,
} from '../features/export-status/export-status-queries';
import {
  createSourceImportFailureViewModel,
  type SourceImportFailureAction,
  type SourceImportFailureViewModel,
} from '../features/breakdown-shelf/source-import-failure';
import {
  activateLibrarySession,
  currentLibraryQueryOptions,
  libraryKeys,
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
import {
  ProductNavigation,
  type ProductRoute,
} from '../components/ProductNavigation';
import { TechniqueLibraryRoute } from '../routes/TechniqueLibraryRoute';
import { OriginalShelfRoute } from '../routes/OriginalShelfRoute';
import { SettingsRoute } from '../routes/SettingsRoute';
import {
  createTypeLibraryBindingMutationOptions,
  isTypeLibraryRevisionConflict,
  typeLibraryBindingQueryOptions,
  typeLibraryOptionsQueryOptions,
} from '../features/type-library/type-library-queries';
import type { TypeLibrarySelectionValue } from '../features/type-library/TypeLibraryBindingEditor';

export type AppRoute = ProductRoute | 'diagnostics';

export type AppRouterProps = {
  readonly api?: WritestormApi | null;
};

export function AppRouter(props: AppRouterProps = {}): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => readRoute());
  const queryClient = useQueryClient();
  const rendererApi = props.api === undefined
    ? (typeof window === 'undefined' ? null : window.writestorm)
    : props.api;
  const queryApi = rendererApi ?? ({} as WritestormApi);
  const currentLibraryQuery = useQuery({
    ...currentLibraryQueryOptions(queryApi),
    enabled: rendererApi !== null,
  });
  const currentLibrary = currentLibraryQuery.data ?? null;
  const committedLibrarySessionId = useRef<string | null>(null);
  useEffect(() => {
    const previousSessionId = committedLibrarySessionId.current;
    const nextSessionId = currentLibrary?.sessionId ?? null;
    if (previousSessionId && previousSessionId !== nextSessionId) {
      queryClient.removeQueries({ queryKey: libraryKeys.session(previousSessionId) });
    }
    committedLibrarySessionId.current = nextSessionId;
  }, [currentLibrary?.sessionId, queryClient]);
  const breakdownQueriesEnabled =
    route === 'breakdown' && rendererApi !== null && currentLibrary !== null;
  const booksQuery = useQuery({
    ...bookListQueryOptions(currentLibrary?.sessionId ?? 'no-library-session', queryApi),
    enabled: breakdownQueriesEnabled,
  });
  const importMutation = useMutation(createImportSourceMutationOptions(
    currentLibrary?.sessionId ?? 'no-library-session',
    queryApi,
  ));
  const typeLibraryOptionsQuery = useQuery({
    ...typeLibraryOptionsQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      queryApi,
    ),
    enabled: breakdownQueriesEnabled,
  });
  const jobsQuery = useQuery({
    ...jobListQueryOptions(currentLibrary?.sessionId ?? 'no-library-session', queryApi),
    enabled: breakdownQueriesEnabled,
  });
  const [selectedJobId, setSelectedJobId] = useState<JobId | null>(null);
  useEffect(() => {
    const jobs = jobsQuery.data;
    if (!currentLibrary || !jobs) {
      setSelectedJobId(null);
      return;
    }
    setSelectedJobId((selected) => selected && jobs.some((job) => job.id === selected)
      ? selected
      : jobs[0]?.id ?? null);
  }, [currentLibrary?.sessionId, jobsQuery.data]);
  const jobDetailQuery = useQuery({
    ...jobDetailQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      selectedJobId ?? ('00000000-0000-4000-8000-000000000000' as JobId),
      queryApi,
    ),
    enabled: breakdownQueriesEnabled && selectedJobId !== null,
  });
  const cancelJobMutation = useMutation(createCancelJobMutationOptions(
    currentLibrary?.sessionId ?? 'no-library-session',
    queryApi,
  ));
  const [pendingLibraryAction, setPendingLibraryAction] = useState<LibraryAction | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<LastImportPresentation | null>(null);
  const [sourceImportFailure, setSourceImportFailure] =
    useState<SourceImportFailureViewModel | null>(null);
  const [openedBook, setOpenedBook] = useState<BookSummary | null>(null);
  const [importTypeSelection, setImportTypeSelection] =
    useState<TypeLibrarySelectionValue>(EMPTY_TYPE_SELECTION);
  const [openedBookTypeSelection, setOpenedBookTypeSelection] =
    useState<TypeLibrarySelectionValue>(EMPTY_TYPE_SELECTION);
  const [openedBookTypeSelectionDirty, setOpenedBookTypeSelectionDirty] = useState(false);
  const [openedBookBindingConflict, setOpenedBookBindingConflict] = useState(false);
  useEffect(() => {
    setLastImport(null);
    setSourceImportFailure(null);
    setOpenedBook(null);
    setSelectedJobId(null);
    setImportTypeSelection(EMPTY_TYPE_SELECTION);
    setOpenedBookTypeSelection(EMPTY_TYPE_SELECTION);
    setOpenedBookTypeSelectionDirty(false);
    setOpenedBookBindingConflict(false);
  }, [currentLibrary?.sessionId]);
  useEffect(() => {
    if (!openedBook || !booksQuery.data) return;
    const refreshed = booksQuery.data.find((book) => book.id === openedBook.id);
    if (refreshed) setOpenedBook(refreshed);
  }, [booksQuery.data, openedBook?.id]);
  const typeLibraryBindingQuery = useQuery({
    ...typeLibraryBindingQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      openedBook?.id ?? ('00000000-0000-4000-8000-000000000000' as BookSummary['id']),
      queryApi,
    ),
    enabled: breakdownQueriesEnabled && openedBook !== null,
  });
  const boundTypeLibraryOptionsQuery = useQuery({
    ...typeLibraryOptionsQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      queryApi,
      typeLibraryBindingQuery.data?.binding.typeLibraryVersion,
    ),
    enabled: breakdownQueriesEnabled && openedBook !== null &&
      typeLibraryBindingQuery.data !== null && typeLibraryBindingQuery.data !== undefined,
  });
  const typeLibraryBindingMutation = useMutation(createTypeLibraryBindingMutationOptions(
    currentLibrary?.sessionId ?? 'no-library-session',
    queryApi,
  ));
  useEffect(() => {
    setOpenedBookTypeSelectionDirty(false);
    setOpenedBookBindingConflict(false);
    typeLibraryBindingMutation.reset();
  }, [openedBook?.id]);
  useEffect(() => {
    if (openedBookTypeSelectionDirty) return;
    const binding = typeLibraryBindingQuery.data?.binding;
    setOpenedBookTypeSelection(toTypeLibrarySelection(binding));
  }, [openedBook?.id, openedBookTypeSelectionDirty, typeLibraryBindingQuery.data]);
  const structureWorkspaceQuery = useQuery({
    ...structureWorkspaceQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      openedBook?.id ?? ('00000000-0000-4000-8000-000000000000' as BookSummary['id']),
      queryApi,
    ),
    enabled: breakdownQueriesEnabled && openedBook !== null,
  });
  const structureActionMutation = useMutation(createStructureActionMutationOptions(
    currentLibrary?.sessionId ?? 'no-library-session',
    openedBook?.id ?? ('00000000-0000-4000-8000-000000000000' as BookSummary['id']),
    queryApi,
  ));
  const moduleInstancesQuery = useQuery({
    ...moduleInstancesQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      openedBook?.id ?? ('00000000-0000-4000-8000-000000000000' as BookSummary['id']),
      queryApi,
    ),
    enabled: breakdownQueriesEnabled && openedBook !== null &&
      structureWorkspaceQuery.data?.frozen !== null &&
      structureWorkspaceQuery.data?.frozen !== undefined,
  });
  const exportStatusQuery = useQuery({
    ...exportStatusQueryOptions(
      currentLibrary?.sessionId ?? 'no-library-session',
      openedBook?.id ?? ('00000000-0000-4000-8000-000000000000' as BookSummary['id']),
      queryApi,
    ),
    enabled: breakdownQueriesEnabled && openedBook !== null,
  });

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
      setImportTypeSelection(EMPTY_TYPE_SELECTION);
      if (currentLibrary) {
        setLastImport({ sessionId: currentLibrary.sessionId, result });
        setOpenedBook(result.book);
      }
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
    const retryRequest = createFailureActionImportRequest(
      action,
      importTypeSelection,
      typeLibraryOptionsQuery.data?.version,
    );
    if (retryRequest !== null) {
      await runSourceImport(retryRequest);
      return;
    }

    switch (action.kind) {
      case 'open_library':
        await handleLibraryAction('open');
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

  return (
    <div className="product-frame">
      <ProductNavigation activeRoute={route} />
      {route === 'settings' ? (
        <SettingsRoute />
      ) : currentLibrary && route === 'techniques' ? (
        <TechniqueLibraryRoute library={currentLibrary} />
      ) : currentLibrary && route === 'originals' ? (
        <OriginalShelfRoute library={currentLibrary} />
      ) : currentLibrary ? (
        <BreakdownShelfRoute
          library={currentLibrary}
          books={booksQuery.data ?? []}
          importPending={importMutation.isPending}
          lastImport={lastImport}
          failure={sourceImportFailure}
          openedBook={openedBook}
          exportStatus={exportStatusQuery.data ?? null}
          exportStatusLoading={exportStatusQuery.isLoading}
          exportStatusError={getQueryErrorMessage(exportStatusQuery.error)}
          structureWorkspace={structureWorkspaceQuery.data ?? null}
          structureLoading={structureWorkspaceQuery.isLoading}
          structureActionPending={structureActionMutation.isPending}
          structureError={getQueryErrorMessage(
            structureWorkspaceQuery.error ?? structureActionMutation.error,
          )}
          moduleInstances={moduleInstancesQuery.data}
          moduleInstancesLoading={moduleInstancesQuery.isLoading}
          moduleInstancesError={getQueryErrorMessage(moduleInstancesQuery.error)}
          jobRecovery={{
            jobs: jobsQuery.data ?? [],
            exportReadiness: openedBook ? {
              bookTitle: openedBook.title,
              status: exportStatusQuery.data ?? null,
              loading: exportStatusQuery.isLoading,
              error: getQueryErrorMessage(exportStatusQuery.error),
            } : null,
            selectedJobId,
            detail: jobDetailQuery.data ?? null,
            loading: jobsQuery.isLoading,
            detailLoading: jobDetailQuery.isLoading,
            error: getQueryErrorMessage(
              jobsQuery.error ?? jobDetailQuery.error ?? cancelJobMutation.error,
            ),
            cancelPending:
              cancelJobMutation.isPending && cancelJobMutation.variables === selectedJobId,
            onSelectJob: (jobId) => {
              cancelJobMutation.reset();
              setSelectedJobId(jobId);
            },
            onCancelJob: (jobId) => cancelJobMutation.mutate(jobId),
          }}
          typeLibrary={{
            options: typeLibraryOptionsQuery.data ?? null,
            optionsError: getQueryErrorMessage(typeLibraryOptionsQuery.error),
            importSelection: importTypeSelection,
            openedBookSelection: openedBookTypeSelection,
            openedBookOptions: boundTypeLibraryOptionsQuery.data ?? null,
            openedBookPinnedOptions: typeLibraryBindingQuery.data?.pinnedOptions ?? [],
            bindingPending: typeLibraryBindingQuery.isLoading ||
              typeLibraryBindingQuery.isFetching || boundTypeLibraryOptionsQuery.isLoading ||
              boundTypeLibraryOptionsQuery.isFetching || typeLibraryBindingMutation.isPending,
            bindingError: getQueryErrorMessage(
              typeLibraryBindingQuery.error ?? boundTypeLibraryOptionsQuery.error ??
                (openedBookBindingConflict ? null : typeLibraryBindingMutation.error),
            ),
            bindingConflict: openedBookBindingConflict,
            onImportSelectionChange: setImportTypeSelection,
            onOpenedBookSelectionChange: (selection) => {
              typeLibraryBindingMutation.reset();
              setOpenedBookTypeSelectionDirty(true);
              setOpenedBookTypeSelection(selection);
            },
            onSaveOpenedBookBinding: () => {
              const release = boundTypeLibraryOptionsQuery.data;
              const binding = typeLibraryBindingQuery.data?.binding;
              if (!openedBook || !release || !binding) return;
              typeLibraryBindingMutation.mutate({
                bookId: openedBook.id,
                expectedRevision: binding.revision,
                typeLibraryVersion: release.version,
                mainType: openedBookTypeSelection.mainType,
                contentFocuses: [...openedBookTypeSelection.contentFocuses],
              }, {
                onSuccess: () => {
                  setOpenedBookTypeSelectionDirty(false);
                  setOpenedBookBindingConflict(false);
                },
                onError: (error) => {
                  if (isTypeLibraryRevisionConflict(error)) {
                    setOpenedBookBindingConflict(true);
                  }
                },
              });
            },
            onLoadLatestBookBinding: () => {
              setOpenedBookTypeSelection(toTypeLibrarySelection(
                typeLibraryBindingQuery.data?.binding,
              ));
              setOpenedBookTypeSelectionDirty(false);
              setOpenedBookBindingConflict(false);
              typeLibraryBindingMutation.reset();
            },
          }}
          onImport={(selection) => void runSourceImport(
            createImportRequest(selection, typeLibraryOptionsQuery.data?.version),
          )}
          onOpenBook={(book) => {
            setOpenedBookTypeSelectionDirty(false);
            setOpenedBookBindingConflict(false);
            typeLibraryBindingMutation.reset();
            setOpenedBook(book);
          }}
          onDetectStructure={() => structureActionMutation.mutate({ type: 'detect' })}
          onRecoverStructureDetection={() =>
            structureActionMutation.mutate({ type: 'recover-detection' })}
          onCreateStructureDraft={(replacementFrozenSetId) => {
            const candidate = structureWorkspaceQuery.data?.candidate;
            if (candidate) structureActionMutation.mutate({
              type: 'create-draft',
              candidateSetId: candidate.id,
              ...(replacementFrozenSetId === undefined ? {} : { replacementFrozenSetId }),
            });
          }}
          onCreateManualStructureDraft={() => {
            const run = structureWorkspaceQuery.data?.latestDetectionRun;
            if (run?.state === 'failed') structureActionMutation.mutate({
              type: 'create-manual-draft', expectedFailedDetectionRunId: run.id,
            });
          }}
          onUpdateStructureNode={(command) => {
            const draft = structureWorkspaceQuery.data?.draft;
            if (draft) structureActionMutation.mutate({
              type: 'update-node',
              draftSetId: draft.id,
              expectedDraftRevision: draft.draftRevision,
              command,
            });
          }}
          onUpdateStructureRange={(command) => {
            const draft = structureWorkspaceQuery.data?.draft;
            if (draft) structureActionMutation.mutate({
              type: 'update-range',
              draftSetId: draft.id,
              expectedDraftRevision: draft.draftRevision,
              command,
            });
          }}
          onDiscardStructureDraft={() => {
            const draft = structureWorkspaceQuery.data?.draft;
            if (draft) structureActionMutation.mutate({
              type: 'discard-draft',
              draftSetId: draft.id,
              expectedDraftRevision: draft.draftRevision,
            });
          }}
          onFreezeStructure={() => {
            const draft = structureWorkspaceQuery.data?.draft;
            if (draft) structureActionMutation.mutate({
              type: 'freeze',
              draftSetId: draft.id,
              expectedDraftRevision: draft.draftRevision,
            });
          }}
          onUnfreezeStructure={() => {
            const frozen = structureWorkspaceQuery.data?.frozen;
            if (frozen) structureActionMutation.mutate({
              type: 'unfreeze',
              frozenSetId: frozen.id,
            });
          }}
          onFailureAction={(action) => void handleFailureAction(action)}
        />
      ) : (
        <NoLibraryRoute
          pendingAction={pendingLibraryAction}
          error={libraryError ?? getQueryErrorMessage(currentLibraryQuery.error)}
          onAction={(action) => void handleLibraryAction(action)}
        />
      )}
    </div>
  );
}

function readRoute(): AppRoute {
  return resolveAppRoute(typeof window === 'undefined' ? '' : window.location.hash);
}

export function resolveAppRoute(hash: string): AppRoute {
  if (hash === '#/diagnostics') return 'diagnostics';
  if (hash === '#/techniques') return 'techniques';
  if (hash === '#/originals') return 'originals';
  if (hash === '#/settings') return 'settings';
  return 'breakdown';
}

export function getQueryErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null || !('message' in error) ||
    typeof error.message !== 'string') return null;
  const blockers = 'details' in error && typeof error.details === 'object' && error.details !== null &&
    'blockers' in error.details && Array.isArray(error.details.blockers)
    ? error.details.blockers.filter((value): value is string => typeof value === 'string') : [];
  return blockers.length > 0 ? `${error.message} (${blockers.join(', ')})` : error.message;
}

function isDomainError(error: unknown): error is DomainError {
  return typeof error === 'object' && error !== null &&
    'code' in error && 'message' in error && 'recoverable' in error;
}

const EMPTY_TYPE_SELECTION: TypeLibrarySelectionValue = {
  mainType: null,
  contentFocuses: [],
};

function toTypeLibrarySelection(
  binding: import('../../shared/domain').BookTypeBindingRead | null | undefined,
): TypeLibrarySelectionValue {
  return binding ? {
    mainType: binding.mainType,
    contentFocuses: binding.contentFocuses.map(({ priority: _priority, ...focus }) => focus),
  } : EMPTY_TYPE_SELECTION;
}

function createImportRequest(
  selection: TypeLibrarySelectionValue | undefined,
  typeLibraryVersion: number | undefined,
): ContractRequest<'books:import-source'> {
  if (!selection || typeLibraryVersion === undefined ||
    (selection.mainType === null && selection.contentFocuses.length === 0)) {
    return {};
  }
  return {
    typeBinding: {
      typeLibraryVersion,
      mainType: selection.mainType,
      contentFocuses: [...selection.contentFocuses],
    },
  };
}

export function createFailureActionImportRequest(
  action: SourceImportFailureAction,
  retainedSelection: TypeLibrarySelectionValue,
  currentTypeLibraryVersion: number | undefined,
): ContractRequest<'books:import-source'> | null {
  switch (action.kind) {
    case 'choose_file':
    case 'choose_smaller_file':
    case 'retry_import':
      return createImportRequest(retainedSelection, currentTypeLibraryVersion);
    case 'retry_encoding':
      return {
        pendingImportId: action.pendingImportId,
        encodingOverride: action.encodingOverride,
      };
    case 'open_library':
    case 'open_existing_book':
      return null;
  }
}
