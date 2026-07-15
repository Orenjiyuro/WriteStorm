import { describe, expect, it } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';
import type { IpcMainEventLike } from '../../src/main/ipc';
import { createStructureDetectionIpcDependencies } from '../../src/main/structure/structure-detection-ipc';
import { createStructureReviewIpcDependencies } from '../../src/main/structure/structure-review-ipc';
import type { ProductIpcChannel } from '../../src/shared/contracts';
import type { StructureDetectionStartResult, StructureWorkspace } from '../../src/shared/contracts/structure';
import { StructureServiceError } from '../../src/main/structure/structure-service';
import { StructureSourceSnapshotError } from '../../src/main/structure/structure-source-snapshot';
import type {
  BreakdownBookId,
  JobId,
  SourceTextId,
  StructureDetectionRunId,
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const started: StructureDetectionStartResult = {
  detectionRun: {
    id: 'run-1' as StructureDetectionRunId,
    bookId,
    job: {
      jobId: 'job-1' as JobId,
      checkpointKind: 'structure_draft',
    },
    sourceSnapshot: {
      sourceTextId: 'source-1' as SourceTextId,
      sourceTextEdition: 1,
      contentHash: 'sha256:source',
      decodedTextLength: 120,
      offsetUnit: 'utf16_code_unit',
    },
    state: 'queued',
    failureReason: null,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  job: {
    id: 'job-1' as JobId,
    bookId,
    state: 'queued',
    title: 'Detect structure',
    completedUnits: 0,
    totalUnits: 1,
    checkpointSummary: null,
    failureReason: null,
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
};
const workspace: StructureWorkspace = {
  bookId, latestDetectionRun: null, candidate: null, draft: null, frozen: null,
  freshness: { candidate: null, draft: null, frozen: null },
  validation: { candidate: null, draft: null, frozen: null },
  capabilities: {
    canDetect: true, canRetryDetection: false, canCreateDraft: false,
    canCreateReplacementDraft: false, canCreateManualDraft: false,
    canDiscardDraft: false, canEditDraft: false, canFreeze: false, canUnfreeze: false,
    blockers: [],
  },
};

class MockIpcMain {
  readonly handlers = new Map<string, (event: IpcMainEventLike, payload: unknown) => unknown>();

  handle(channel: string, listener: (event: IpcMainEventLike, payload: unknown) => unknown): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown): Promise<unknown> {
    const listener = this.handlers.get(channel);
    if (!listener) {
      throw new Error(`Missing handler for ${channel}.`);
    }
    return Promise.resolve(listener({ senderFrame: { url: 'writestorm://app/index.html' } }, payload));
  }
}

describe('structure detection IPC factory', () => {
  it('starts detection with the main-owned timeout and returns the queued checkpoint', async () => {
    const calls: unknown[] = [];
    const dependencies = createStructureDetectionIpcDependencies({
      service: {
        async startDetection(requestBookId, options) {
          calls.push({ requestBookId, options });
          return started;
        },
      },
      timeoutMs: 30_000,
    });

    await expect(dependencies.detect({ bookId })).resolves.toEqual({
      ok: true,
      data: started,
    });
    expect(calls).toEqual([{
      requestBookId: bookId,
      options: { timeoutMs: 30_000 },
    }]);
  });

  it.each([
    new StructureServiceError(
      'structure_detection_in_progress',
      'A structure detection is already running for this book.',
    ),
    new StructureSourceSnapshotError(
      'book_not_found',
      'Book was not found in the current library.',
    ),
  ])('maps known preflight failure $name to a stable recoverable structure envelope', async (error) => {
    const dependencies = createStructureDetectionIpcDependencies({
      service: {
        async startDetection() {
          throw error;
        },
      },
      timeoutMs: 30_000,
    });

    await expect(dependencies.detect({ bookId })).resolves.toEqual({
      ok: false,
      error: {
        code: 'STRUCTURE_ERROR',
        message: error.message,
        recoverable: true,
        details: {
          reason: error.reason,
        },
      },
    });
  });

  it('rethrows unknown failures for the typed router to contain as INTERNAL_ERROR', async () => {
    const error = new Error('database connection disappeared');
    const dependencies = createStructureDetectionIpcDependencies({
      service: {
        async startDetection() {
          throw error;
        },
      },
      timeoutMs: 30_000,
    });

    await expect(dependencies.detect({ bookId })).rejects.toBe(error);
  });

  it('registers the real detect handler without replacing the locked review channel identities', async () => {
    const ipcMain = new MockIpcMain();
    const structure = {
      ...createStructureDetectionIpcDependencies({
      service: {
        async startDetection() {
          return started;
        },
      },
      timeoutMs: 30_000,
      }),
      ...reviewDependencies(),
    };

    registerProductIpc(ipcMain, undefined, { structure });

    await expect(ipcMain.invoke('structure:detect', { bookId })).resolves.toEqual({
      ok: true,
      data: started,
    });
    await expect(ipcMain.invoke('structure:get', { bookId })).resolves.toEqual({ ok: true, data: workspace });
    for (const channel of [
      'structure:update-node',
      'structure:update-story-range',
      'structure:freeze',
    ] as const) {
      expect(ipcMain.handlers.has(channel)).toBe(true);
    }
  });

  it('keeps typed validation and unknown failure containment around the real detect handler', async () => {
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      structure: {
        ...createStructureDetectionIpcDependencies({
        service: {
          async startDetection() {
            throw new Error('sensitive database detail');
          },
        },
        timeoutMs: 30_000,
        }),
        ...reviewDependencies(),
      },
    });

    await expect(ipcMain.invoke('structure:detect', { rowid: 1 })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'IPC request did not match the channel contract.',
        recoverable: true,
        details: { channel: 'structure:detect' },
      },
    });
    await expect(ipcMain.invoke('structure:detect', { bookId })).resolves.toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'IPC handler failed.',
        recoverable: false,
        details: { channel: 'structure:detect' },
      },
    });
  });

  it('recovers an orphan detection through the explicit typed channel', async () => {
    const dependencies = createStructureDetectionIpcDependencies({
      service: {
        async startDetection() { return started; },
        recoverDetection(requestBookId) {
          expect(requestBookId).toBe(bookId);
          return started;
        },
      },
      timeoutMs: 30_000,
    });

    await expect(dependencies.recoverDetection({ bookId })).resolves.toEqual({ ok: true, data: started });
  });
});

function reviewDependencies() {
  const unused = () => { throw new Error('unused review mutation'); };
  return createStructureReviewIpcDependencies({
    async getWorkspace() { return workspace; },
    createDraft: unused,
    async createManualDraft() { return unused(); },
    discardDraft: unused,
    updateNode: unused,
    updateStoryRange: unused,
    async freeze() { return unused(); },
    unfreeze: unused,
  });
}
