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
    });

    expect(calls).toEqual([
      'create-window',
      'set-window-open-handler',
      'on-will-navigate',
      'bind-sender-policy',
      'load-url',
    ]);
    expect(options).toMatchObject({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    closedListener();
    expect(calls.at(-1)).toBe('unbind-sender-policy');
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
