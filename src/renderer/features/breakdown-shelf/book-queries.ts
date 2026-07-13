import {
  mutationOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  BookSummary,
  ContractRequest,
  ImportSourceResult,
  JobSummary,
} from '../../../shared/contracts';
import type { WritestormApi } from '../../../shared/contracts/preload-api';

export const bookKeys = {
  all: (sessionId: string) => ['library-session', sessionId, 'books'] as const,
  detail: (sessionId: string, bookId: string) =>
    ['library-session', sessionId, 'book', bookId] as const,
};

export const jobKeys = {
  all: (sessionId: string) => ['library-session', sessionId, 'jobs'] as const,
};

export function bookListQueryOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'books'>,
) {
  return queryOptions({
    queryKey: bookKeys.all(sessionId),
    queryFn: async (): Promise<BookSummary[]> => {
      const response = await api.books.list();
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function jobListQueryOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'jobs'>,
) {
  return queryOptions({
    queryKey: jobKeys.all(sessionId),
    queryFn: async (): Promise<JobSummary[]> => {
      const response = await api.jobs.list();
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function createImportSourceMutationOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'books'>,
) {
  return mutationOptions({
    mutationFn: async (
      request: ContractRequest<'books:import-source'>,
    ): Promise<ImportSourceResult> => {
      const response = await api.books.importSource(request);
      if (!response.ok) throw response.error;
      return response.data;
    },
    onSuccess: async (_result, _request, _context, mutation) => {
      const queryClient = mutation.client as QueryClient;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookKeys.all(sessionId) }),
        queryClient.invalidateQueries({ queryKey: jobKeys.all(sessionId) }),
      ]);
    },
  });
}
