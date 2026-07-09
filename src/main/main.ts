import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import path from 'node:path';
import {
  createContentSecurityPolicy,
  isAllowedExternalUrl,
  isTrustedSenderUrl,
  shouldAllowNavigation,
  shouldUseHeaderContentSecurityPolicy,
} from './security';
import { createTrustedDevServerOrigins, registerProductIpc } from './ipc';
import { runOptionalNativeSqliteProbe } from './db/native-probe';
import { createLibraryEntryIpcDependencies } from './library/library-entry';
import { LibraryService } from './library/library-service';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const allowedExternalOrigins = new Set<string>();
const appProtocol = 'writestorm';
const appProtocolHost = 'app';
const libraryService = new LibraryService({ appVersion: app.getVersion() });

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
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadURL(createAppUrl('index.html'));
  }

  installNavigationGuards(mainWindow);
};

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

function installNavigationGuards(mainWindow: BrowserWindow): void {
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url, allowedExternalOrigins)) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!shouldAllowNavigation(url, mainWindow.webContents.getURL())) {
      event.preventDefault();
    }
  });
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
  installContentSecurityPolicy();
  registerAppProtocol();
  registerInternalIpc();
  registerProductIpc(ipcMain, MAIN_WINDOW_VITE_DEV_SERVER_URL, {
    library: createLibraryEntryIpcDependencies({
      service: libraryService,
      env: process.env,
      showOpenDialog: (options) => dialog.showOpenDialog(options),
    }),
  });
  await createWindow();
  await runOptionalNativeSqliteProbe();
});

app.on('before-quit', () => {
  libraryService.closeCurrent();
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
