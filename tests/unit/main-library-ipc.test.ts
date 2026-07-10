import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';
import { APP_MIGRATIONS } from '../../src/main/db/migrations';
import { LibraryService } from '../../src/main/library/library-service';
import { LIBRARY_DATABASE_FILE_NAME } from '../../src/main/library/folder-contract';
import type { ProductIpcChannel } from '../../src/shared/contracts';
import type { LibraryId } from '../../src/shared/domain';
import { createNotImplementedError } from '../../src/shared/errors';

type MockIpcListener = (event: MockIpcEvent, payload: unknown) => unknown;

type MockIpcEvent = {
  senderFrame?: {
    url?: string;
  };
};

class MockIpcMain {
  readonly handlers = new Map<string, MockIpcListener>();

  handle(channel: string, listener: MockIpcListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown, senderUrl = 'writestorm://app/index.html'): Promise<unknown> {
    const listener = this.handlers.get(channel);

    if (!listener) {
      throw new Error(`Missing handler for ${channel}`);
    }

    return Promise.resolve(listener({ senderFrame: { url: senderUrl } }, payload));
  }
}

const tempDirs: string[] = [];
const libraryId = 'library-ipc-test' as LibraryId;
const currentAppSchemaVersion = APP_MIGRATIONS.at(-1)?.id ?? 0;

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('main library product IPC handlers', () => {
  it('creates, opens, and returns current library summaries through main-side root providers', async () => {
    const rootPath = libraryRootPath();
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
      createLibraryId: () => libraryId,
    });

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'IPC Library' }),
          selectOpenRoot: () => rootPath,
        },
      });

      await expect(ipcMain.invoke('library:create', {})).resolves.toEqual({
        ok: true,
        data: {
          id: libraryId,
          name: 'IPC Library',
          rootPath,
          schemaVersion: currentAppSchemaVersion,
          appVersion: '0.1.0-test',
        },
      });
      await expect(ipcMain.invoke('library:get-current', {})).resolves.toMatchObject({
        ok: true,
        data: {
          id: libraryId,
          rootPath,
        },
      });

      service.closeCurrent();

      await expect(ipcMain.invoke('library:open', {})).resolves.toMatchObject({
        ok: true,
        data: {
          id: libraryId,
          name: 'IPC Library',
          rootPath,
          schemaVersion: currentAppSchemaVersion,
        },
      });
    } finally {
      service.closeCurrent();
    }
  });

  it('keeps non-library product channels as stable NOT_IMPLEMENTED responses', async () => {
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
      createLibraryId: () => libraryId,
    });

    registerProductIpc(ipcMain, undefined, {
      library: {
        service,
        selectCreateRoot: () => null,
        selectOpenRoot: () => null,
      },
    });

    await expect(ipcMain.invoke('books:list', {})).resolves.toEqual({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Channel books:list is not implemented.',
        recoverable: false,
        details: {
          channel: 'books:list',
        },
      },
    });
  });

  it('clears main-only pending imports when the library session changes', async () => {
    const rootPath = libraryRootPath();
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
      createLibraryId: () => libraryId,
    });
    let clearCalls = 0;

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'Session Library' }),
          selectOpenRoot: () => rootPath,
        },
        books: {
          clearPendingImports: () => {
            clearCalls += 1;
          },
          importSource: () => ({
            ok: false,
            error: createNotImplementedError('books:import-source'),
          }),
        },
      });

      await ipcMain.invoke('library:create', {});
      expect(clearCalls).toBe(1);

      service.closeCurrent();
      await ipcMain.invoke('library:open', {});
      expect(clearCalls).toBe(2);
    } finally {
      service.closeCurrent();
    }
  });

  it('does not accept renderer-supplied root paths on library channels', async () => {
    const ipcMain = new MockIpcMain();

    registerProductIpc(ipcMain, undefined, {
      library: {
        service: new LibraryService({ appVersion: '0.1.0-test' }),
        selectCreateRoot: () => null,
        selectOpenRoot: () => null,
      },
    });

    await expect(ipcMain.invoke('library:create', { rootPath: 'C:\\Unsafe' })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        recoverable: true,
        details: {
          channel: 'library:create',
        },
      },
    });
  });

  it('maps expected library service failures to stable recoverable LIBRARY_ERROR responses', async () => {
    const ipcMain = new MockIpcMain();
    const rootPath = libraryRootPath();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
      createLibraryId: () => libraryId,
    });

    registerProductIpc(ipcMain, undefined, {
      library: {
        service,
        selectCreateRoot: () => ({ rootPath, name: 'Duplicate Library' }),
        selectOpenRoot: () => rootPath,
      },
    });

    try {
      await expect(ipcMain.invoke('library:create', {})).resolves.toMatchObject({
        ok: true,
        data: {
          rootPath,
        },
      });

      await expect(ipcMain.invoke('library:create', {})).resolves.toEqual({
        ok: false,
        error: {
          code: 'LIBRARY_ERROR',
          message: 'Library root is not empty.',
          recoverable: true,
          details: {
            channel: 'library:create',
            reason: 'root_not_empty',
          },
        },
      });
    } finally {
      service.closeCurrent();
    }
  });

  it('maps SQLite open failures on library open to LIBRARY_ERROR responses', async () => {
    const ipcMain = new MockIpcMain();
    const rootPath = libraryRootPath();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
      createLibraryId: () => libraryId,
    });

    registerProductIpc(ipcMain, undefined, {
      library: {
        service,
        selectCreateRoot: () => ({ rootPath, name: 'Database Open Failure' }),
        selectOpenRoot: () => rootPath,
      },
    });

    try {
      await ipcMain.invoke('library:create', {});
      service.closeCurrent();
      const databasePath = path.join(rootPath, LIBRARY_DATABASE_FILE_NAME);
      rmSync(databasePath, { force: true });
      mkdirSync(databasePath);

      await expect(ipcMain.invoke('library:open', {})).resolves.toEqual({
        ok: false,
        error: {
          code: 'LIBRARY_ERROR',
          message: 'SQLite database could not be opened.',
          recoverable: true,
          details: {
            channel: 'library:open',
            reason: 'database_open_failed',
          },
        },
      });
    } finally {
      service.closeCurrent();
    }
  });
});

function libraryRootPath(): string {
  return path.join(tempDirectory('writestorm-library-ipc-parent-'), 'library');
}

function tempDirectory(prefix: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}
