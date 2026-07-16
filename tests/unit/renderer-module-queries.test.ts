import { QueryClient } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type {
  ContractResponse,
  LibrarySessionSummary,
  ModuleInstanceSummary,
} from '../../src/shared/contracts';
import type { WritestormApi } from '../../src/shared/contracts/preload-api';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  LibraryId,
  StructureSetId,
} from '../../src/shared/domain';
import { activateLibrarySession } from '../../src/renderer/features/library/library-queries';
import {
  moduleInstanceKeys,
  moduleInstancesQueryOptions,
} from '../../src/renderer/features/module-workbench/module-instance-queries';
import {
  exportStatusKeys,
} from '../../src/renderer/features/export-status/export-status-queries';
import {
  createStructureActionMutationOptions,
  structureKeys,
} from '../../src/renderer/features/structure-review/structure-queries';

const sessionA = 'session-module-a';
const sessionB = 'session-module-b';
const bookId = 'book-module-query' as BreakdownBookId;
const instanceA = moduleInstance('instance-a', 'world_rules');
const instanceB = moduleInstance('instance-b', 'plot_causality');
const libraryB: LibrarySessionSummary = {
  sessionId: sessionB,
  library: {
    id: 'library-module-b' as LibraryId,
    name: 'Module B',
    rootPath: 'C:\\Libraries\\ModuleB',
    schemaVersion: 5,
    appVersion: '0.1.0-test',
  },
};

describe('renderer module instance queries', () => {
  it('keys and reads module instances by both Library sessionId and bookId', async () => {
    const queryClient = createQueryClient();
    const listInstances = vi.fn(async (): Promise<ContractResponse<'modules:list-instances'>> => ({
      ok: true,
      data: [instanceB],
    }));

    await expect(queryClient.fetchQuery(moduleInstancesQueryOptions(
      sessionB,
      bookId,
      {
        modules: {
          listInstances,
          updateBody: async () => { throw new Error('not configured'); },
        },
      },
    ))).resolves.toEqual([instanceB]);

    expect(moduleInstanceKeys.instances(sessionB, bookId)).toEqual([
      'library-session', sessionB, 'module-instances', bookId,
    ]);
    expect(listInstances).toHaveBeenCalledWith({ bookId });
  });

  it('invalidates structure and module instances together after a successful freeze', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const api = structureApi({
      freeze: async () => ({ ok: true, data: { bookId, structureEdition: 1 } }),
    });
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createStructureActionMutationOptions(sessionB, bookId, api),
    );

    await mutation.execute({
      type: 'freeze',
      draftSetId: 'draft-module-query' as StructureSetId,
      expectedDraftRevision: 1,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: structureKeys.workspace(sessionB, bookId),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: moduleInstanceKeys.instances(sessionB, bookId),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: exportStatusKeys.status(sessionB, bookId),
    });
  });

  it('does not invalidate module instances when freeze fails', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const api = structureApi({
      freeze: async () => ({
        ok: false,
        error: {
          code: 'STRUCTURE_ERROR',
          message: 'Freeze failed.',
          recoverable: true,
          details: { reason: 'draft_revision_mismatch' },
        },
      }),
    });
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createStructureActionMutationOptions(sessionB, bookId, api),
    );

    await expect(mutation.execute({
      type: 'freeze',
      draftSetId: 'draft-module-query' as StructureSetId,
      expectedDraftRevision: 1,
    })).rejects.toMatchObject({ code: 'STRUCTURE_ERROR' });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: structureKeys.workspace(sessionB, bookId),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: moduleInstanceKeys.instances(sessionB, bookId),
    });
  });

  it('refreshes Export readiness after unfreeze without touching module instances', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createStructureActionMutationOptions(sessionB, bookId, structureApi({
        unfreeze: async () => ({
          ok: true,
          data: {
            id: 'draft-after-unfreeze',
          } as never,
        }),
      })),
    );

    await mutation.execute({
      type: 'unfreeze',
      frozenSetId: 'frozen-module-query' as StructureSetId,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: exportStatusKeys.status(sessionB, bookId),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: moduleInstanceKeys.instances(sessionB, bookId),
    });
  });

  it('removes the old session module cache before the next Library can display instances', async () => {
    const queryClient = createQueryClient();
    const oldSevenInstances = Array.from({ length: 7 }, (_, index) => ({
      ...instanceA,
      id: `old-library-instance-${index}` as AnalysisModuleInstanceId,
    }));
    queryClient.setQueryData(moduleInstanceKeys.instances(sessionA, bookId), oldSevenInstances);

    expect(queryClient.getQueryData(moduleInstanceKeys.instances(sessionA, bookId)))
      .toHaveLength(7);

    await activateLibrarySession(queryClient, sessionA, libraryB);

    expect(queryClient.getQueryData(moduleInstanceKeys.instances(sessionA, bookId))).toBeUndefined();
    expect(queryClient.getQueryData(moduleInstanceKeys.instances(sessionB, bookId))).toBeUndefined();
  });

  it('connects the module query result to the frozen Breakdown shelf workbench', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(source).toContain('moduleInstancesQueryOptions(');
    expect(source).toContain('currentLibrary?.sessionId');
    expect(source).toContain('openedBook?.id');
    expect(source).toContain('moduleInstances={moduleInstancesQuery.data}');
  });
});

function moduleInstance(id: string, moduleId: string): ModuleInstanceSummary {
  return {
    id: id as AnalysisModuleInstanceId,
    bookId,
    moduleId: moduleId as AnalysisModuleId,
    scope: { kind: 'book', bookId },
    status: 'not_generated',
    structureEdition: 1,
    analysisRevision: 0,
    updatedAt: '2026-07-15T16:00:00.000Z',
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

function structureApi(
  overrides: Partial<WritestormApi['structure']>,
): Pick<WritestormApi, 'structure'> {
  const unavailable = async () => { throw new Error('not configured'); };
  return {
    structure: {
      get: unavailable,
      detect: unavailable,
      recoverDetection: unavailable,
      createDraft: unavailable,
      createManualDraft: unavailable,
      discardDraft: unavailable,
      updateNode: unavailable,
      updateStoryRange: unavailable,
      freeze: overrides.freeze ?? unavailable,
      unfreeze: overrides.unfreeze ?? unavailable,
    },
  };
}
