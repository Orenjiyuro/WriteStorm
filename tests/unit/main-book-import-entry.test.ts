import { describe, expect, it } from 'vitest';
import {
  E2E_IMPORT_DIALOG_STUB_ENV,
  E2E_IMPORT_SOURCE_PATH_ENV,
  PendingImportStore,
  selectImportSourceFile,
} from '../../src/main/books/book-import-entry';

describe('main book import entry providers', () => {
  it('uses the e2e import file stub only when the explicit main-process env flag is enabled', async () => {
    let dialogCalls = 0;

    await expect(selectImportSourceFile({
      env: {
        [E2E_IMPORT_DIALOG_STUB_ENV]: '1',
        [E2E_IMPORT_SOURCE_PATH_ENV]: 'C:\\Books\\stubbed.md',
      },
      showOpenDialog: async () => {
        dialogCalls += 1;

        return {
          canceled: false,
          filePaths: ['C:\\Books\\dialog.txt'],
        };
      },
    })).resolves.toBe('C:\\Books\\stubbed.md');
    expect(dialogCalls).toBe(0);
  });

  it('falls back to a main-side native file dialog filtered to txt and md files', async () => {
    const dialogOptions: unknown[] = [];

    await expect(selectImportSourceFile({
      env: {},
      showOpenDialog: async (options) => {
        dialogOptions.push(options);

        return {
          canceled: false,
          filePaths: ['C:\\Books\\dialog.txt'],
        };
      },
    })).resolves.toBe('C:\\Books\\dialog.txt');

    expect(dialogOptions).toEqual([
      {
        title: 'Import txt/md source',
        buttonLabel: 'Import source',
        properties: ['openFile'],
        filters: [
          {
            name: 'Text and Markdown',
            extensions: ['txt', 'md'],
          },
        ],
      },
    ]);
  });

  it('returns null when the main-side native file dialog is cancelled', async () => {
    await expect(selectImportSourceFile({
      env: {},
      showOpenDialog: async () => ({
        canceled: true,
        filePaths: ['C:\\Books\\ignored.txt'],
      }),
    })).resolves.toBeNull();
  });

  it('creates pending import tokens that do not expose source paths and are scoped to the library session', () => {
    const store = new PendingImportStore({
      createId: () => 'pending-1',
      now: () => 1_000,
      ttlMs: 600_000,
    });

    const token = store.create({
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      sourcePath: 'C:\\Books\\secret-source.md',
      title: 'Visible Title',
    });

    expect(token).toEqual({
      pendingImportId: 'pending-1',
      expiresAt: 601_000,
    });
    expect(JSON.stringify(token)).not.toContain('secret-source.md');
    expect(store.resolve('pending-1', {
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      now: 1_500,
    })).toEqual({
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      sourcePath: 'C:\\Books\\secret-source.md',
      title: 'Visible Title',
      expiresAt: 601_000,
    });
    expect(store.resolve('pending-1', {
      libraryRootPath: 'C:\\Libraries\\Other',
      sessionId: 'session-1',
      now: 1_500,
    })).toBeNull();
    expect(store.resolve('pending-1', {
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      now: 601_001,
    })).toBeNull();
  });

  it('clears pending tokens after success, expiry, or library switch', () => {
    let nextId = 1;
    const store = new PendingImportStore({
      createId: () => `pending-${nextId++}`,
      now: () => 1_000,
      ttlMs: 600_000,
    });

    const first = store.create({
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      sourcePath: 'C:\\Books\\first.md',
    });
    const second = store.create({
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      sourcePath: 'C:\\Books\\second.md',
    });
    const third = store.create({
      libraryRootPath: 'C:\\Libraries\\Other',
      sessionId: 'session-2',
      sourcePath: 'C:\\Books\\third.md',
    });

    store.clear(first.pendingImportId);
    expect(store.resolve(first.pendingImportId, {
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      now: 1_500,
    })).toBeNull();

    store.clearForLibrary('C:\\Libraries\\Story Lab');
    expect(store.resolve(second.pendingImportId, {
      libraryRootPath: 'C:\\Libraries\\Story Lab',
      sessionId: 'session-1',
      now: 1_500,
    })).toBeNull();
    expect(store.resolve(third.pendingImportId, {
      libraryRootPath: 'C:\\Libraries\\Other',
      sessionId: 'session-2',
      now: 1_500,
    })).not.toBeNull();

    store.clearExpired(601_001);
    expect(store.resolve(third.pendingImportId, {
      libraryRootPath: 'C:\\Libraries\\Other',
      sessionId: 'session-2',
      now: 601_001,
    })).toBeNull();
  });
});
