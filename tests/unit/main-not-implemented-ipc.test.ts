import { describe, expect, it } from 'vitest';
import { registerNotImplementedProductIpcHandlers, registerProductIpc } from '../../src/main/ipc';
import { PRODUCT_IPC_CHANNELS, type ProductIpcChannel } from '../../src/shared/contracts';
import type {
  AnalysisModuleInstanceId,
  BreakdownBookId,
  JobId,
  StorySegmentRangeId,
  StructureNodeId,
} from '../../src/shared/domain';

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

const bookId = 'book-1' as BreakdownBookId;
const nodeId = 'node-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const instanceId = 'instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;

const validRequests = {
  'library:create': {},
  'library:open': {},
  'library:get-current': {},
  'books:list': {},
  'books:import-source': {
    title: 'Example Book',
  },
  'structure:get': {
    bookId,
  },
  'structure:detect': {
    bookId,
  },
  'structure:update-node': {
    nodeId,
    patch: {
      title: 'Renamed Chapter',
    },
  },
  'structure:update-story-range': {
    rangeId,
    patch: {
      confidence: 0.75,
    },
  },
  'structure:freeze': {
    bookId,
  },
  'modules:list-instances': {
    bookId,
  },
  'modules:update-body': {
    instanceId,
    body: 'Updated body',
  },
  'jobs:list': {
    bookId,
  },
  'jobs:get': {
    jobId,
  },
  'jobs:cancel': {
    jobId,
  },
  'exports:get-status': {
    bookId,
  },
} satisfies Record<ProductIpcChannel, unknown>;

describe('main NOT_IMPLEMENTED product IPC handlers', () => {
  it('registers all product channels with stable NOT_IMPLEMENTED envelopes', async () => {
    const ipcMain = new MockIpcMain();

    registerNotImplementedProductIpcHandlers(ipcMain);

    expect([...ipcMain.handlers.keys()]).toEqual([...PRODUCT_IPC_CHANNELS]);

    for (const channel of PRODUCT_IPC_CHANNELS) {
      await expect(ipcMain.invoke(channel, validRequests[channel])).resolves.toEqual({
        ok: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: `Channel ${channel} is not implemented.`,
          recoverable: false,
          details: {
            channel,
          },
        },
      });
    }
  });

  it('keeps typed request validation in front of NOT_IMPLEMENTED handlers', async () => {
    const ipcMain = new MockIpcMain();

    registerNotImplementedProductIpcHandlers(ipcMain);

    await expect(
      ipcMain.invoke('structure:get', {
        rowid: 1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        recoverable: true,
        details: {
          channel: 'structure:get',
        },
      },
    });
  });

  it('wires product NOT_IMPLEMENTED handlers through an executable main registration entrypoint', async () => {
    const ipcMain = new MockIpcMain();

    registerProductIpc(ipcMain, 'http://localhost:5173');

    expect([...ipcMain.handlers.keys()]).toEqual([...PRODUCT_IPC_CHANNELS]);
    await expect(ipcMain.invoke('books:list', {}, 'http://localhost:5173/index.html')).resolves.toEqual({
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
});
