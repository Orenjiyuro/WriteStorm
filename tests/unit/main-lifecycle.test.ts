import { describe, expect, it } from 'vitest';
import { createMainLifecycleCoordinator } from '../../src/main/main-lifecycle';

describe('main lifecycle coordinator', () => {
  it('cancels and awaits active detection before a library session change', async () => {
    const events: string[] = [];
    let releaseIdle = (): void => undefined;
    const idle = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    const lifecycle = createMainLifecycleCoordinator({
      structure: {
        cancelAll: () => {
          events.push('cancel');
          return 1;
        },
        waitForIdle: async () => {
          events.push('wait');
          await idle;
        },
      },
      disposeStructureWorker: () => events.push('dispose'),
      clearPendingImports: () => events.push('clear-imports'),
      closeCurrentLibrary: () => events.push('close-library'),
    });

    const preparing = lifecycle.prepareForLibrarySessionChange();
    await Promise.resolve();
    expect(events).toEqual(['cancel', 'wait']);

    releaseIdle();
    await preparing;
    expect(events).toEqual(['cancel', 'wait']);
  });

  it('shares one shutdown barrier and closes resources only after detection is idle', async () => {
    const events: string[] = [];
    let releaseIdle = (): void => undefined;
    const idle = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    const lifecycle = createMainLifecycleCoordinator({
      structure: {
        cancelAll: () => {
          events.push('cancel');
          return 1;
        },
        waitForIdle: async () => {
          events.push('wait');
          await idle;
        },
      },
      disposeStructureWorker: () => events.push('dispose'),
      clearPendingImports: () => events.push('clear-imports'),
      closeCurrentLibrary: () => events.push('close-library'),
    });

    const first = lifecycle.shutdown();
    const second = lifecycle.shutdown();
    expect(second).toBe(first);
    await Promise.resolve();
    expect(events).toEqual(['cancel', 'wait']);

    releaseIdle();
    await first;
    expect(events).toEqual([
      'cancel',
      'wait',
      'dispose',
      'clear-imports',
      'close-library',
    ]);
  });
});
