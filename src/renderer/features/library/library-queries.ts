import {
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query';
import type { LibrarySessionSummary } from '../../../shared/contracts';
import type { WritestormApi } from '../../../shared/contracts/preload-api';

export const libraryKeys = {
  current: () => ['library-session', 'current'] as const,
  session: (sessionId: string) => ['library-session', sessionId] as const,
};

export function currentLibraryQueryOptions(api: Pick<WritestormApi, 'library'>) {
  return queryOptions({
    queryKey: libraryKeys.current(),
    queryFn: async (): Promise<LibrarySessionSummary | null> => {
      const response = await api.library.getCurrent();
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export async function activateLibrarySession(
  queryClient: QueryClient,
  previousSessionId: string | null | undefined,
  nextSession: LibrarySessionSummary | null,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: libraryKeys.current() });
  queryClient.setQueryData(libraryKeys.current(), nextSession);
  if (previousSessionId && previousSessionId !== nextSession?.sessionId) {
    queryClient.removeQueries({ queryKey: libraryKeys.session(previousSessionId) });
  }
}
