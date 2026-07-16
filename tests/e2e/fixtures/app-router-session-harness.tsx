import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { AppRouter } from '../../../src/renderer/app/AppRouter';
import { activateLibrarySession } from '../../../src/renderer/features/library/library-queries';
import { moduleInstanceKeys } from '../../../src/renderer/features/module-workbench/module-instance-queries';
import type {
  BookSummary,
  LibrarySessionSummary,
  ModuleInstanceSummary,
} from '../../../src/shared/contracts';
import type { WritestormApi } from '../../../src/shared/contracts/preload-api';
import type { StructureWorkspace } from '../../../src/shared/contracts/structure';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  type AnalysisModuleInstanceId,
  type BreakdownBookId,
  type LibraryId,
  type StructureSetId,
} from '../../../src/shared/domain';

const bookId = 'book-app-router-session' as BreakdownBookId;
const libraryA = librarySession('session-app-router-a', 'Library A', 'library-a');
const libraryB = librarySession('session-app-router-b', 'Library B', 'library-b');
const bookA = book('Session A book', libraryA.library.id);
const bookB = book('Session B book', libraryB.library.id);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { retry: false },
  },
});
let activeLibrary = libraryA;

const unavailable = async (): Promise<never> => {
  throw new Error('The AppRouter session harness does not configure this operation.');
};
const api = {
  library: {
    create: unavailable,
    open: unavailable,
    getCurrent: async () => ({ ok: true as const, data: activeLibrary }),
  },
  books: {
    list: async () => ({
      ok: true as const,
      data: [activeLibrary.sessionId === libraryA.sessionId ? bookA : bookB],
    }),
    importSource: unavailable,
  },
  structure: {
    get: async () => ({ ok: true as const, data: frozenWorkspace() }),
    detect: unavailable,
    recoverDetection: unavailable,
    createDraft: unavailable,
    createManualDraft: unavailable,
    discardDraft: unavailable,
    updateNode: unavailable,
    updateStoryRange: unavailable,
    freeze: unavailable,
    unfreeze: unavailable,
  },
  modules: {
    listInstances: async () => ({
      ok: true as const,
      data: moduleInstances(
        activeLibrary.sessionId === libraryA.sessionId ? 'not_generated' : 'needs_rebuild',
        activeLibrary.sessionId === libraryA.sessionId ? 'a' : 'b',
      ),
    }),
    updateBody: unavailable,
  },
  jobs: { list: unavailable, get: unavailable, cancel: unavailable },
  exports: { getStatus: unavailable },
} as unknown as WritestormApi;

Object.assign(window, {
  __switchAppRouterLibrary: async (): Promise<void> => {
    const previousSessionId = activeLibrary.sessionId;
    activeLibrary = libraryB;
    await activateLibrarySession(queryClient, previousSessionId, libraryB);
  },
  __hasAppRouterSessionACache: (): boolean => queryClient.getQueryData(
    moduleInstanceKeys.instances(libraryA.sessionId, bookId),
  ) !== undefined,
});

createRoot(document.getElementById('app-router-session-root')!).render(
  <QueryClientProvider client={queryClient}>
    <AppRouter api={api} />
  </QueryClientProvider>,
);

function librarySession(
  sessionId: string,
  name: string,
  libraryId: string,
): LibrarySessionSummary {
  return {
    sessionId,
    library: {
      id: libraryId as LibraryId,
      name,
      rootPath: `C:\\Libraries\\${name.replace(' ', '')}`,
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
  };
}

function book(title: string, libraryId: LibraryId): BookSummary {
  return {
    id: bookId,
    libraryId,
    title,
    sourceTextId: null,
    sourceTextEdition: 1,
    structureEdition: 1,
    updatedAt: '2026-07-16T00:00:00.000Z',
  };
}

function frozenWorkspace(): StructureWorkspace {
  return {
    bookId,
    latestDetectionRun: null,
    candidate: null,
    draft: null,
    frozen: {
      id: 'frozen-app-router-session' as StructureSetId,
      structureEdition: 1,
      nodes: [],
      storyRanges: [],
    },
    capabilities: {
      canDetect: false,
      canRecoverDetection: false,
      canCreateDraft: false,
      canCreateReplacementDraft: false,
      canCreateManualDraft: false,
      canEditDraft: false,
      canDiscardDraft: false,
      canFreeze: false,
      canUnfreeze: true,
      blockers: [],
    },
  } as unknown as StructureWorkspace;
}

function moduleInstances(
  status: ModuleInstanceSummary['status'],
  marker: string,
): ModuleInstanceSummary[] {
  return ANALYSIS_MODULE_DEFINITIONS.map((definition, index) => ({
    id: `app-router-${marker}-instance-${index}` as AnalysisModuleInstanceId,
    bookId,
    moduleId: definition.id,
    scope: { kind: 'book', bookId },
    status,
    structureEdition: 1,
    analysisRevision: 0,
    updatedAt: '2026-07-16T00:00:00.000Z',
  }));
}
