import { describe, expect, it } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';
import {
  createAnalysisModuleInstanceIpcDependencies,
  type AnalysisModuleInstanceListService,
} from '../../src/main/modules/analysis-module-instance-ipc';
import {
  AnalysisModuleInstanceServiceError,
  type AnalysisModuleInstanceServiceErrorReason,
} from '../../src/main/modules/analysis-module-instance-service';
import type {
  ContractResponse,
  ModuleInstanceSummary,
  ProductIpcChannel,
} from '../../src/shared/contracts';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
} from '../../src/shared/domain';

const bookId = 'book-module-ipc' as BreakdownBookId;
const summary: ModuleInstanceSummary = {
  id: 'instance-module-ipc' as AnalysisModuleInstanceId,
  bookId,
  moduleId: 'world_rules' as AnalysisModuleId,
  scope: { kind: 'book', bookId },
  status: 'not_generated',
  structureEdition: 1,
  analysisRevision: 0,
  updatedAt: '2026-07-15T16:00:00.000Z',
};

describe('analysis module instance IPC', () => {
  it('registers a typed modules:list-instances handler while update-body remains not implemented', async () => {
    const ipcMain = new MockIpcMain();
    const calls: BreakdownBookId[] = [];
    const modules = createAnalysisModuleInstanceIpcDependencies({
      list(requestedBookId) {
        calls.push(requestedBookId);
        return [summary];
      },
    });
    registerProductIpc(ipcMain, undefined, { modules });

    await expect(ipcMain.invoke('modules:list-instances', { bookId })).resolves.toEqual({
      ok: true,
      data: [summary],
    });
    await expect(ipcMain.invoke('modules:update-body', {
      instanceId: summary.id,
      body: 'must remain unavailable',
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'NOT_IMPLEMENTED', details: { channel: 'modules:update-body' } },
    });
    expect(calls).toEqual([bookId]);
  });

  it('maps stable service blockers to MODULE_ERROR instead of INTERNAL_ERROR', async () => {
    const service = {
      list() {
        throw new AnalysisModuleInstanceServiceError('structure_not_frozen');
      },
    } as AnalysisModuleInstanceListService;
    const modules = createAnalysisModuleInstanceIpcDependencies(service);

    await expect(modules['modules:list-instances']({ bookId })).resolves.toEqual({
      ok: false,
      error: {
        code: 'MODULE_ERROR',
        message: 'Freeze the current structure before opening analysis modules.',
        recoverable: true,
        details: {
          reason: 'structure_not_frozen',
          blockers: ['structure_not_frozen'],
        },
      },
    } as ContractResponse<'modules:list-instances'>);
  });

  it.each([
    'no_current_library',
    'book_not_found',
    'structure_not_frozen',
    'structure_snapshot_mismatch',
  ] satisfies AnalysisModuleInstanceServiceErrorReason[])(
    'marks the user-repairable %s blocker as recoverable',
    async (reason) => {
      const modules = createAnalysisModuleInstanceIpcDependencies(failingService(reason));

      await expect(modules['modules:list-instances']({ bookId })).resolves.toMatchObject({
        ok: false,
        error: { code: 'MODULE_ERROR', recoverable: true, details: { reason } },
      });
    },
  );

  it.each([
    'module_contract_unavailable',
    'book_scope_instances_incomplete',
  ] satisfies AnalysisModuleInstanceServiceErrorReason[])(
    'marks the persisted-contract %s blocker as non-recoverable',
    async (reason) => {
      const modules = createAnalysisModuleInstanceIpcDependencies(failingService(reason));

      await expect(modules['modules:list-instances']({ bookId })).resolves.toMatchObject({
        ok: false,
        error: { code: 'MODULE_ERROR', recoverable: false, details: { reason } },
      });
    },
  );
});

function failingService(
  reason: AnalysisModuleInstanceServiceErrorReason,
): AnalysisModuleInstanceListService {
  return {
    list() {
      throw new AnalysisModuleInstanceServiceError(reason);
    },
  };
}

type MockListener = (event: { senderFrame: { url: string } }, payload: unknown) => unknown;

class MockIpcMain {
  readonly handlers = new Map<string, MockListener>();

  handle(channel: string, listener: MockListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown): Promise<unknown> {
    const listener = this.handlers.get(channel);
    if (!listener) throw new Error(`Missing handler for ${channel}`);
    return Promise.resolve(listener({ senderFrame: { url: 'writestorm://app/index.html' } }, payload));
  }
}
