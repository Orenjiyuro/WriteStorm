import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  createTypeLibraryBindingMutationOptions,
  typeLibraryBindingQueryOptions,
  typeLibraryKeys,
  typeLibraryOptionsQueryOptions,
} from '../../src/renderer/features/type-library/type-library-queries';
import { bookKeys } from '../../src/renderer/features/breakdown-shelf/book-queries';
import type { ContractResponse, WritestormApi } from '../../src/shared/contracts';
import type { BreakdownBookId } from '../../src/shared/domain';

const sessionId = 'type-library-session';
const bookId = 'type-library-book' as BreakdownBookId;

describe('renderer TypeLibrary queries', () => {
  it('scopes options and Book binding reads to the current Library session', async () => {
    const queryClient = createQueryClient();
    const listOptions = vi.fn(async (): Promise<ContractResponse<'type-library:list-options'>> => ({
      ok: true,
      data: { version: 1, options: [] } as never,
    }));
    const getBookBinding = vi.fn(async (): Promise<ContractResponse<'type-library:get-book-binding'>> => ({
      ok: true,
      data: null,
    }));
    const api = typeLibraryApi({ listOptions, getBookBinding });

    await queryClient.fetchQuery(typeLibraryOptionsQueryOptions(sessionId, api));
    await queryClient.fetchQuery(typeLibraryBindingQueryOptions(sessionId, bookId, api));

    expect(typeLibraryKeys.options(sessionId)).toEqual([
      'library-session', sessionId, 'type-library', 'options', 'latest',
    ]);
    expect(typeLibraryKeys.binding(sessionId, bookId)).toEqual([
      'library-session', sessionId, 'type-library', 'book', bookId,
    ]);
    expect(listOptions).toHaveBeenCalledWith({});
    expect(getBookBinding).toHaveBeenCalledWith({ bookId });

    await queryClient.fetchQuery(typeLibraryOptionsQueryOptions(sessionId, api, 1));
    expect(typeLibraryKeys.options(sessionId, 1)).toEqual([
      'library-session', sessionId, 'type-library', 'options', 1,
    ]);
    expect(listOptions).toHaveBeenLastCalledWith({ version: 1 });
  });

  it('invalidates the binding detail and display-only Book list after CAS update', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const updateBookBinding = vi.fn(async (): Promise<ContractResponse<'type-library:update-book-binding'>> => ({
      ok: true,
      data: {
        bookId,
        typeLibraryVersion: 1,
        revision: 1,
        mainType: null,
        contentFocuses: [],
        updatedAt: '2026-07-17T00:00:00.000Z',
      },
    }));
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createTypeLibraryBindingMutationOptions(sessionId, typeLibraryApi({ updateBookBinding })),
    );

    await mutation.execute({
      bookId,
      expectedRevision: 0,
      typeLibraryVersion: 1,
      mainType: null,
      contentFocuses: [],
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: typeLibraryKeys.binding(sessionId, bookId),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: bookKeys.all(sessionId) });
    expect(queryClient.getQueryData(typeLibraryKeys.binding(sessionId, bookId))).toBeUndefined();
  });

  it('refreshes the latest binding after a revision conflict without invalidating Books', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const conflict = {
      code: 'TYPE_LIBRARY_ERROR' as const,
      message: 'The Book classification changed in another session.',
      recoverable: true,
      details: { reason: 'revision_conflict' },
    };
    const updateBookBinding = vi.fn(
      async (): Promise<ContractResponse<'type-library:update-book-binding'>> => ({
        ok: false,
        error: conflict,
      }),
    );
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createTypeLibraryBindingMutationOptions(sessionId, typeLibraryApi({ updateBookBinding })),
    );

    await expect(mutation.execute({
      bookId,
      expectedRevision: 1,
      typeLibraryVersion: 1,
      mainType: null,
      contentFocuses: [],
    })).rejects.toEqual(conflict);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: typeLibraryKeys.binding(sessionId, bookId),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: bookKeys.all(sessionId) });
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

function typeLibraryApi(
  overrides: Partial<WritestormApi['typeLibrary']>,
): Pick<WritestormApi, 'typeLibrary'> {
  const unavailable = async () => { throw new Error('not configured'); };
  return {
    typeLibrary: {
      listOptions: overrides.listOptions ?? unavailable,
      getBookBinding: overrides.getBookBinding ?? unavailable,
      updateBookBinding: overrides.updateBookBinding ?? unavailable,
    },
  };
}
