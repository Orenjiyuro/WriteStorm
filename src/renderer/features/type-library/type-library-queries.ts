import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  ContractRequest,
  WritestormApi,
} from '../../../shared/contracts';
import type {
  BookClassificationTarget,
  BookTypeBindingDetail,
  BreakdownBookId,
  TypeLibraryReleaseOptions,
} from '../../../shared/domain';
import { bookKeys } from '../breakdown-shelf/book-queries';

export const typeLibraryKeys = {
  options: (sessionId: string, version?: number) =>
    ['library-session', sessionId, 'type-library', 'options', version ?? 'latest'] as const,
  binding: (sessionId: string, bookId: BreakdownBookId) =>
    ['library-session', sessionId, 'type-library', 'book', bookId] as const,
};

export function typeLibraryOptionsQueryOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'typeLibrary'>,
  version?: number,
) {
  return queryOptions({
    queryKey: typeLibraryKeys.options(sessionId, version),
    queryFn: async (): Promise<TypeLibraryReleaseOptions> => {
      const response = await api.typeLibrary.listOptions(
        version === undefined ? {} : { version },
      );
      if (!response.ok) throw response.error;
      return response.data;
    },
  });
}

export function typeLibraryBindingQueryOptions(
  sessionId: string,
  bookId: BreakdownBookId,
  api: Pick<WritestormApi, 'typeLibrary'>,
) {
  return queryOptions({
    queryKey: typeLibraryKeys.binding(sessionId, bookId),
    queryFn: async (): Promise<BookTypeBindingDetail | null> => {
      const response = await api.typeLibrary.getBookBinding({ bookId });
      if (!response.ok) throw response.error;
      return response.data;
    },
  });
}

export function createTypeLibraryBindingMutationOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'typeLibrary'>,
) {
  return mutationOptions({
    mutationFn: async (
      request: ContractRequest<'type-library:update-book-binding'>,
    ): Promise<BookClassificationTarget> => {
      const response = await api.typeLibrary.updateBookBinding(request);
      if (!response.ok) throw response.error;
      return response.data;
    },
    onSuccess: async (result, _request, _context, mutation) => {
      const queryClient = mutation.client as QueryClient;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: typeLibraryKeys.binding(sessionId, result.bookId),
        }),
        queryClient.invalidateQueries({ queryKey: bookKeys.all(sessionId) }),
      ]);
    },
    onError: async (error, request, _context, mutation) => {
      if (!isTypeLibraryRevisionConflict(error)) return;
      const queryClient = mutation.client as QueryClient;
      await queryClient.invalidateQueries({
        queryKey: typeLibraryKeys.binding(sessionId, request.bookId),
      });
    },
  });
}

export function isTypeLibraryRevisionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null ||
    !('code' in error) || error.code !== 'TYPE_LIBRARY_ERROR' ||
    !('details' in error) || typeof error.details !== 'object' || error.details === null ||
    !('reason' in error.details)) return false;
  return error.details.reason === 'revision_conflict';
}
