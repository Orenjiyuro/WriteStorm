import { QueryClient } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type {
  BookSummary,
  ContractResponse,
  LibrarySessionSummary,
} from '../../src/shared/contracts';
import type { WritestormApi } from '../../src/shared/contracts/preload-api';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  SourceTextId,
} from '../../src/shared/domain';
import {
  activateLibrarySession,
  libraryKeys,
} from '../../src/renderer/features/library/library-queries';
import {
  bookKeys,
  bookListQueryOptions,
  createImportSourceMutationOptions,
  jobKeys,
} from '../../src/renderer/features/breakdown-shelf/book-queries';

const sessionA = '00000000-0000-4000-8000-000000000001';
const sessionB = '00000000-0000-4000-8000-000000000002';
const libraryB: LibrarySessionSummary = {
  sessionId: sessionB,
  library: {
    id: 'library-b' as LibraryId,
    name: 'Library B',
    rootPath: 'C:\\Libraries\\B',
    schemaVersion: 1,
    appVersion: '0.1.0-test',
  },
};
const bookA = createBook('book-a', 'Library A book', 'library-a');
const bookB = createBook('book-b', 'Library B book', 'library-b');

describe('renderer service state', () => {
  it('loads persisted books through books:list after a Library reopen', async () => {
    const queryClient = createQueryClient();
    const list = vi.fn(async (): Promise<ContractResponse<'books:list'>> => ({
      ok: true,
      data: [bookB],
    }));
    const api = createApi({ list });

    await activateLibrarySession(queryClient, sessionA, libraryB);
    await expect(queryClient.fetchQuery(bookListQueryOptions(sessionB, api)))
      .resolves.toEqual([bookB]);

    expect(list).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(bookKeys.all(sessionB))).toEqual([bookB]);
  });

  it('invalidates the active session book and Job queries after import success', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(bookKeys.all(sessionB), [bookB]);
    queryClient.setQueryData(jobKeys.all(sessionB), []);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const api = createApi({
      importSource: async () => ({
        ok: true,
        data: {
          book: bookB,
          sourceText: {
            id: 'source-b' as SourceTextId,
            bookId: bookB.id,
            fileName: 'B.md',
            format: 'md',
            sizeBytes: 10,
            encoding: 'utf-8',
            contentHash: 'sha256:b',
            sourceTextEdition: 1,
            importedAt: '2026-07-13T00:00:00.000Z',
          },
          job: {
            id: 'job-b' as JobId,
            bookId: bookB.id,
            state: 'completed',
            title: 'Import source',
            completedUnits: 1,
            totalUnits: 1,
            checkpointSummary: 'Source imported.',
            failureReason: null,
            updatedAt: '2026-07-13T00:00:00.000Z',
          },
        },
      }),
    });
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createImportSourceMutationOptions(sessionB, api),
    );

    await mutation.execute({});

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: bookKeys.all(sessionB) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: jobKeys.all(sessionB) });
  });

  it('removes the previous session cache so session B cannot display session A books', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(libraryKeys.current(), {
      ...libraryB,
      sessionId: sessionA,
    });
    queryClient.setQueryData(bookKeys.all(sessionA), [bookA]);

    await activateLibrarySession(queryClient, sessionA, libraryB);

    expect(queryClient.getQueryData(bookKeys.all(sessionA))).toBeUndefined();
    expect(queryClient.getQueryData(bookKeys.all(sessionB))).toBeUndefined();
    expect(queryClient.getQueryData(libraryKeys.current())).toEqual(libraryB);
  });

  it('does not let an older in-flight current-library query overwrite a new session', async () => {
    const queryClient = createQueryClient();
    let releaseInitialQuery!: () => void;
    const initialQueryBarrier = new Promise<void>((resolve) => { releaseInitialQuery = resolve; });
    const initialQuery = queryClient.fetchQuery({
      queryKey: libraryKeys.current(),
      queryFn: async () => {
        await initialQueryBarrier;
        return null;
      },
    }).catch(() => null);

    await activateLibrarySession(queryClient, null, libraryB);
    releaseInitialQuery();
    await initialQuery;

    expect(queryClient.getQueryData(libraryKeys.current())).toEqual(libraryB);
  });

  it('does not rebuild persisted business state by appending import results locally', () => {
    const appSource = readFileSync('src/renderer/App.tsx', 'utf8');

    expect(appSource).not.toContain('useState<ImportSourceResult[]>');
    expect(appSource).not.toMatch(/setSourceImportResults\s*\(\s*\(?.*=>\s*\[\.\.\./s);
    expect(appSource).toContain('bookListQueryOptions(');
    expect(appSource).toContain('createImportSourceMutationOptions(');
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

function createBook(id: string, title: string, libraryId: string): BookSummary {
  return {
    id: id as BreakdownBookId,
    libraryId: libraryId as LibraryId,
    title,
    sourceTextId: null,
    sourceTextEdition: null,
    structureEdition: null,
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

function createApi(overrides: {
  readonly list?: WritestormApi['books']['list'];
  readonly importSource?: WritestormApi['books']['importSource'];
}): WritestormApi {
  return {
    books: {
      list: overrides.list ?? (async () => ({ ok: true, data: [] })),
      importSource: overrides.importSource ?? (async () => {
        throw new Error('not configured');
      }),
    },
  } as WritestormApi;
}
