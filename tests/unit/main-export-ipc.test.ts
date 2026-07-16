import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createExportStatusIpcDependencies,
  type ExportStatusIpcService,
} from '../../src/main/exports/export-status-ipc';
import {
  ExportStatusServiceError,
  type ExportStatusServiceErrorReason,
} from '../../src/main/exports/export-status-service';
import {
  registerProductIpc,
} from '../../src/main/ipc/not-implemented-handlers';
import type {
  ExportStatusDto,
  ProductIpcChannel,
} from '../../src/shared/contracts';
import {
  EXPORT_EXCLUDED_CONTENT_KINDS,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  type BreakdownBookId,
} from '../../src/shared/domain';

const bookId = 'book-export-ipc' as BreakdownBookId;
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

describe('Export status IPC', () => {
  it('wires the read-only ExportStatusService into main composition', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');

    expect(source).toContain('new ExportStatusService({ libraryService })');
    expect(source).toContain(
      'exports: createExportStatusIpcDependencies(exportStatusService)',
    );
  });

  it('registers only exports:get-status and preserves successful blocked DTOs', async () => {
    const ipcMain = new MockIpcMain();
    const calls: BreakdownBookId[] = [];
    const exports = createExportStatusIpcDependencies({
      getStatus(requestedBookId) {
        calls.push(requestedBookId);
        return status;
      },
    });
    registerProductIpc(ipcMain, undefined, { exports });

    await expect(ipcMain.invoke('exports:get-status', { bookId })).resolves.toEqual({
      ok: true,
      data: status,
    });
    await expect(ipcMain.invoke('jobs:list', {})).resolves.toMatchObject({
      ok: false,
      error: { code: 'NOT_IMPLEMENTED' },
    });
    expect(calls).toEqual([bookId]);
  });

  it('keeps typed request validation in front of the Export service', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;
    const exports = createExportStatusIpcDependencies({
      getStatus() {
        calls += 1;
        return status;
      },
    });
    registerProductIpc(ipcMain, undefined, { exports });

    for (const pathField of [
      'rootPath',
      'outputPath',
      'directoryPath',
      'targetPath',
    ]) {
      await expect(ipcMain.invoke('exports:get-status', {
        bookId,
        [pathField]: 'C:\\unsafe',
      })).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          details: { channel: 'exports:get-status' },
        },
      });
    }
    expect(calls).toBe(0);
  });

  it.each([
    ['no_current_library', true],
    ['book_not_found', true],
    ['structure_snapshot_mismatch', false],
    ['module_contract_unavailable', false],
    ['book_scope_instances_incomplete', false],
  ] satisfies readonly [ExportStatusServiceErrorReason, boolean][])(
    'maps %s to a stable EXPORT_ERROR envelope',
    async (reason, recoverable) => {
      const exports = createExportStatusIpcDependencies(failingService(reason));

      await expect(exports['exports:get-status']({ bookId })).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'EXPORT_ERROR',
          recoverable,
          details: { reason },
        },
      });
    },
  );

  it('does not serialize unknown sensitive failures', async () => {
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      exports: createExportStatusIpcDependencies({
        getStatus() {
          throw new Error('sensitive database detail');
        },
      }),
    });

    const response = await ipcMain.invoke('exports:get-status', { bookId });
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'IPC handler failed.' },
    });
    expect(JSON.stringify(response)).not.toContain('sensitive database detail');
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

function failingService(reason: ExportStatusServiceErrorReason): ExportStatusIpcService {
  return {
    getStatus() {
      throw new ExportStatusServiceError(reason);
    },
  };
}

type MockListener = (
  event: { senderFrame: { url: string } },
  payload: unknown,
) => unknown;

class MockIpcMain {
  readonly handlers = new Map<string, MockListener>();

  handle(channel: string, listener: MockListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown): Promise<unknown> {
    const listener = this.handlers.get(channel);
    if (!listener) throw new Error(`Missing handler for ${channel}`);
    return Promise.resolve(listener({
      senderFrame: { url: 'writestorm://app/index.html' },
    }, payload));
  }
}
