import { describe, expect, it, vi } from 'vitest';
import {
  CodexUtilityCleanupController,
  type CodexUtilityCleanupDriver,
} from '../../src/main/ai/providers/codex/codex-utility-cleanup';

describe('Block 13.9 Codex utility cleanup controller', () => {
  it('performs abort, SDK settlement, shutdown, exit and residual scan in order', async () => {
    const events: string[] = [];
    const controller = new CodexUtilityCleanupController({
      driver: driver({
        requestAbort: async () => {
          events.push('abort');
          return {
            abortRequested: true,
            abortObserved: true,
            executionSettled: true,
          };
        },
        requestShutdown: async () => {
          events.push('shutdown');
          return {
            cleanupAcknowledged: true,
            utilityExitObserved: true,
          };
        },
        scanResiduals: async () => {
          events.push('scan');
          return cleanResiduals();
        },
      }),
      graceMs: 1_000,
    });

    await expect(controller.terminate('explicit_cancel')).resolves.toMatchObject({
      classification: 'graceful',
      utilityKillAttempted: false,
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
    expect(events).toEqual(['abort', 'shutdown', 'scan']);
  });

  it('uses only the ownership-safe force path after cooperative shutdown does not exit', async () => {
    const forceOwnedUtility = vi.fn(async () => ({
      utilityKillOwnershipProven: true,
      utilityKillAttempted: true,
      utilityExitObserved: true,
    }));
    const controller = new CodexUtilityCleanupController({
      driver: driver({
        requestAbort: async () => {
          throw new Error('raw SDK error');
        },
        requestShutdown: async () => ({
          cleanupAcknowledged: false,
          utilityExitObserved: false,
        }),
        forceOwnedUtility,
      }),
      graceMs: 1_000,
    });

    await expect(controller.terminate('timeout')).resolves.toMatchObject({
      classification: 'forced',
      abortRequested: false,
      utilityKillOwnershipProven: true,
      utilityKillAttempted: true,
      residualScanCompleted: true,
    });
    expect(forceOwnedUtility).toHaveBeenCalledOnce();
  });

  it('reports unverified when ownership or residual absence cannot be proven', async () => {
    const controller = new CodexUtilityCleanupController({
      driver: driver({
        requestShutdown: async () => ({
          cleanupAcknowledged: false,
          utilityExitObserved: false,
        }),
        forceOwnedUtility: async () => ({
          utilityKillOwnershipProven: false,
          utilityKillAttempted: false,
          utilityExitObserved: false,
        }),
        scanResiduals: async () => ({
          residualScanCompleted: false,
          utilityResidualAbsent: false,
          cliResidualAbsent: false,
        }),
      }),
      graceMs: 1_000,
    });

    await expect(controller.terminate('app_quit')).resolves.toMatchObject({
      classification: 'unverified',
      utilityKillAttempted: false,
      residualScanCompleted: false,
    });
  });

  it('continues to shutdown and residual scan after a synchronous abort failure', async () => {
    const requestShutdown = vi.fn(async () => ({
      cleanupAcknowledged: true,
      utilityExitObserved: true,
    }));
    const scanResiduals = vi.fn(async () => cleanResiduals());
    const controller = new CodexUtilityCleanupController({
      driver: driver({
        requestAbort: (() => {
          throw new Error('sensitive synchronous failure');
        }) as CodexUtilityCleanupDriver['requestAbort'],
        requestShutdown,
        scanResiduals,
      }),
      graceMs: 1_000,
    });

    await expect(controller.terminate('app_quit')).resolves.toMatchObject({
      classification: 'unverified',
      cleanupAcknowledged: true,
      utilityExitObserved: true,
      residualScanCompleted: true,
    });
    expect(requestShutdown).toHaveBeenCalledOnce();
    expect(scanResiduals).toHaveBeenCalledOnce();
  });

  it('is single-flight and preserves the first termination trigger', async () => {
    const abort = deferred<{
      abortRequested: boolean;
      abortObserved: boolean;
      executionSettled: boolean;
    }>();
    const requestAbort = vi.fn(() => abort.promise);
    const controller = new CodexUtilityCleanupController({
      driver: driver({ requestAbort }),
      graceMs: 1_000,
    });

    const first = controller.terminate('window_close');
    const second = controller.terminate('app_quit');
    expect(second).toBe(first);
    abort.resolve({
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    });

    await expect(second).resolves.toMatchObject({ classification: 'graceful' });
    expect(requestAbort).toHaveBeenCalledOnce();
    expect(requestAbort).toHaveBeenCalledWith('window_close');
  });
});

function driver(
  overrides: Partial<CodexUtilityCleanupDriver> = {},
): CodexUtilityCleanupDriver {
  return {
    requestAbort: async () => ({
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    }),
    requestShutdown: async () => ({
      cleanupAcknowledged: true,
      utilityExitObserved: true,
    }),
    forceOwnedUtility: async () => ({
      utilityKillOwnershipProven: false,
      utilityKillAttempted: false,
      utilityExitObserved: false,
    }),
    scanResiduals: async () => cleanResiduals(),
    ...overrides,
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
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
