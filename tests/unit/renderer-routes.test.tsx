import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  BookSummary,
  LibrarySessionSummary,
} from '../../src/shared/contracts';
import type {
  BreakdownBookId,
  LibraryId,
} from '../../src/shared/domain';
import {
  AppRouter,
  resolveAppRoute,
} from '../../src/renderer/app/AppRouter';
import { BreakdownShelfRoute } from '../../src/renderer/routes/BreakdownShelfRoute';
import { DiagnosticsRoute } from '../../src/renderer/routes/DiagnosticsRoute';
import { NoLibraryRoute } from '../../src/renderer/routes/NoLibraryRoute';
import {
  createSourceImportFailureViewModel,
} from '../../src/renderer/features/breakdown-shelf/source-import-failure';

const library: LibrarySessionSummary = {
  sessionId: '00000000-0000-4000-8000-000000000018',
  library: {
    id: 'library-task-18' as LibraryId,
    name: 'Task 18 Library',
    rootPath: 'C:\\Libraries\\Task18',
    schemaVersion: 1,
    appVersion: '0.1.0-test',
  },
};
const book: BookSummary = {
  id: 'book-task-18' as BreakdownBookId,
  libraryId: library.library.id,
  title: 'Persisted Task 18 Book',
  sourceTextId: null,
  sourceTextEdition: null,
  structureEdition: null,
  updatedAt: '2026-07-13T00:00:00.000Z',
};

describe('renderer product routes', () => {
  it('keeps create/open actions on a focused no-library route', () => {
    const html = renderToStaticMarkup(createElement(NoLibraryRoute, {
      pendingAction: null,
      error: null,
      onAction: vi.fn(),
    }));

    expect(html).toContain('No library open');
    expect(html).toContain('Create library');
    expect(html).toContain('Open library');
    expect(html).not.toContain('Analysis module contract readout');
  });

  it('renders persisted books and import recovery on the shelf route', () => {
    const failure = createSourceImportFailureViewModel({
      code: 'IMPORT_ERROR',
      message: 'The source encoding needs confirmation.',
      recoverable: true,
      details: {
        reason: 'encoding_required',
        pendingImportId: 'pending-task-18',
        supportedEncodings: ['gb18030'],
      },
    });
    const html = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      library,
      books: [book],
      importPending: false,
      lastImport: null,
      failure,
      openedBook: null,
      onImport: vi.fn(),
      onFailureAction: vi.fn(),
    }));

    expect(html).toContain('Breakdown shelf');
    expect(html).toContain('Persisted Task 18 Book');
    expect(html).toContain('Retry as GB18030');
  });

  it('keeps engineering contract readouts on the diagnostics route', () => {
    const html = renderToStaticMarkup(createElement(DiagnosticsRoute));

    expect(html).toContain('Analysis module contract readout');
    expect(html).toContain('Technique library contract readout');
    expect(html).toContain('Perspective contract readout');
  });

  it('routes only the explicit diagnostics hash away from the product surface', () => {
    const routerSource = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(resolveAppRoute('#/diagnostics')).toBe('diagnostics');
    expect(resolveAppRoute('#/')).toBe('product');
    expect(resolveAppRoute('')).toBe('product');
    expect(routerSource).toContain("addEventListener('hashchange', updateRoute)");
    expect(routerSource).toContain("removeEventListener('hashchange', updateRoute)");
  });

  it('defaults to the no-library product route without the engineering contract wall', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: queryClient }, createElement(AppRouter)),
    );

    expect(html).toContain('No library open');
    expect(html).not.toContain('Analysis module contract readout');
    expect(html).not.toContain('Technique library contract readout');
    expect(html).not.toContain('Perspective contract readout');
  });
});
