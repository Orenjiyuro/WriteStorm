import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';
import type { LibraryService } from '../../src/main/library/library-service';
import type {
  ContractResponse,
  LibrarySessionSummary,
  ProductIpcChannel,
} from '../../src/shared/contracts';
import type { LibraryId } from '../../src/shared/domain';

const previous = session('00000000-0000-4000-8000-000000000041', 'Old Library', 'library-old');
const activated = session('00000000-0000-4000-8000-000000000042', 'Recovered Library', 'library-new');

describe('successful Library activation restart recovery', () => {
  it('awaits recovery for the exact newly published session before returning success', async () => {
    const events: string[] = [];
    let current: LibrarySessionSummary | null = previous;
    let releaseRecovery!: () => void;
    const recoveryBarrier = new Promise<void>((resolve) => { releaseRecovery = resolve; });
    const service = libraryService({
      getCurrent: () => current,
      open: async () => {
        events.push('open');
        current = activated;
        return activated;
      },
    });
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      beforeLibrarySessionChange: () => { events.push('before'); },
      afterLibrarySessionChange: () => { events.push('resume'); },
      afterLibrarySessionActivated: async (activation) => {
        events.push('recover');
        expect(activation).toEqual({ previousSessionId: previous.sessionId, session: activated });
        expect(service.getCurrent()).toEqual(activated);
        await recoveryBarrier;
      },
      library: {
        service,
        selectCreateRoot: () => null,
        selectOpenRoot: () => 'C:\\Libraries\\Recovered',
      },
    });

    let response: ContractResponse<'library:open'> | undefined;
    const opening = ipcMain.invoke('library:open', {}).then((result) => { response = result; });
    await vi.waitFor(() => expect(events).toEqual(['before', 'open', 'recover']));
    expect(response).toBeUndefined();
    releaseRecovery();
    await opening;

    expect(response).toEqual({ ok: true, data: activated });
    expect(events).toEqual(['before', 'open', 'recover', 'resume']);
  });

  it('does not recover when returned and current session identity do not prove activation', async () => {
    const recover = vi.fn();
    const service = libraryService({
      getCurrent: () => previous,
      open: async () => activated,
    });
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      afterLibrarySessionActivated: recover,
      library: {
        service,
        selectCreateRoot: () => null,
        selectOpenRoot: () => 'C:\\Libraries\\Mismatch',
      },
    });

    await expect(ipcMain.invoke('library:open', {})).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'LIBRARY_ERROR',
        recoverable: true,
        details: { reason: 'library_activation_mismatch' },
      },
    });
    expect(recover).not.toHaveBeenCalled();
  });

  it('closes the new session and returns a stable error when restart recovery fails', async () => {
    let current: LibrarySessionSummary | null = previous;
    const closeCurrent = vi.fn(() => { current = null; });
    const service = libraryService({
      getCurrent: () => current,
      open: async () => {
        current = activated;
        return activated;
      },
      closeCurrent,
    });
    const ipcMain = new MockIpcMain();
    registerProductIpc(ipcMain, undefined, {
      afterLibrarySessionActivated: async () => { throw new Error('recovery write failed'); },
      library: {
        service,
        selectCreateRoot: () => null,
        selectOpenRoot: () => 'C:\\Libraries\\RecoveryFailure',
      },
    });

    await expect(ipcMain.invoke('library:open', {})).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'LIBRARY_ERROR',
        recoverable: true,
        details: { reason: 'restart_recovery_failed' },
      },
    });
    expect(closeCurrent).toHaveBeenCalledOnce();
    expect(current).toBeNull();
  });

  it('composes abandoned-import recovery in main without renderer orchestration', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');
    expect(source).toContain('afterLibrarySessionActivated:');
    expect(source).toContain('sourceImportService.recoverAbandonedImports()');
  });
});

function session(sessionId: string, name: string, libraryId: string): LibrarySessionSummary {
  return {
    sessionId,
    library: {
      id: libraryId as LibraryId,
      name,
      rootPath: `C:\\Libraries\\${name.replace(' ', '')}`,
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
  };
}

function libraryService(overrides: {
  readonly getCurrent: () => LibrarySessionSummary | null;
  readonly open: () => Promise<LibrarySessionSummary>;
  readonly closeCurrent?: () => void;
}): LibraryService {
  return {
    getCurrent: overrides.getCurrent,
    open: overrides.open,
    closeCurrent: overrides.closeCurrent ?? vi.fn(),
  } as unknown as LibraryService;
}

type MockListener = (event: { senderFrame: { url: string } }, payload: unknown) => unknown;

class MockIpcMain {
  private readonly handlers = new Map<string, MockListener>();

  handle(channel: string, listener: MockListener): void {
    this.handlers.set(channel, listener);
  }

  invoke<TChannel extends ProductIpcChannel>(
    channel: TChannel,
    payload: unknown,
  ): Promise<ContractResponse<TChannel>> {
    const listener = this.handlers.get(channel);
    if (!listener) throw new Error(`Missing handler for ${channel}`);
    return Promise.resolve(listener({ senderFrame: { url: 'writestorm://app/index.html' } }, payload)) as
      Promise<ContractResponse<TChannel>>;
  }
}
