import { QueryClient } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ExportStatusPanel,
} from '../../src/renderer/features/export-status/ExportStatusPanel';
import {
  exportStatusKeys,
  exportStatusQueryOptions,
} from '../../src/renderer/features/export-status/export-status-queries';
import { BreakdownShelfRoute } from '../../src/renderer/routes/BreakdownShelfRoute';
import type {
  BookSummary,
  ContractResponse,
  ExportStatusDto,
  LibrarySessionSummary,
} from '../../src/shared/contracts';
import type { WritestormApi } from '../../src/shared/contracts/preload-api';
import {
  EXPORT_EXCLUDED_CONTENT_KINDS,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  type BreakdownBookId,
  type LibraryId,
} from '../../src/shared/domain';
import type { JobRecoveryPanelProps } from '../../src/renderer/features/job-recovery/JobRecoveryPanel';

const sessionId = 'session-export-renderer';
const bookId = 'book-export-renderer' as BreakdownBookId;
const book: BookSummary = {
  id: bookId,
  libraryId: 'library-export-renderer' as LibraryId,
  title: 'Blocked export book',
  sourceTextId: null,
  sourceTextEdition: 1,
  structureEdition: null,
  mainTypeDisplayName: null,
  contentFocusDisplayNames: [],
  updatedAt: '2026-07-16T00:00:00.000Z',
};
const library: LibrarySessionSummary = {
  sessionId,
  library: {
    id: book.libraryId,
    name: 'Export renderer library',
    rootPath: 'C:\\Libraries\\ExportRenderer',
    schemaVersion: 5,
    appVersion: '0.1.0-test',
  },
};
const status: ExportStatusDto = {
  bookId,
  targets: [
    {
      kind: 'markdown_package',
      availability: 'blocked',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
      preview: emptyPreview(),
    },
    {
      kind: 'machine_package',
      availability: 'unavailable',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
      preview: emptyPreview(),
    },
  ],
  owners: [...EXPORT_OWNER_RUNTIME_POLICY],
  excludedContent: [...EXPORT_EXCLUDED_CONTENT_KINDS],
};
const emptyJobRecovery: JobRecoveryPanelProps = {
  jobs: [],
  selectedJobId: null,
  detail: null,
  loading: false,
  detailLoading: false,
  error: null,
  cancelPending: false,
  onSelectJob: vi.fn(),
  onCancelJob: vi.fn(),
};

describe('ExportStatusPanel', () => {
  it('shows both blocked targets, blockers, excluded content, and disabled execution buttons', () => {
    const markup = renderToStaticMarkup(<ExportStatusPanel
      status={status}
      loading={false}
      error={null}
    />);

    expect(markup).toContain('Export readiness');
    expect(markup).toContain('Markdown package');
    expect(markup).toContain('Machine package');
    expect(markup).toContain('structure_not_frozen');
    expect(markup).toContain('review_asset_owner_unavailable');
    for (const excluded of EXPORT_EXCLUDED_CONTENT_KINDS) {
      expect(markup).toContain(excluded);
    }
    expect(markup.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(markup).not.toContain('directory');
    expect(markup).not.toContain('path');
  });

  it('mounts from the opened-book shelf even before structure freeze', () => {
    const markup = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      library,
      books: [book],
      importPending: false,
      lastImport: null,
      failure: null,
      openedBook: book,
      exportStatus: status,
      exportStatusLoading: false,
      exportStatusError: null,
      structureWorkspace: null,
      structureLoading: false,
      structureActionPending: false,
      structureError: null,
      jobRecovery: emptyJobRecovery,
      onImport: vi.fn(),
      onOpenBook: vi.fn(),
      onDetectStructure: vi.fn(),
      onRecoverStructureDetection: vi.fn(),
      onCreateStructureDraft: vi.fn(),
      onCreateManualStructureDraft: vi.fn(),
      onUpdateStructureNode: vi.fn(),
      onUpdateStructureRange: vi.fn(),
      onDiscardStructureDraft: vi.fn(),
      onFreezeStructure: vi.fn(),
      onUnfreezeStructure: vi.fn(),
      onFailureAction: vi.fn(),
    }));

    expect(markup).toContain('Opened book: Blocked export book');
    expect(markup).toContain('Export readiness');
    expect(markup).toContain('structure_not_frozen');
    expect(markup).toContain('No structure candidate yet.');
  });
});

describe('renderer Export status query', () => {
  it('keys status by Library session and Book and calls only exports:get-status', async () => {
    const queryClient = createQueryClient();
    const getStatus = vi.fn(async (): Promise<ContractResponse<'exports:get-status'>> => ({
      ok: true,
      data: status,
    }));

    await expect(queryClient.fetchQuery(exportStatusQueryOptions(
      sessionId,
      bookId,
      { exports: { getStatus } },
    ))).resolves.toEqual(status);

    expect(exportStatusKeys.status(sessionId, bookId)).toEqual([
      'library-session',
      sessionId,
      'export-status',
      bookId,
    ]);
    expect(getStatus).toHaveBeenCalledWith({ bookId });
  });

  it('preserves EXPORT_ERROR details for the natural panel error state', async () => {
    const queryClient = createQueryClient();
    const error = {
      code: 'EXPORT_ERROR' as const,
      message: 'The persisted analysis module contract is unavailable.',
      recoverable: false,
      details: { reason: 'module_contract_unavailable' },
    };
    const api: Pick<WritestormApi, 'exports'> = {
      exports: {
        getStatus: async () => ({ ok: false, error }),
      },
    };

    await expect(queryClient.fetchQuery(exportStatusQueryOptions(
      sessionId,
      bookId,
      api,
    ))).rejects.toEqual(error);
  });

  it('connects the query to AppRouter whenever a Book is open without a frozen gate', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');
    const queryStart = source.indexOf('const exportStatusQuery = useQuery({');
    const queryEnd = source.indexOf('\n  });', queryStart);
    const querySource = source.slice(queryStart, queryEnd);

    expect(querySource).toContain('exportStatusQueryOptions(');
    expect(querySource).toContain('openedBook !== null');
    expect(querySource).not.toContain('frozen');
    expect(source).toContain('exportStatus={exportStatusQuery.data ?? null}');
  });
});

function emptyPreview(): ExportStatusDto['targets'][number]['preview'] {
  return {
    structure: { status: 'not_frozen', structureEdition: null },
    moduleInstances: {
      expectedCount: 7,
      actualCount: 0,
      nonEmptyBodyCount: 0,
      statusCounts: {
        not_generated: 0,
        generated_pending_review: 0,
        confirmed: 0,
        stale: 0,
        needs_rebuild: 0,
      },
    },
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
