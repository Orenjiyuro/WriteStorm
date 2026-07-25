import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  screen,
  session,
  shell,
  utilityProcess,
} from 'electron';
import os from 'node:os';
import path from 'node:path';
import * as originalFs from 'original-fs';
import {
  createContentSecurityPolicy,
  isTrustedSenderUrl,
  shouldUseHeaderContentSecurityPolicy,
} from './security';
import {
  createStructureDetectionIpcDependencies,
  createStructureReviewIpcDependencies,
  createAnalysisModuleInstanceIpcDependencies,
  createExportStatusIpcDependencies,
  createTypeLibraryIpcDependencies,
  createJobIpcDependencies,
  createTrustedDevServerOrigins,
  registerProductIpc,
} from './ipc';
import { runOptionalNativeSqliteProbe } from './db/native-probe';
import { createBookImportIpcDependencies } from './books/book-import-ipc';
import { BookService } from './books/book-service';
import { createLibraryEntryIpcDependencies } from './library/library-entry';
import { LibraryService } from './library/library-service';
import { createMainLifecycleCoordinator } from './main-lifecycle';
import { createOptionalStructurePerformanceRecorder } from './structure/performance/structure-performance-recorder';
import { StructureService } from './structure/structure-service';
import { createElectronStructureWorkerRunner } from './structure/worker/structure-worker-runner';
import { runOptionalStructureWorkerProbe } from './structure/worker/structure-worker-probe';
import { createProductSenderPolicy } from './ipc/product-sender-policy';
import { createMainWindow } from './windows/main-window';
import { runOptionalSourceTextWorkerProbe } from './source-text/worker-probe';
import { SourceImportService } from './source-text/source-import-service';
import { createElectronSourceTextWorkerRunner } from './source-text/worker-runner';
import {
  TEST_DISPLAY_DIAGNOSTIC_PREFIX,
  TEST_DISPLAY_FAILURE_EXIT_CODE,
  TestDisplayPlacementError,
  assertActualWindowPlacement,
  resolveTestDisplayTarget,
  selectSecondaryDisplayPlacement,
  type DisplayRectangle,
  type DisplaySnapshot,
  type SecondaryDisplayPlacement,
  type TestDisplayTarget,
} from './windows/test-display-placement';
import { AnalysisModuleInstanceEditionChangePort } from './modules/analysis-module-instance-edition-change-port';
import { AnalysisModuleInstanceService } from './modules/analysis-module-instance-service';
import { JobApplicationService } from './jobs/job-application-service';
import { ExportStatusService } from './exports/export-status-service';
import { TypeLibraryService } from './type-library/type-library-service';
import { AiRuntimeLifecycleRegistry } from './ai/ai-attempt-lifecycle';
import { runOptionalCodexProductPackagedProbe } from './ai/providers/codex/codex-product-packaged-probe';
import { AiConnectionCheckService } from './ai/ai-connection-check-service';
import {
  readAiBuildCompatibilityAssessment,
  readAiRuntimeCompatibility,
} from './ai/ai-runtime-compatibility';
import {
  verifyAiRuntimeArtifactAttestation,
  type AiArtifactCompatibilityAssessment,
  type AiRuntimeArtifactFileSystem,
} from './ai/ai-runtime-artifact-attestation';
import { CodexAuthObservationAuthority } from './ai/providers/codex/codex-auth-observation';
import {
  CodexConnectionCheckAttemptController,
} from './ai/providers/codex/codex-connection-check-attempt-controller';
import {
  CodexConnectionCheckRuntime,
} from './ai/providers/codex/codex-connection-check-runtime';
import { CodexUtilityLauncher } from './ai/providers/codex/codex-utility-launcher';
import {
  resolvePackagedCodexExecutablePath,
} from './ai/providers/codex/codex-product-runtime-path';
import { CodexWindowsProcessGuard } from './ai/providers/codex/codex-windows-process-guard';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const allowedExternalOrigins = new Set<string>();
const appProtocol = 'writestorm';
const appProtocolHost = 'app';
const productSenderPolicy = createProductSenderPolicy(MAIN_WINDOW_VITE_DEV_SERVER_URL);
const structureDetectionTimeoutMs = 30_000;
const originalArtifactFileSystem: AiRuntimeArtifactFileSystem = Object.freeze({
  readFile: (filePath, encoding) => originalFs.promises.readFile(filePath, encoding),
  lstat: (filePath) => originalFs.promises.lstat(filePath),
  createReadStream: (filePath) => originalFs.createReadStream(filePath),
});

// Chromium may otherwise open background service connections before any user action.
// Product networking remains explicit and is initiated only by approved application flows.
app.commandLine.appendSwitch('disable-background-networking');
app.on('session-created', (createdSession) => {
  createdSession.setSpellCheckerDictionaryDownloadURL('writestorm://app/spellcheck-disabled/');
  createdSession.setSpellCheckerEnabled(false);
});

const libraryService = new LibraryService({ appVersion: app.getVersion() });
const structurePerformanceRecorder = createOptionalStructurePerformanceRecorder(process.env);
const structureWorkerRunner = createElectronStructureWorkerRunner(__dirname, {
  onDetectionComplete: (sample) => {
    structurePerformanceRecorder?.record({
      fixture: sample.input.bookTitle,
      inputBytes: Buffer.byteLength(sample.input.sourceText, 'utf8'),
      inputCharacters: sample.input.sourceText.length,
      mainElapsedMs: sample.mainElapsedMs,
      workerPid: sample.workerPid,
      worker: sample.telemetry,
    });
  },
});
const moduleInstanceEditionChangePort = new AnalysisModuleInstanceEditionChangePort();
const moduleInstanceService = new AnalysisModuleInstanceService({ libraryService });
const exportStatusService = new ExportStatusService({ libraryService });
const typeLibraryService = new TypeLibraryService({ libraryService });
const structureService = new StructureService({
  libraryService,
  worker: structureWorkerRunner,
  structureEditionChangePort: moduleInstanceEditionChangePort,
});
const bookService = new BookService({ libraryService });
const sourceTextWorkerRunner = createElectronSourceTextWorkerRunner(__dirname);
const sourceImportService = new SourceImportService({
  libraryService,
  worker: sourceTextWorkerRunner,
  afterImportCommitted: async ({ bookId }) => {
    await structureService.startDetection(bookId, { timeoutMs: structureDetectionTimeoutMs });
  },
});
const jobApplicationService = new JobApplicationService({
  libraryService,
  sourceImports: sourceImportService,
  structure: structureService,
});
const books = createBookImportIpcDependencies({
  books: bookService,
  sourceImport: sourceImportService,
  getCurrentSession: () => libraryService.getCurrent(),
  env: process.env,
  showOpenDialog: (options) => dialog.showOpenDialog(options),
});
const aiRuntimeLifecycle = new AiRuntimeLifecycleRegistry();
const codexConnectionLauncher = new CodexUtilityLauncher({
  mainBundleDirectory: __dirname,
  fork: (modulePath, args, options) => utilityProcess.fork(modulePath, [...args], options),
});
const codexConnectionRuntime = new CodexConnectionCheckRuntime({
  launcher: codexConnectionLauncher,
  createProcessGuard: (observationStartedAt) => new CodexWindowsProcessGuard({
    utilityExecutablePath: process.execPath,
    cliExecutablePath: resolvePackagedCodexExecutablePath(process.resourcesPath),
    observationStartedAt,
  }),
  cleanupGraceMs: 5_000,
});
const codexConnectionAttempts = new CodexConnectionCheckAttemptController({
  runtime: codexConnectionRuntime,
  timeoutMs: 30_000,
});
aiRuntimeLifecycle.track(codexConnectionAttempts);
const codexAuthObservation = new CodexAuthObservationAuthority();
const aiBuildCompatibility = readAiBuildCompatibilityAssessment();
let aiArtifactCompatibility: AiArtifactCompatibilityAssessment =
  Object.freeze({ state: 'unverified' });
const aiConnectionCheckService = new AiConnectionCheckService({
  assessCompatibility: () => readAiRuntimeCompatibility({
    isPackaged: app.isPackaged,
    platform: process.platform,
    architecture: process.arch,
    buildAssessment: aiBuildCompatibility,
    artifactAssessment: aiArtifactCompatibility,
  }),
  auth: codexAuthObservation,
  attempts: codexConnectionAttempts,
});
const mainLifecycle = createMainLifecycleCoordinator({
  ai: aiRuntimeLifecycle,
  jobs: jobApplicationService,
  structure: structureService,
  disposeStructureWorker: () => structureWorkerRunner.dispose(),
  clearPendingImports: () => books.clearPendingImports(),
  closeCurrentLibrary: () => libraryService.closeCurrent(),
});
let quitCleanupComplete = false;
let quitCleanupStarted = false;
let testDisplayTarget: TestDisplayTarget | null = null;
let activeTestPlacement: SecondaryDisplayPlacement | null = null;
let testDisplayFailureStarted = false;
let lastObservedPrimaryDisplay: DisplaySnapshot | null = null;
let lastObservedDisplays: readonly DisplaySnapshot[] = [];
let windowCloseCleanupBarrier: Promise<void> = Promise.resolve();

async function shutdownAndExit(): Promise<void> {
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  try {
    sourceImportService.pauseImports();
    await sourceImportService.waitForIdle();
    await mainLifecycle.shutdown();
  } finally {
    quitCleanupComplete = true;
    app.exit(0);
  }
}

async function prepareForLibrarySessionChange(): Promise<void> {
  aiConnectionCheckService.invalidate();
  sourceImportService.pauseImports();
  await Promise.all([
    sourceImportService.waitForIdle(),
    mainLifecycle.prepareForLibrarySessionChange(),
  ]);
}

async function cleanupSourceImportsForWindowClose(): Promise<void> {
  aiConnectionCheckService.invalidate();
  books.invalidateWindowSelections();
  sourceImportService.pauseImports();
  try {
    await Promise.all([
      sourceImportService.waitForIdle(),
      aiRuntimeLifecycle.windowClosed(),
    ]);
    sourceImportService.clearPendingImports();
  } finally {
    sourceImportService.resumeImports();
  }
}

function startWindowCloseCleanup(): Promise<void> {
  const cleanup = cleanupSourceImportsForWindowClose();
  windowCloseCleanupBarrier = cleanup;
  return cleanup;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: appProtocol,
    privileges: {
      standard: true,
      secure: true,
      corsEnabled: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

if (process.env.WRITESTORM_DISABLE_HARDWARE_ACCELERATION === '1') {
  app.disableHardwareAcceleration();
}

type HealthResponse = {
  ok: true;
  app: 'WriteStorm';
};

const createWindow = async (): Promise<void> => {
  const previousWindowCleanup = windowCloseCleanupBarrier;
  let placement: SecondaryDisplayPlacement | null = null;
  if (testDisplayTarget) {
    lastObservedDisplays = screen.getAllDisplays().map(summarizeDisplay);
    lastObservedPrimaryDisplay = summarizeDisplay(screen.getPrimaryDisplay());
    placement = selectSecondaryDisplayPlacement(lastObservedDisplays, lastObservedPrimaryDisplay);
  }
  activeTestPlacement = placement;
  const window = await createMainWindow({
    createWindow: (options) => new BrowserWindow(options),
    initialBounds: placement?.windowBounds,
    preloadPath: path.join(__dirname, 'index.js'),
    appUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL ?? createAppUrl('index.html'),
    allowedExternalOrigins,
    openExternal: (url) => shell.openExternal(url),
    bindSenderPolicy: productSenderPolicy.bindWebContents,
    unbindSenderPolicy: productSenderPolicy.unbindWebContents,
    onClosed: startWindowCloseCleanup,
    onClosedCleanupFailure: (failure) => {
      console.error('WRITESTORM_WINDOW_CLEANUP', failure.code);
    },
  });

  if (placement) {
    verifyAndReportTestWindowPlacement(window, placement, 'window-placement');
    window.show();
  }

  try {
    await previousWindowCleanup;
  } catch {
    return;
  }
  aiRuntimeLifecycle.resumeAfterWindowReopened();
};

function verifyAndReportTestWindowPlacement(
  window: BrowserWindow,
  placement: SecondaryDisplayPlacement,
  event: 'window-placement' | 'display-metrics-validated',
): void {
  const actualWindowBounds = window.getBounds();
  const centerDisplayId = screen.getDisplayNearestPoint(rectangleCenter(actualWindowBounds)).id;
  assertActualWindowPlacement(placement, actualWindowBounds, centerDisplayId);
  logTestDisplayDiagnostic({
    event,
    primaryDisplay: summarizeDisplay(placement.primaryDisplay),
    targetDisplay: summarizeDisplay(placement.targetDisplay),
    workArea: placement.targetDisplay.workArea,
    requestedWindowBounds: placement.windowBounds,
    actualWindowBounds,
    centerDisplayId,
  });
}

function installTestDisplayGuards(): void {
  screen.on('display-removed', (_event, display) => {
    if (display.id !== activeTestPlacement?.targetDisplay.id) return;
    failTestDisplayMode(
      new TestDisplayPlacementError(
        'TARGET_DISPLAY_REMOVED',
        `Target display ${display.id} was disconnected during secondary-display test mode.`,
      ),
    );
  });

  screen.on('display-metrics-changed', (_event, display) => {
    const placement = activeTestPlacement;
    if (!placement || display.id !== placement.targetDisplay.id) return;
    const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
    if (!window) return;

    const refreshedPlacement: SecondaryDisplayPlacement = {
      ...placement,
      targetDisplay: display,
    };
    activeTestPlacement = refreshedPlacement;

    try {
      verifyAndReportTestWindowPlacement(window, refreshedPlacement, 'display-metrics-validated');
    } catch (error) {
      failTestDisplayMode(error);
    }
  });
}

function rectangleCenter(bounds: DisplayRectangle): { x: number; y: number } {
  return {
    x: bounds.x + Math.floor(bounds.width / 2),
    y: bounds.y + Math.floor(bounds.height / 2),
  };
}

function summarizeDisplay(display: DisplaySnapshot): DisplaySnapshot {
  return {
    id: display.id,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea },
    scaleFactor: display.scaleFactor,
  };
}

function logTestDisplayDiagnostic(record: Record<string, unknown>): void {
  console.error(`${TEST_DISPLAY_DIAGNOSTIC_PREFIX}${JSON.stringify(record)}`);
}

function failTestDisplayMode(error: unknown): void {
  if (testDisplayFailureStarted) return;
  testDisplayFailureStarted = true;
  const placementError =
    error instanceof TestDisplayPlacementError
      ? error
      : new TestDisplayPlacementError(
          'TEST_DISPLAY_STARTUP_FAILED',
          error instanceof Error ? error.message : String(error),
        );
  logTestDisplayDiagnostic({
    event: 'window-placement-error',
    code: placementError.code,
    message: placementError.message,
    primaryDisplay: activeTestPlacement
      ? summarizeDisplay(activeTestPlacement.primaryDisplay)
      : lastObservedPrimaryDisplay,
    targetDisplay: activeTestPlacement
      ? summarizeDisplay(activeTestPlacement.targetDisplay)
      : undefined,
    availableDisplays: lastObservedDisplays,
  });
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.destroy();
  }
  app.exit(TEST_DISPLAY_FAILURE_EXIT_CODE);
}

function installContentSecurityPolicy(): void {
  if (!shouldUseHeaderContentSecurityPolicy(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
    return;
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          createContentSecurityPolicy({ devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL }),
        ],
      },
    });
  });
}

function registerAppProtocol(): void {
  protocol.registerFileProtocol(appProtocol, (request, callback) => {
    const assetPath = resolveAppAssetPath(request.url);

    if (!assetPath) {
      logProtocolDebug('not-found', request.url);
      callback({ error: -6 });
      return;
    }

    logProtocolDebug('ok', request.url, assetPath);
    callback({ path: assetPath });
  });
}

function createAppUrl(assetPath: string): string {
  return `${appProtocol}://${appProtocolHost}/${assetPath}`;
}

function resolveAppAssetPath(requestUrl: string): string | null {
  const rendererRoot = path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
  const parsed = new URL(requestUrl);
  const relativePath = parsed.pathname === '/' ? 'index.html' : decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const resolvedPath = path.resolve(rendererRoot, relativePath);

  if (resolvedPath !== rendererRoot && !resolvedPath.startsWith(`${rendererRoot}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

function logProtocolDebug(result: string, requestUrl: string, assetPath?: string): void {
  if (process.env.WRITESTORM_PROTOCOL_DEBUG === '1') {
    console.error('WRITESTORM_PROTOCOL', result, requestUrl, assetPath ?? '');
  }
}

function registerInternalIpc(): void {
  ipcMain.handle('internal:health', (event): HealthResponse => {
    const senderUrl = event.senderFrame?.url ?? '';
    const trustedDevOrigins = createTrustedDevServerOrigins(MAIN_WINDOW_VITE_DEV_SERVER_URL);

    if (!isTrustedSenderUrl(senderUrl, trustedDevOrigins)) {
      throw new Error('UNTRUSTED_IPC_SENDER');
    }

    return {
      ok: true,
      app: 'WriteStorm',
    };
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged
    && process.platform === 'win32'
    && process.arch === 'x64'
    && aiBuildCompatibility.state === 'fresh') {
    aiArtifactCompatibility = await verifyAiRuntimeArtifactAttestation({
      executablePath: process.execPath,
      resourcesPath: process.resourcesPath,
      compatibilityFingerprint: aiBuildCompatibility.fingerprint,
      fileSystem: originalArtifactFileSystem,
    });
  }
  const productProbeHandled = await runOptionalCodexProductPackagedProbe({
    env: process.env,
    isPackaged: app.isPackaged,
    platform: process.platform,
    architecture: process.arch,
    temporaryDirectory: os.tmpdir(),
    mainBundleDirectory: __dirname,
    resourcesPath: process.resourcesPath,
    executablePath: process.execPath,
    fork: (modulePath, args, options) => utilityProcess.fork(
      modulePath,
      [...args],
      options,
    ),
    electronVersion: process.versions.electron,
    nodeRuntimeVersion: process.versions.node,
    exitApp: (code) => app.exit(code),
  });
  if (productProbeHandled) return;

  testDisplayTarget = resolveTestDisplayTarget(process.env);
  if (testDisplayTarget) installTestDisplayGuards();
  installContentSecurityPolicy();
  registerAppProtocol();
  registerInternalIpc();
  registerProductIpc(ipcMain, MAIN_WINDOW_VITE_DEV_SERVER_URL, {
    senderPolicy: productSenderPolicy.isTrustedSender,
    beforeLibrarySessionChange: prepareForLibrarySessionChange,
    afterLibrarySessionChange: () => {
      sourceImportService.resumeImports();
      jobApplicationService.resumeCancellations();
      aiRuntimeLifecycle.resumeAfterLibraryReplacement();
    },
    afterLibrarySessionActivated: async () => {
      await sourceImportService.recoverAbandonedImports();
    },
    library: createLibraryEntryIpcDependencies({
      service: libraryService,
      env: process.env,
      showOpenDialog: (options) => dialog.showOpenDialog(options),
    }),
    books,
    structure: {
      ...createStructureDetectionIpcDependencies({
        service: structureService,
        timeoutMs: structureDetectionTimeoutMs,
      }),
      ...createStructureReviewIpcDependencies(structureService),
    },
    modules: createAnalysisModuleInstanceIpcDependencies(moduleInstanceService),
    jobs: createJobIpcDependencies(jobApplicationService),
    exports: createExportStatusIpcDependencies(exportStatusService),
    typeLibrary: createTypeLibraryIpcDependencies(typeLibraryService),
    ai: {
      checkConnection: async () => ({
        ok: true,
        data: await aiConnectionCheckService.checkConnection(),
      }),
    },
  });
  await createWindow();
  await runOptionalNativeSqliteProbe();
  await runOptionalSourceTextWorkerProbe({
    mainBundleDirectory: __dirname,
    env: process.env,
    quitApp: () => app.quit(),
  });
  await runOptionalStructureWorkerProbe({
    runner: structureWorkerRunner,
    env: process.env,
    quitApp: () => process.exit(0),
  });
}).catch((error: unknown) => {
  if (testDisplayTarget || error instanceof TestDisplayPlacementError) {
    failTestDisplayMode(error);
    return;
  }

  throw error;
});

app.on('before-quit', (event) => {
  if (quitCleanupComplete) {
    return;
  }

  event.preventDefault();
  void shutdownAndExit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
