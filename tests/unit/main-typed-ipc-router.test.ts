import { describe, expect, it } from 'vitest';
import {
  registerProductIpc,
  registerTypedIpcHandler,
  registerTypedIpcHandlers,
} from '../../src/main/ipc';
import type { LibraryService } from '../../src/main/library/library-service';
import type { ContractResponse } from '../../src/shared/contracts';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  SourceTextId,
} from '../../src/shared/domain';

type MockIpcListener = (event: MockIpcEvent, payload: unknown) => unknown;

type MockIpcEvent = {
  sender?: {
    id?: number;
  };
  senderFrame?: {
    url?: string;
    routingId?: number;
    processId?: number;
    parent?: object | null;
  };
};

class MockIpcMain {
  readonly handlers = new Map<string, MockIpcListener>();

  handle(channel: string, listener: MockIpcListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(
    channel: string,
    payload: unknown,
    event: MockIpcEvent | string = 'writestorm://app/index.html',
  ): Promise<unknown> {
    const listener = this.handlers.get(channel);

    if (!listener) {
      throw new Error(`Missing handler for ${channel}`);
    }

    const ipcEvent = typeof event === 'string' ? { senderFrame: { url: event } } : event;

    return Promise.resolve(listener(ipcEvent, payload));
  }
}

const libraryId = 'library-1' as LibraryId;
const bookId = 'book-1' as BreakdownBookId;
const sourceTextId = 'source-1' as SourceTextId;
const jobId = 'job-1' as JobId;

const booksListResponse: ContractResponse<'books:list'> = {
  ok: true,
  data: [
    {
      id: bookId,
      libraryId,
      title: 'Example Book',
      sourceTextId,
      sourceTextEdition: 1,
      structureEdition: 1,
      updatedAt: '2026-07-07T00:00:00.000Z',
    },
  ],
};

const importSourceResponse: ContractResponse<'books:import-source'> = {
  ok: true,
  data: {
    book: {
      id: bookId,
      libraryId,
      title: 'Example Book',
      sourceTextId,
      sourceTextEdition: 1,
      structureEdition: null,
      updatedAt: '2026-07-07T00:00:00.000Z',
    },
    sourceText: {
      id: sourceTextId,
      bookId,
      fileName: 'example.md',
      format: 'md',
      sizeBytes: 1024,
      encoding: 'utf-8',
      contentHash: 'sha256:example',
      sourceTextEdition: 1,
      importedAt: '2026-07-07T00:00:00.000Z',
    },
    job: {
      id: jobId,
      bookId,
      state: 'completed',
      title: 'Import source',
      completedUnits: 1,
      totalUnits: 1,
      checkpointSummary: 'Source imported.',
      failureReason: null,
      updatedAt: '2026-07-07T00:00:00.000Z',
    },
  },
};

describe('main typed IPC router', () => {
  it('awaits source-import lifecycle cleanup before replacing the Library session', async () => {
    const ipcMain = new MockIpcMain();
    const events: string[] = [];
    let releaseCleanup!: () => void;
    const cleanupBarrier = new Promise<void>((resolve) => { releaseCleanup = resolve; });
    const service = {
      open: async () => {
        events.push('open-library');
        return null;
      },
      getCurrent: () => null,
    } as unknown as LibraryService;
    registerProductIpc(ipcMain, undefined, {
      beforeLibrarySessionChange: async () => {
        events.push('cancel-and-wait-imports');
        await cleanupBarrier;
      },
      afterLibrarySessionChange: () => {
        events.push('resume-imports');
      },
      library: {
        service,
        selectCreateRoot: () => null,
        selectOpenRoot: () => 'C:\\Libraries\\Next',
      },
    });

    const opening = ipcMain.invoke('library:open', {});
    await Promise.resolve();
    expect(events).toEqual(['cancel-and-wait-imports']);
    releaseCleanup();
    await opening;
    expect(events).toEqual(['cancel-and-wait-imports', 'open-library', 'resume-imports']);
  });

  it('registers typed handlers and returns validated response envelopes', async () => {
    const ipcMain = new MockIpcMain();
    const seenContexts: Array<{
      channel: string;
      senderUrl: string;
      sender: {
        url: string;
        isMainFrame: boolean;
      };
    }> = [];

    registerTypedIpcHandler(ipcMain, 'books:list', (request, context) => {
      expect(request).toEqual({});
      seenContexts.push(context);
      return booksListResponse;
    });

    await expect(ipcMain.invoke('books:list', {})).resolves.toEqual(booksListResponse);
    expect(seenContexts).toEqual([
      {
        channel: 'books:list',
        senderUrl: 'writestorm://app/index.html',
        sender: {
          url: 'writestorm://app/index.html',
          isMainFrame: false,
        },
      },
    ]);
  });

  it('supports batch registration without creating handlers for omitted channels', () => {
    const ipcMain = new MockIpcMain();

    registerTypedIpcHandlers(ipcMain, {
      'books:list': () => booksListResponse,
      'jobs:get': () => ({
        ok: true,
        data: null,
      }),
    });

    expect([...ipcMain.handlers.keys()]).toEqual(['books:list', 'jobs:get']);
  });

  it('returns stable INVALID_REQUEST errors without calling the handler', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;

    registerTypedIpcHandler(ipcMain, 'books:import-source', () => {
      calls += 1;
      return importSourceResponse;
    });

    await expect(
      ipcMain.invoke('books:import-source', {
        sourcePath: 'C:\\Books\\example.md',
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        recoverable: true,
        details: {
          channel: 'books:import-source',
        },
      },
    });
    expect(calls).toBe(0);
  });

  it('returns stable UNTRUSTED_IPC_SENDER errors before request validation', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;

    registerTypedIpcHandler(ipcMain, 'books:list', () => {
      calls += 1;
      return booksListResponse;
    });

    await expect(ipcMain.invoke('books:list', {}, 'https://example.com')).resolves.toEqual({
      ok: false,
      error: {
        code: 'UNTRUSTED_IPC_SENDER',
        message: 'IPC sender is not trusted.',
        recoverable: false,
        details: {
          channel: 'books:list',
          senderUrl: 'https://example.com',
        },
      },
    });
    expect(calls).toBe(0);
  });

  it('supports structured sender identity checks before request validation', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;
    const seenSenders: unknown[] = [];

    registerTypedIpcHandler(
      ipcMain,
      'books:import-source',
      () => {
        calls += 1;
        return importSourceResponse;
      },
      {
        isTrustedSender: (sender) => {
          seenSenders.push(sender);
          return sender.webContentsId === 7 && sender.frameRoutingId === 11;
        },
      },
    );

    await expect(
      ipcMain.invoke(
        'books:import-source',
        {
          sourcePath: 'C:\\Books\\example.md',
        },
        {
          sender: {
            id: 6,
          },
          senderFrame: {
            url: 'writestorm://app/index.html',
            routingId: 11,
            processId: 22,
            parent: null,
          },
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'UNTRUSTED_IPC_SENDER',
        message: 'IPC sender is not trusted.',
        recoverable: false,
        details: {
          channel: 'books:import-source',
          senderUrl: 'writestorm://app/index.html',
        },
      },
    });
    expect(calls).toBe(0);
    expect(seenSenders).toEqual([
      {
        url: 'writestorm://app/index.html',
        webContentsId: 6,
        frameRoutingId: 11,
        frameProcessId: 22,
        isMainFrame: true,
      },
    ]);
  });

  it('marks subframe senders as non-main-frame identities', async () => {
    const ipcMain = new MockIpcMain();
    const seenSenders: unknown[] = [];

    registerTypedIpcHandler(
      ipcMain,
      'books:list',
      () => booksListResponse,
      {
        isTrustedSender: (sender) => {
          seenSenders.push(sender);
          return false;
        },
      },
    );

    await ipcMain.invoke('books:list', {}, {
      sender: { id: 7 },
      senderFrame: {
        url: 'writestorm://app/index.html',
        parent: {},
      },
    });

    expect(seenSenders).toEqual([{
      url: 'writestorm://app/index.html',
      webContentsId: 7,
      isMainFrame: false,
    }]);
  });

  it('maps invalid handler responses to INVALID_RESPONSE instead of throwing', async () => {
    const ipcMain = new MockIpcMain();

    registerTypedIpcHandler(ipcMain, 'books:list', () => ({
      ok: true,
      data: [
        {
          ...booksListResponse.data[0],
          rowid: 1,
        },
      ],
    }));

    await expect(ipcMain.invoke('books:list', {})).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        recoverable: false,
        details: {
          channel: 'books:list',
        },
      },
    });
  });

  it('maps thrown handler errors to stable INTERNAL_ERROR response envelopes without leaking details', async () => {
    const ipcMain = new MockIpcMain();

    registerTypedIpcHandler(ipcMain, 'books:list', () => {
      throw new Error('service unavailable');
    });

    await expect(ipcMain.invoke('books:list', {})).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'IPC handler failed.',
        recoverable: false,
        details: {
          channel: 'books:list',
        },
      },
    });
  });
});
