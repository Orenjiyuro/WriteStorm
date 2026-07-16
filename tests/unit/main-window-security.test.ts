import { describe, expect, it } from 'vitest';
import { createProductSenderPolicy } from '../../src/main/ipc/product-sender-policy';
import { createMainWindow } from '../../src/main/windows/main-window';

describe('main window security lifecycle', () => {
  it('installs guards and binds sender identity before first navigation', async () => {
    const calls: string[] = [];
    let closedListener: () => void = () => undefined;
    let options: unknown;
    const window = {
      webContents: {
        id: 17,
        getURL: () => 'about:blank',
        setWindowOpenHandler: () => calls.push('set-window-open-handler'),
        on: () => calls.push('on-will-navigate'),
      },
      loadURL: async () => calls.push('load-url'),
      on: (_event: 'closed', listener: () => void) => {
        closedListener = listener;
      },
    };

    await createMainWindow({
      createWindow: (windowOptions) => {
        calls.push('create-window');
        options = windowOptions;
        return window;
      },
      preloadPath: 'C:\\WriteStorm\\preload.js',
      appUrl: 'writestorm://app/index.html',
      allowedExternalOrigins: new Set(),
      openExternal: async () => undefined,
      bindSenderPolicy: () => calls.push('bind-sender-policy'),
      unbindSenderPolicy: () => calls.push('unbind-sender-policy'),
      onClosed: async () => {
        calls.push('cleanup-window-imports');
      },
    });

    expect(calls).toEqual([
      'create-window',
      'set-window-open-handler',
      'on-will-navigate',
      'bind-sender-policy',
      'load-url',
    ]);
    expect(options).toMatchObject({
      width: 1100,
      height: 760,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    expect(options).not.toHaveProperty('x');
    expect(options).not.toHaveProperty('y');
    expect(options).not.toHaveProperty('show');

    closedListener();
    expect(calls.slice(-2)).toEqual(['unbind-sender-policy', 'cleanup-window-imports']);
  });

  it('passes test bounds at construction and keeps the window hidden for main-process verification', async () => {
    let options: unknown;
    const window = {
      webContents: {
        id: 18,
        getURL: () => 'about:blank',
        setWindowOpenHandler: () => undefined,
        on: () => undefined,
      },
      loadURL: async () => undefined,
      on: () => undefined,
    };

    await createMainWindow({
      createWindow: (windowOptions) => {
        options = windowOptions;
        return window;
      },
      initialBounds: { x: -1350, y: 70, width: 1100, height: 760 },
      preloadPath: 'C:\\WriteStorm\\preload.js',
      appUrl: 'writestorm://app/index.html',
      allowedExternalOrigins: new Set(),
      openExternal: async () => undefined,
      bindSenderPolicy: () => undefined,
      unbindSenderPolicy: () => undefined,
    });

    expect(options).toMatchObject({
      x: -1350,
      y: 70,
      width: 1100,
      height: 760,
      show: false,
    });
  });

  it('requires trusted URL, the bound webContents ID, and the main frame', () => {
    const policy = createProductSenderPolicy('http://localhost:5173');
    policy.bindWebContents(17);

    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', true))).toBe(true);
    expect(policy.isTrustedSender(sender(17, 'http://localhost:5173/page', true))).toBe(true);
    expect(policy.isTrustedSender(sender(18, 'writestorm://app/index.html', true))).toBe(false);
    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', false))).toBe(false);
    expect(policy.isTrustedSender(sender(17, 'https://example.com', true))).toBe(false);
  });

  it('rejects before binding and invalidates old windows across destruction and replacement', () => {
    const policy = createProductSenderPolicy();

    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', true))).toBe(false);
    policy.bindWebContents(17);
    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', true))).toBe(true);
    policy.unbindWebContents(17);
    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', true))).toBe(false);

    policy.bindWebContents(18);
    expect(policy.isTrustedSender(sender(17, 'writestorm://app/index.html', true))).toBe(false);
    expect(policy.isTrustedSender(sender(18, 'writestorm://app/index.html', true))).toBe(true);
    policy.unbindWebContents(17);
    expect(policy.isTrustedSender(sender(18, 'writestorm://app/index.html', true))).toBe(true);
  });
});

function sender(webContentsId: number, url: string, isMainFrame: boolean) {
  return { webContentsId, url, isMainFrame };
}
