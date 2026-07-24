export type MainLifecycleDependencies = {
  readonly ai: {
    prepareForLibraryReplacement(): Promise<void>;
    shutdown(): Promise<void>;
  };
  readonly jobs: {
    pauseCancellations(): void;
    waitForIdle(): Promise<void>;
  };
  readonly structure: {
    cancelAll(): number;
    waitForIdle(): Promise<void>;
  };
  readonly disposeStructureWorker: () => void;
  readonly clearPendingImports: () => void;
  readonly closeCurrentLibrary: () => void;
};

export type MainLifecycleCoordinator = {
  readonly prepareForLibrarySessionChange: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
};

export function createMainLifecycleCoordinator(
  dependencies: MainLifecycleDependencies,
): MainLifecycleCoordinator {
  const prepareForLibrarySessionChange = async (): Promise<void> => {
    await prepareForRuntimeStop(
      dependencies,
      dependencies.ai.prepareForLibraryReplacement(),
    );
  };
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (): Promise<void> => {
    shutdownPromise ??= runShutdown(dependencies);
    return shutdownPromise;
  };

  return {
    prepareForLibrarySessionChange,
    shutdown,
  };
}

async function runShutdown(
  dependencies: MainLifecycleDependencies,
): Promise<void> {
  try {
    await prepareForRuntimeStop(dependencies, dependencies.ai.shutdown());
  } finally {
    try {
      dependencies.disposeStructureWorker();
    } finally {
      try {
        dependencies.clearPendingImports();
      } finally {
        dependencies.closeCurrentLibrary();
      }
    }
  }
}

async function prepareForRuntimeStop(
  dependencies: MainLifecycleDependencies,
  aiCleanup: Promise<void>,
): Promise<void> {
  dependencies.jobs.pauseCancellations();
  dependencies.structure.cancelAll();
  await Promise.all([
    dependencies.jobs.waitForIdle(),
    dependencies.structure.waitForIdle(),
    aiCleanup,
  ]);
}
