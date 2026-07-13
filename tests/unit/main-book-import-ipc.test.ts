import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createBookImportIpcDependencies } from '../../src/main/books/book-import-ipc';
import type { SourceImportServiceResult } from '../../src/main/source-text/source-import-service';
import type { BookSummary } from '../../src/shared/contracts';
import type { BreakdownBookId, LibraryId, SourceTextId, JobId } from '../../src/shared/domain';

const sessionId = 'session-task-16';
const book: BookSummary = {
  id: 'book-task-16' as BreakdownBookId,
  libraryId: 'library-task-16' as LibraryId,
  title: 'Delegated Book',
  sourceTextId: null,
  sourceTextEdition: null,
  structureEdition: null,
  updatedAt: '2026-07-13T00:00:00.000Z',
};

describe('main book import IPC adapter', () => {
  it('does not own source import filesystem, hashing, SQLite, or transaction behavior', () => {
    const source = readFileSync(
      path.resolve('src/main/books/book-import-ipc.ts'),
      'utf8',
    );
    const imports = importSpecifiers(source);

    expect(imports).not.toContain('node:fs');
    expect(imports).not.toContain('node:crypto');
    expect(imports).not.toContain('better-sqlite3');
    expect(imports).not.toContain('../source-text/source-text-copy');
    expect(imports).not.toContain('../source-text/source-text-conflicts');
    expect(imports).not.toContain('../source-text/source-text-encoding');
    expect(imports).not.toContain('../source-text/source-text-import-transaction');
    expect(imports).not.toContain('../source-text/source-text-metadata');
    expect(imports).not.toContain('../source-text/source-text-preflight');
  });

  it('delegates book listing to the injected BookService interface', () => {
    const list = vi.fn(() => [book]);
    const dependencies = createDependencies({ list });

    expect(dependencies.list()).toEqual({ ok: true, data: [book] });
    expect(list).toHaveBeenCalledOnce();
  });

  it('captures the current session before opening the dialog and delegates the selected source', async () => {
    const calls: string[] = [];
    const importSource = vi.fn(async () => {
      calls.push('source-import');
      return successResponse();
    });
    const dependencies = createDependencies({
      getCurrentSession: () => {
        calls.push('get-current-session');
        return { sessionId };
      },
      showOpenDialog: async () => {
        calls.push('select-source-file');
        return { canceled: false, filePaths: ['C:\\fixtures\\Novel.md'] };
      },
      importSource,
    });

    await expect(dependencies.importSource({ title: '  Novel title  ' })).resolves.toEqual(successResponse());
    expect(calls).toEqual(['get-current-session', 'select-source-file', 'source-import']);
    expect(importSource).toHaveBeenCalledWith({
      sourcePath: 'C:\\fixtures\\Novel.md',
      title: '  Novel title  ',
      expectedSessionId: sessionId,
    });
  });

  it('retries a pending import without opening the native dialog', async () => {
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: ['C:\\fixtures\\must-not-be-selected.txt'],
    }));
    const importSource = vi.fn(async () => successResponse());
    const dependencies = createDependencies({ showOpenDialog, importSource });

    await expect(dependencies.importSource({
      pendingImportId: 'pending-task-16',
      encodingOverride: 'gb18030',
    })).resolves.toEqual(successResponse());

    expect(showOpenDialog).not.toHaveBeenCalled();
    expect(importSource).toHaveBeenCalledWith({
      pendingImportId: 'pending-task-16',
      encodingOverride: 'gb18030',
      expectedSessionId: sessionId,
    });
  });

  it('does not open the dialog or call the service without a current Library session', async () => {
    const showOpenDialog = vi.fn();
    const importSource = vi.fn();
    const dependencies = createDependencies({
      getCurrentSession: () => null,
      showOpenDialog,
      importSource,
    });

    await expect(dependencies.importSource({})).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'no_current_library' } },
    });
    expect(showOpenDialog).not.toHaveBeenCalled();
    expect(importSource).not.toHaveBeenCalled();
  });

  it('maps dialog cancellation without invoking SourceImportService', async () => {
    const importSource = vi.fn();
    const dependencies = createDependencies({
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      importSource,
    });

    await expect(dependencies.importSource({})).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'dialog_cancelled' } },
    });
    expect(importSource).not.toHaveBeenCalled();
  });

  it('invalidates a deferred dialog from a closed window even after a replacement window exists', async () => {
    let releaseDialog!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const dialogBarrier = new Promise<void>((resolve) => { releaseDialog = resolve; });
    const importSource = vi.fn(async () => successResponse());
    const dependencies = createDependencies({
      showOpenDialog: async () => {
        markStarted();
        await dialogBarrier;
        return { canceled: false, filePaths: ['C:\\fixtures\\Old Window.md'] };
      },
      importSource,
    });
    const importing = dependencies.importSource({});
    await started;

    dependencies.invalidateWindowSelections();
    releaseDialog();

    await expect(importing).resolves.toMatchObject({
      ok: false,
      error: { details: { reason: 'library_session_changed' } },
    });
    expect(importSource).not.toHaveBeenCalled();
  });

  it('maps service failures to a stable recoverable contract envelope', async () => {
    const importSource = vi.fn(async (): Promise<SourceImportServiceResult> => ({
      ok: false as const,
      error: {
        code: 'IMPORT_ERROR' as const,
        message: 'The library changed while importing source text.',
        details: { reason: 'library_session_changed' as const },
      },
    }));
    const dependencies = createDependencies({ importSource });

    await expect(dependencies.importSource({ title: 'Novel' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        message: 'The library changed while importing source text.',
        recoverable: true,
        details: { reason: 'library_session_changed' },
      },
    });
  });

  it('delegates pending-import cleanup to SourceImportService', () => {
    const clearPendingImports = vi.fn();
    const dependencies = createDependencies({ clearPendingImports });

    dependencies.clearPendingImports();

    expect(clearPendingImports).toHaveBeenCalledOnce();
  });
});

function createDependencies(overrides: {
  readonly list?: () => BookSummary[];
  readonly importSource?: (input: Parameters<SourceImportServiceResultImport>[0]) => Promise<SourceImportServiceResult>;
  readonly clearPendingImports?: () => void;
  readonly getCurrentSession?: () => { readonly sessionId: string } | null;
  readonly showOpenDialog?: () => Promise<{ readonly canceled: boolean; readonly filePaths: string[] }>;
} = {}) {
  return createBookImportIpcDependencies({
    books: { list: overrides.list ?? (() => [book]) },
    sourceImport: {
      import: overrides.importSource ?? (async (_input) => successResponse()),
      clearPendingImports: overrides.clearPendingImports ?? (() => undefined),
    },
    getCurrentSession: overrides.getCurrentSession ?? (() => ({ sessionId })),
    showOpenDialog: overrides.showOpenDialog ?? (async () => ({
      canceled: false,
      filePaths: ['C:\\fixtures\\Novel.md'],
    })),
  });
}

function successResponse(): Extract<SourceImportServiceResult, { readonly ok: true }> {
  return {
    ok: true,
    data: {
      book,
      sourceText: {
        id: 'source-task-16' as SourceTextId,
        bookId: book.id,
        fileName: 'Novel.md',
        format: 'md',
        sizeBytes: 12,
        encoding: 'utf-8',
        contentHash: 'sha256:task-16',
        sourceTextEdition: 1,
        importedAt: '2026-07-13T00:00:00.000Z',
      },
      job: {
        id: 'job-task-16' as JobId,
        bookId: book.id,
        state: 'completed',
        title: 'Import source',
        completedUnits: 1,
        totalUnits: 1,
        checkpointSummary: 'Source imported.',
        failureReason: null,
        updatedAt: '2026-07-13T00:00:00.000Z',
      },
    },
  };
}

type SourceImportServiceResultImport = (
  input: Parameters<import('../../src/main/source-text/source-import-service').SourceImportService['import']>[0],
) => Promise<SourceImportServiceResult>;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]|\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
  )].map((match) => match[1] ?? match[2]);
}
