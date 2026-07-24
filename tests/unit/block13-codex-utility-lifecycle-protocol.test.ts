import { describe, expect, it, vi } from 'vitest';
import {
  CodexUtilityLifecycleHost,
} from '../../src/main/ai/providers/codex/codex-utility-lifecycle-host';
import {
  isCodexUtilityLifecycleRequest,
  isCodexUtilityLifecycleResponse,
} from '../../src/main/ai/providers/codex/codex-utility-lifecycle-protocol';
import {
  CodexUtilityProcessCleanupDriver,
  type CodexUtilityLifecycleProcess,
} from '../../src/main/ai/providers/codex/codex-utility-process-cleanup-driver';

const token = { attempt: 1, generation: 1 } as const;

describe('Block 13.9 Codex utility lifecycle protocol', () => {
  it('admits only exact lifecycle control messages without prompt, path or process injection', () => {
    const abort = {
      version: 1,
      origin: 'main',
      type: 'ai.abort',
      token,
      trigger: 'explicit_cancel',
    };
    const shutdown = {
      version: 1,
      origin: 'main',
      type: 'ai.shutdown',
      token,
    };
    const abortResult = {
      version: 1,
      origin: 'utility',
      type: 'ai.abort-result',
      token,
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    };

    expect(isCodexUtilityLifecycleRequest(abort)).toBe(true);
    expect(isCodexUtilityLifecycleRequest(shutdown)).toBe(true);
    expect(isCodexUtilityLifecycleResponse(abortResult)).toBe(true);
    expect(isCodexUtilityLifecycleRequest({ ...abort, prompt: 'forbidden' })).toBe(false);
    expect(isCodexUtilityLifecycleRequest({ ...abort, pid: 7 })).toBe(false);
    expect(isCodexUtilityLifecycleRequest({ ...shutdown, path: 'C:\\private' })).toBe(false);
    expect(isCodexUtilityLifecycleResponse({
      ...abortResult,
      error: 'raw failure',
    })).toBe(false);
  });

  it('correlates abort and shutdown acknowledgements and waits for utility exit', async () => {
    const process = fakeProcess();
    const driver = new CodexUtilityProcessCleanupDriver({
      process,
      token,
      isOwnedAndRunning: () => true,
      scanResiduals: async () => cleanResiduals(),
    });

    const aborting = driver.requestAbort('window_close');
    expect(process.postMessage).toHaveBeenLastCalledWith({
      version: 1,
      origin: 'main',
      type: 'ai.abort',
      token,
      trigger: 'window_close',
    });
    process.emitMessage({
      version: 1,
      origin: 'utility',
      type: 'ai.abort-result',
      token,
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    });
    await expect(aborting).resolves.toEqual({
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    });

    const shuttingDown = driver.requestShutdown();
    process.emitMessage({
      version: 1,
      origin: 'utility',
      type: 'ai.shutdown-result',
      token,
      cleanupAcknowledged: true,
    });
    let settled = false;
    void shuttingDown.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    process.emitExit(0);
    await expect(shuttingDown).resolves.toEqual({
      cleanupAcknowledged: true,
      utilityExitObserved: true,
    });
  });

  it('kills only after exact ownership proof and reports exit observation', async () => {
    const unowned = fakeProcess();
    const unownedDriver = new CodexUtilityProcessCleanupDriver({
      process: unowned,
      token,
      isOwnedAndRunning: () => false,
      scanResiduals: async () => cleanResiduals(),
    });
    await expect(unownedDriver.forceOwnedUtility()).resolves.toEqual({
      utilityKillOwnershipProven: false,
      utilityKillAttempted: false,
      utilityExitObserved: false,
    });
    expect(unowned.kill).not.toHaveBeenCalled();

    const owned = fakeProcess();
    const ownedDriver = new CodexUtilityProcessCleanupDriver({
      process: owned,
      token,
      isOwnedAndRunning: () => true,
      scanResiduals: async () => cleanResiduals(),
    });
    const forcing = ownedDriver.forceOwnedUtility();
    expect(owned.kill).toHaveBeenCalledOnce();
    owned.emitExit(1);
    await expect(forcing).resolves.toEqual({
      utilityKillOwnershipProven: true,
      utilityKillAttempted: true,
      utilityExitObserved: true,
    });
  });

  it('utility host aborts the active execution, awaits settlement, then acknowledges shutdown', async () => {
    const events: string[] = [];
    const messages: unknown[] = [];
    const settlement = deferred<void>();
    const host = new CodexUtilityLifecycleHost({
      postMessage: (message) => messages.push(message),
      scheduleExit: (code) => events.push(`exit:${code}`),
    });
    host.bindActiveExecution({
      token,
      abort: () => events.push('abort'),
      settled: settlement.promise.then(() => {
        events.push('settled');
      }),
    });

    const aborting = host.accept({
      version: 1,
      origin: 'main',
      type: 'ai.abort',
      token,
      trigger: 'explicit_cancel',
    });
    expect(events).toEqual(['abort']);
    settlement.resolve();
    await aborting;
    expect(events).toEqual(['abort', 'settled']);
    expect(messages.at(-1)).toMatchObject({
      type: 'ai.abort-result',
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    });

    await host.accept({
      version: 1,
      origin: 'main',
      type: 'ai.shutdown',
      token,
    });
    expect(messages.at(-1)).toMatchObject({
      type: 'ai.shutdown-result',
      cleanupAcknowledged: true,
    });
    expect(events.at(-1)).toBe('exit:0');
  });

  it('utility host waits for active settlement before fail-closed malformed exit', async () => {
    const events: string[] = [];
    const settlement = deferred<void>();
    const host = new CodexUtilityLifecycleHost({
      postMessage: () => undefined,
      scheduleExit: (code) => events.push(`exit:${code}`),
    });
    host.bindActiveExecution({
      token,
      abort: () => events.push('abort'),
      settled: settlement.promise.then(() => events.push('settled')),
    });

    const malformed = host.accept({ type: 'unknown', raw: 'secret' });
    expect(events).toEqual(['abort']);
    settlement.resolve();
    await malformed;
    expect(events).toEqual(['abort', 'settled', 'exit:28']);
  });
});

function fakeProcess(): CodexUtilityLifecycleProcess & {
  postMessage: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  emitMessage(message: unknown): void;
  emitExit(code: number): void;
} {
  const messageListeners = new Set<(message: unknown) => void>();
  const exitListeners = new Set<(code: number) => void>();
  return {
    pid: 7,
    postMessage: vi.fn((_message: unknown) => undefined),
    kill: vi.fn(() => true),
    on: vi.fn((event: 'message' | 'exit', listener: never) => {
      if (event === 'message') messageListeners.add(listener);
      else exitListeners.add(listener);
    }),
    removeListener: vi.fn((event: 'message' | 'exit', listener: never) => {
      if (event === 'message') messageListeners.delete(listener);
      else exitListeners.delete(listener);
    }),
    emitMessage(message) {
      for (const listener of messageListeners) listener(message);
    },
    emitExit(code) {
      for (const listener of exitListeners) listener(code);
    },
  };
}

function cleanResiduals() {
  return {
    residualScanCompleted: true,
    utilityResidualAbsent: true,
    cliResidualAbsent: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
