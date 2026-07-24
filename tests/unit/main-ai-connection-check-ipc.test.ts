import { describe, expect, it, vi } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';

describe('Task 13.12 Main connection-check IPC', () => {
  it('accepts only the exact empty request and returns the provider-neutral service result', async () => {
    const ipcMain = new MockIpcMain();
    const checkConnection = vi.fn(async () => ({
      ok: true as const,
      data: {
        gate: {
          status: 'passed' as const,
          feasibility: 'windows_passed' as const,
          platform: 'macos_deferred' as const,
          overallVerdict: 'conditional_go' as const,
        },
        compatibility: {
          state: 'stale' as const,
          fingerprint: null,
        },
        runtime: {
          authState: 'unknown' as const,
          observedAt: null,
        },
      },
    }));
    registerProductIpc(ipcMain, undefined, {
      senderPolicy: () => true,
      ai: { checkConnection },
    });

    await expect(ipcMain.invoke('ai:check-connection', {})).resolves.toMatchObject({
      ok: true,
      data: {
        compatibility: { state: 'stale' },
        runtime: { authState: 'unknown' },
      },
    });
    await expect(ipcMain.invoke('ai:check-connection', {
      prompt: 'must not cross',
    })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        details: { channel: 'ai:check-connection' },
      },
    });
    expect(checkConnection).toHaveBeenCalledTimes(1);
  });
});

class MockIpcMain {
  private readonly handlers = new Map<
    string,
    (event: unknown, payload: unknown) => unknown
  >();

  handle(
    channel: string,
    listener: (event: never, payload: unknown) => unknown,
  ): void {
    this.handlers.set(channel, listener as (event: unknown, payload: unknown) => unknown);
  }

  invoke(channel: string, payload: unknown): Promise<unknown> {
    const listener = this.handlers.get(channel);
    if (!listener) throw new Error(`Missing handler ${channel}`);
    return Promise.resolve(listener({
      sender: { id: 1 },
      senderFrame: {
        url: 'writestorm://app/index.html',
        routingId: 1,
        processId: 1,
        parent: null,
      },
    }, payload));
  }
}
