import { isAllowedExternalUrl, shouldAllowNavigation } from '../security';

type WindowOpenResult = { action: 'deny' };

export type MainWindowLike = {
  readonly webContents: {
    readonly id: number;
    readonly getURL: () => string;
    readonly setWindowOpenHandler: (
      handler: (details: { url: string }) => WindowOpenResult,
    ) => void;
    readonly on: (
      event: 'will-navigate',
      listener: (event: { preventDefault: () => void }, url: string) => void,
    ) => void;
  };
  readonly loadURL: (url: string) => Promise<unknown>;
  readonly on: (event: 'closed', listener: () => void) => void;
};

export type MainWindowDependencies<TWindow extends MainWindowLike> = {
  readonly createWindow: (options: {
    width: number;
    height: number;
    webPreferences: {
      preload: string;
      contextIsolation: true;
      nodeIntegration: false;
      sandbox: true;
    };
  }) => TWindow;
  readonly preloadPath: string;
  readonly appUrl: string;
  readonly allowedExternalOrigins: ReadonlySet<string>;
  readonly openExternal: (url: string) => Promise<unknown>;
  readonly bindSenderPolicy: (webContentsId: number) => void;
  readonly unbindSenderPolicy: (webContentsId: number) => void;
};

export async function createMainWindow<TWindow extends MainWindowLike>(
  dependencies: MainWindowDependencies<TWindow>,
): Promise<TWindow> {
  const window = dependencies.createWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: dependencies.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url, dependencies.allowedExternalOrigins)) {
      void dependencies.openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!shouldAllowNavigation(url, window.webContents.getURL())) {
      event.preventDefault();
    }
  });
  dependencies.bindSenderPolicy(window.webContents.id);
  window.on('closed', () => dependencies.unbindSenderPolicy(window.webContents.id));
  await window.loadURL(dependencies.appUrl);

  return window;
}
