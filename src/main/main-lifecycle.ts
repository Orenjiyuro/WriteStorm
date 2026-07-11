export type MainLifecycleDependencies = {
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
    dependencies.structure.cancelAll();
    await dependencies.structure.waitForIdle();
  };
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (): Promise<void> => {
    shutdownPromise ??= runShutdown(dependencies, prepareForLibrarySessionChange);
    return shutdownPromise;
  };

  return {
    prepareForLibrarySessionChange,
    shutdown,
  };
}

async function runShutdown(
  dependencies: MainLifecycleDependencies,
  prepareForLibrarySessionChange: () => Promise<void>,
): Promise<void> {
  try {
    await prepareForLibrarySessionChange();
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
