import { describe, expect, it } from 'vitest';
import { createMainLifecycleCoordinator } from '../../src/main/main-lifecycle';

describe('main lifecycle coordinator', () => {
  it('pauses Job cancellation admission and waits for in-flight cancellation orchestration', async () => {
    const events: string[] = [];
    let releaseJobs = (): void => undefined;
    const jobsIdle = new Promise<void>((resolve) => {
      releaseJobs = resolve;
    });
    const lifecycle = createMainLifecycleCoordinator({
      jobs: {
        pauseCancellations: () => {
          events.push('pause-jobs');
        },
        waitForIdle: async () => {
          events.push('wait-jobs');
          await jobsIdle;
        },
      },
      structure: {
        cancelAll: () => 0,
        waitForIdle: async () => undefined,
      },
      disposeStructureWorker: () => undefined,
      clearPendingImports: () => undefined,
      closeCurrentLibrary: () => undefined,
    });

    let prepared = false;
    const preparing = lifecycle.prepareForLibrarySessionChange().then(() => {
      prepared = true;
    });
    await Promise.resolve();
    expect(events).toEqual(['pause-jobs', 'wait-jobs']);
    expect(prepared).toBe(false);

    releaseJobs();
    await preparing;
    expect(prepared).toBe(true);
  });

  it('cancels and awaits active detection before a library session change', async () => {
    const events: string[] = [];
    let releaseIdle = (): void => undefined;
    const idle = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    const lifecycle = createMainLifecycleCoordinator({
      jobs: {
        pauseCancellations: () => {
          events.push('pause-jobs');
        },
        waitForIdle: async () => {
          events.push('wait-jobs');
        },
      },
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
    expect(events).toEqual(['pause-jobs', 'cancel', 'wait-jobs', 'wait']);

    releaseIdle();
    await preparing;
    expect(events).toEqual(['pause-jobs', 'cancel', 'wait-jobs', 'wait']);
  });

  it('shares one shutdown barrier and closes resources only after detection is idle', async () => {
    const events: string[] = [];
    let releaseIdle = (): void => undefined;
    const idle = new Promise<void>((resolve) => {
      releaseIdle = resolve;
    });
    const lifecycle = createMainLifecycleCoordinator({
      jobs: {
        pauseCancellations: () => {
          events.push('pause-jobs');
        },
        waitForIdle: async () => {
          events.push('wait-jobs');
        },
      },
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
    expect(events).toEqual(['pause-jobs', 'cancel', 'wait-jobs', 'wait']);

    releaseIdle();
    await first;
    expect(events).toEqual([
      'pause-jobs',
      'cancel',
      'wait-jobs',
      'wait',
      'dispose',
      'clear-imports',
      'close-library',
    ]);
  });
});
