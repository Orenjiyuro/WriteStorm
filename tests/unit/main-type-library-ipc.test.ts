import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createTypeLibraryIpcDependencies,
  type TypeLibraryIpcService,
} from '../../src/main/type-library/type-library-ipc';
import {
  TypeLibraryServiceError,
  type TypeLibraryServiceErrorReason,
} from '../../src/main/type-library/type-library-service';
import { registerProductIpc } from '../../src/main/ipc/not-implemented-handlers';
import type {
  ContractRequest,
  ProductIpcChannel,
} from '../../src/shared/contracts';
import type {
  BookClassificationTarget,
  BreakdownBookId,
  TypeDefinitionId,
  TypeDefinitionVersionId,
  TypeLibraryReleaseOptions,
} from '../../src/shared/domain';

const bookId = 'book-type-ipc' as BreakdownBookId;
const mainType = reference('builtin_main_001');
const release: TypeLibraryReleaseOptions = {
  version: 1,
  options: [{
    ...mainType,
    kind: 'main_type',
    origin: 'built_in',
    stableKey: 'builtin_main_001',
    displayName: '日轻校园',
    selectionDescription: '用户主动选择的内置类型。',
    sortOrder: 0,
  }],
};
const binding: BookClassificationTarget = {
  bookId,
  typeLibraryVersion: 1,
  revision: 1,
  mainType,
  contentFocuses: [],
  updatedAt: '2026-07-17T00:00:00.000Z',
};
const bindingDetail = {
  binding,
  pinnedOptions: [{
    typeDefinitionId: release.options[0].typeDefinitionId,
    typeDefinitionVersionId: release.options[0].typeDefinitionVersionId,
    kind: release.options[0].kind,
    origin: release.options[0].origin,
    stableKey: release.options[0].stableKey,
    displayName: release.options[0].displayName,
    selectionDescription: release.options[0].selectionDescription,
    availability: 'current_selectable' as const,
  }],
};
const updateRequest = {
  bookId,
  expectedRevision: 0,
  typeLibraryVersion: 1,
  mainType,
  contentFocuses: [],
} satisfies ContractRequest<'type-library:update-book-binding'>;

describe('TypeLibrary IPC', () => {
  it('wires TypeLibraryService into main composition without renderer persistence access', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');

    expect(source).toContain('new TypeLibraryService({ libraryService })');
    expect(source).toContain('typeLibrary: createTypeLibraryIpcDependencies(typeLibraryService)');
  });

  it('registers three typed channels and preserves successful DTOs', async () => {
    const calls: unknown[] = [];
    const typeLibrary = createTypeLibraryIpcDependencies({
      listReleaseOptions(version) {
        calls.push(['list', version]);
        return release;
      },
      getBookBindingDetail(requestedBookId: BreakdownBookId) {
        calls.push(['get', requestedBookId]);
        return bindingDetail;
      },
      updateBookBinding(request) {
        calls.push(['update', request]);
        return binding;
      },
    });
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, { typeLibrary });

    await expect(ipcMain.invoke('type-library:list-options', { version: 1 }))
      .resolves.toEqual({ ok: true, data: release });
    await expect(ipcMain.invoke('type-library:get-book-binding', { bookId }))
      .resolves.toEqual({ ok: true, data: bindingDetail });
    await expect(ipcMain.invoke('type-library:update-book-binding', updateRequest))
      .resolves.toEqual({ ok: true, data: binding });
    expect(calls).toEqual([
      ['list', 1],
      ['get', bookId],
      ['update', updateRequest],
    ]);
  });

  it('keeps strict request validation in front of the service', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;
    registerProductIpc(ipcMain, undefined, {
      typeLibrary: createTypeLibraryIpcDependencies({
        listReleaseOptions() { calls += 1; return release; },
        getBookBindingDetail() { calls += 1; return null; },
        updateBookBinding() { calls += 1; return binding; },
      }),
    });

    for (const [channel, request] of [
      ['type-library:list-options', {}],
      ['type-library:get-book-binding', { bookId }],
      ['type-library:update-book-binding', updateRequest],
    ] as const) {
      for (const field of ['rootPath', 'databasePath', 'sqlite', 'secret', 'token', 'sdk']) {
        await expect(ipcMain.invoke(channel, { ...request, [field]: 'forbidden' }))
          .resolves.toMatchObject({
            ok: false,
            error: { code: 'INVALID_REQUEST', details: { channel } },
          });
      }
    }
    expect(calls).toBe(0);
  });

  it.each([
    ['no_current_library', true],
    ['book_not_found', true],
    ['revision_conflict', true],
    ['type_library_version_unavailable', true],
    ['type_definition_version_unavailable', true],
    ['type_kind_mismatch', true],
    ['duplicate_content_focus', true],
    ['too_many_content_focuses', true],
    ['invalid_persisted_book_type_binding', false],
  ] satisfies readonly [TypeLibraryServiceErrorReason, boolean][])(
    'maps %s to a stable TYPE_LIBRARY_ERROR envelope',
    async (reason, recoverable) => {
      const ipc = createTypeLibraryIpcDependencies(failingService(reason));

      await expect(ipc['type-library:update-book-binding'](updateRequest)).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'TYPE_LIBRARY_ERROR',
          recoverable,
          details: { reason },
        },
      });
    },
  );

  it('does not serialize unknown sensitive failures', async () => {
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      typeLibrary: createTypeLibraryIpcDependencies({
        listReleaseOptions() { throw new Error('database path and token'); },
        getBookBindingDetail() { return null; },
        updateBookBinding() { return binding; },
      }),
    });

    const response = await ipcMain.invoke('type-library:list-options', {});
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'IPC handler failed.' },
    });
    expect(JSON.stringify(response)).not.toContain('database path and token');
  });
});

function failingService(reason: TypeLibraryServiceErrorReason): TypeLibraryIpcService {
  return {
    listReleaseOptions() { throw new TypeLibraryServiceError(reason); },
    getBookBindingDetail() { throw new TypeLibraryServiceError(reason); },
    updateBookBinding() { throw new TypeLibraryServiceError(reason); },
  };
}

function reference(stableKey: string): {
  readonly typeDefinitionId: TypeDefinitionId;
  readonly typeDefinitionVersionId: TypeDefinitionVersionId;
} {
  return {
    typeDefinitionId: stableKey as TypeDefinitionId,
    typeDefinitionVersionId: `${stableKey}_v1` as TypeDefinitionVersionId,
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
