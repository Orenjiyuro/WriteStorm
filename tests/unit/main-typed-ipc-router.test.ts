import { describe, expect, it } from 'vitest';
import {
  registerTypedIpcHandler,
  registerTypedIpcHandlers,
} from '../../src/main/ipc';
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

describe('main typed IPC router', () => {
  it('registers typed handlers and returns validated response envelopes', async () => {
    const ipcMain = new MockIpcMain();
    const seenContexts: Array<{
      channel: string;
      senderUrl: string;
      sender: {
        url: string;
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
      return {
        ok: true,
        data: {
          id: jobId,
          bookId,
          state: 'queued',
          title: 'Import source',
          completedUnits: 0,
          totalUnits: null,
          checkpointSummary: null,
          failureReason: null,
          updatedAt: '2026-07-07T00:00:00.000Z',
        },
      };
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
        return {
          ok: true,
          data: {
            id: jobId,
            bookId,
            state: 'queued',
            title: 'Import source',
            completedUnits: 0,
            totalUnits: null,
            checkpointSummary: null,
            failureReason: null,
            updatedAt: '2026-07-07T00:00:00.000Z',
          },
        };
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
      },
    ]);
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
