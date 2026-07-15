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
  getQueryErrorMessage,
  resolveAppRoute,
} from '../../src/renderer/app/AppRouter';
import { BreakdownShelfRoute } from '../../src/renderer/routes/BreakdownShelfRoute';
import {
  requestStoryRangeModeChange,
  StructureReviewPanel,
} from '../../src/renderer/features/structure-review/StructureReviewPanel';
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
      structureWorkspace: null,
      structureLoading: false,
      structureActionPending: false,
      structureError: null,
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

    expect(html).toContain('Breakdown shelf');
    expect(html).toContain('Persisted Task 18 Book');
    expect(html).toContain('Retry as GB18030');
    expect(html).toContain('Review structure');
  });

  it('shows the natural detection retry path for an opened book', () => {
    const html = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      library,
      books: [book],
      importPending: false,
      lastImport: null,
      failure: null,
      openedBook: book,
      structureWorkspace: {
        bookId: book.id,
        latestDetectionRun: { state: 'failed', failureReason: 'worker stopped' },
        candidate: null,
        draft: null,
        frozen: null,
        capabilities: { canDetect: true, canCreateManualDraft: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      structureLoading: false,
      structureActionPending: false,
      structureError: null,
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

    expect(html).toContain('Structure workspace');
    expect(html).toContain('Retry detection');
    expect(html).toContain('worker stopped');
    expect(html).toContain('Create manual draft');
  });

  it('shows the draft revision, node list, and manual chapter form', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id,
        latestDetectionRun: null,
        candidate: null,
        frozen: null,
        draft: {
          id: 'draft-1', draftRevision: 4,
          nodes: [
            { id: 'root-1', title: 'Book root', kind: 'book', parentId: null, order: 0,
              startOffset: 0, endOffset: 100,
              confidence: { level: 'low', score: 0.5, lowConfidenceResolution: 'unresolved' } },
            { id: 'chapter-1', title: 'Chapter one', kind: 'chapter', parentId: 'root-1', order: 0,
              startOffset: 0, endOffset: 50,
              confidence: { level: 'high', score: 1, lowConfidenceResolution: null } },
          ],
          storyRangeMode: 'included',
          storyRanges: [{ id: 'range-1', title: 'Opening movement', suggestedFunctionTags: ['setup'],
            startOffset: 0, endOffset: 50, coveredChapterIds: ['chapter-1'],
            boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 50 }],
            confidence: { level: 'low', score: 0.5, lowConfidenceResolution: 'unresolved' } }],
        },
        capabilities: { canDetect: false, canEditDraft: true, canDiscardDraft: true, canFreeze: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false,
      actionPending: false,
      error: null,
      onDetect: vi.fn(),
      onCreateDraft: vi.fn(),
      onCreateManualDraft: vi.fn(),
      onUpdateNode: vi.fn(),
      onUpdateRange: vi.fn(),
      onDiscardDraft: vi.fn(),
      onFreeze: vi.fn(),
      onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('Draft revision 4 is ready for review.');
    expect(html).toContain('Book root');
    expect(html).toContain('Add node');
    expect(html).toContain('Volume');
    expect(html).toContain('Chapter');
    expect(html).toContain('Choose a parent');
    expect(html).toContain('low confidence');
    expect(html).toContain('Rename');
    expect(html).toContain('Accept low confidence');
    expect(html).toContain('Set span');
    expect(html).toContain('Move node');
    expect(html).toContain('Remove node');
    expect(html).toContain('Order');
    expect(html).toContain('Story ranges');
    expect(html).toContain('Opening movement');
    expect(html).toContain('Skip story ranges');
    expect(html).toContain('Save tags');
    expect(html).toContain('Remove range');
    expect(html).toContain('Set range geometry');
    expect(html).toContain('Covered chapters (in story order)');
    expect(html).toContain('Boundary evidence kind');
    expect(html).toContain('Add range');
    expect(html).toContain('Start reason');
    expect(html).toContain('Discard draft');
    expect(html).toContain('Freeze structure');
  });

  it('offers explicit recovery for an orphaned detection run', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id,
        latestDetectionRun: { id: 'run-orphan', jobId: 'job-orphan', state: 'running', failureReason: null,
          updatedAt: '2026-07-15T00:00:00.000Z' },
        candidate: null, draft: null, frozen: null,
        freshness: { candidate: null, draft: null, frozen: null },
        validation: { candidate: null, draft: null, frozen: null },
        capabilities: { canDetect: false, canRetryDetection: false, canCreateDraft: false,
          canCreateManualDraft: false, canDiscardDraft: false, canEditDraft: false, canFreeze: false,
          canUnfreeze: false, blockers: ['structure_detection_recovery_required'] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onRecoverDetection: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(),
      onUpdateNode: vi.fn(), onUpdateRange: vi.fn(), onDiscardDraft: vi.fn(), onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('Recover detection');
  });

  it('shows the current frozen edition and capability-gated unfreeze action', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id, latestDetectionRun: null,
        candidate: { id: 'old-candidate', nodes: [], storyRanges: [] }, draft: null,
        frozen: { id: 'frozen-2', structureEdition: 2, nodes: [{ id: 'root' }], storyRanges: [] },
        capabilities: { canDetect: true, canCreateDraft: false, canUnfreeze: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(), onUpdateNode: vi.fn(), onUpdateRange: vi.fn(),
      onDiscardDraft: vi.fn(), onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('Frozen structure');
    expect(html).toContain('Structure edition 2 is frozen and current.');
    expect(html).toContain('Create revision draft');
    expect(html).toContain('Detection candidate');
    expect(html).not.toContain('>Create draft</button>');
  });

  it('offers an explicit replacement draft for a fresh post-frozen candidate over stale frozen state', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id, latestDetectionRun: null,
        candidate: { id: 'candidate-new', nodes: [], storyRanges: [] }, draft: null,
        frozen: { id: 'frozen-old', structureEdition: 1, nodes: [], storyRanges: [] },
        capabilities: {
          canCreateDraft: false, canCreateReplacementDraft: true, canUnfreeze: false, blockers: ['frozen_stale'],
        },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(),
      onUpdateNode: vi.fn(), onUpdateRange: vi.fn(), onDiscardDraft: vi.fn(),
      onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('Create replacement draft');
    expect(html).not.toContain('>Create draft</button>');
  });

  it('shows manual fallback even while the previous candidate remains visible but stale', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id,
        latestDetectionRun: { id: 'run-failed', jobId: 'job-failed', state: 'failed',
          failureReason: 'structure_detection_failed', updatedAt: '2026-07-15T15:00:00.000Z' },
        candidate: { id: 'candidate-stale', nodes: [], storyRanges: [] }, draft: null, frozen: null,
        freshness: { candidate: { status: 'stale', reasons: ['source_text_id_changed'] }, draft: null, frozen: null },
        capabilities: { canCreateDraft: false, canCreateManualDraft: true, blockers: ['candidate_stale'] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(),
      onUpdateNode: vi.fn(), onUpdateRange: vi.fn(), onDiscardDraft: vi.fn(),
      onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('Create manual draft');
    expect(html).toContain('Detection candidate');
    expect(html).not.toContain('>Create draft</button>');
  });

  it('makes stale freshness and capability blockers visible', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id, latestDetectionRun: null, candidate: null, frozen: null,
        draft: { id: 'draft-stale', draftRevision: 2, nodes: [], storyRanges: [], storyRangeMode: 'included' },
        freshness: { candidate: null, frozen: null, draft: { status: 'stale', reasons: ['source_content_hash_changed'] } },
        capabilities: { canDetect: false, canEditDraft: false, blockers: ['draft_stale'] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(), onUpdateNode: vi.fn(), onUpdateRange: vi.fn(),
      onDiscardDraft: vi.fn(), onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));
    expect(html).toContain('draft is stale: source_content_hash_changed');
    expect(html).toContain('Blocked: draft_stale');
    expect(html).toContain('Draft revision 2 is read-only because its source is stale or unavailable.');
    expect(html).not.toContain('Draft revision 2 is ready for review.');
  });

  it('hides every low-confidence acceptance action when the draft is stale and read-only', () => {
    const html = renderToStaticMarkup(createElement(StructureReviewPanel, {
      book,
      workspace: {
        bookId: book.id, latestDetectionRun: null, candidate: null, frozen: null,
        draft: {
          id: 'draft-stale-low', draftRevision: 2, storyRangeMode: 'included',
          nodes: [{ id: 'node-low', title: 'Uncertain chapter', kind: 'chapter',
            confidence: { level: 'low', lowConfidenceResolution: 'unresolved' } }],
          storyRanges: [{ id: 'range-low', title: 'Uncertain range', suggestedFunctionTags: [],
            confidence: { level: 'low', lowConfidenceResolution: 'unresolved' } }],
        },
        freshness: { candidate: null, frozen: null,
          draft: { status: 'stale', reasons: ['source_content_hash_changed'] } },
        capabilities: { canEditDraft: false, blockers: ['draft_stale'] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      loading: false, actionPending: false, error: null,
      onDetect: vi.fn(), onCreateDraft: vi.fn(), onCreateManualDraft: vi.fn(),
      onUpdateNode: vi.fn(), onUpdateRange: vi.fn(), onDiscardDraft: vi.fn(),
      onFreeze: vi.fn(), onUnfreeze: vi.fn(),
    }));

    expect(html).toContain('read-only because its source is stale or unavailable');
    expect(html).not.toContain('Accept low confidence');
  });

  it('requires confirmation before irreversibly clearing draft story ranges', () => {
    const update = vi.fn();
    const reject = vi.fn(() => false);
    requestStoryRangeModeChange('included', update, reject);
    expect(reject).toHaveBeenCalledWith(expect.stringContaining(
      'will be cleared and will not be restored automatically',
    ));
    expect(update).not.toHaveBeenCalled();

    const accept = vi.fn(() => true);
    requestStoryRangeModeChange('included', update, accept);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith({
      type: 'set-story-range-mode', mode: 'skipped_by_user',
    });

    update.mockClear();
    const includeConfirm = vi.fn(() => false);
    requestStoryRangeModeChange('skipped_by_user', update, includeConfirm);
    expect(includeConfirm).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ type: 'set-story-range-mode', mode: 'included' });
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

  it('makes stable structure blockers visible to the user', () => {
    expect(getQueryErrorMessage({
      message: 'The structure reference is blocked.',
      details: { blockers: ['child:chapter-2', 'story-range:range-1'] },
    })).toBe('The structure reference is blocked. (child:chapter-2, story-range:range-1)');
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
