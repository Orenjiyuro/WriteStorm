import { expect, test } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  connectToPackagedElectron,
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  getFreePort,
  parseTestDisplayDiagnostics,
  spawnPackagedAppOnSecondary,
  stopPackagedApp,
  type PackagedAppExit,
} from './electron-app';
import {
  containsRectangle,
  type DisplayRectangle,
  type DisplaySnapshot,
} from '../../src/main/windows/test-display-placement';

test.skip(process.platform !== 'win32', 'Secondary-display packaged smoke requires Windows.');

test('@secondary-display places the packaged window on a non-primary display before showing it', async ({}, testInfo) => {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', `secondary-display-user-data-${port}`);
  const stderr = createElectronStderrBuffer();
  rmSync(userDataDir, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawnPackagedAppOnSecondary({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
  });
  let appExit: PackagedAppExit | undefined;
  appProcess.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
  appProcess.once('exit', (code, signal) => {
    appExit = { code, signal };
  });

  let browser: Awaited<ReturnType<typeof connectToPackagedElectron>> | undefined;
  try {
    browser = await connectToPackagedElectron(port, () => appExit);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent('page'));
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();

    const placement = parseTestDisplayDiagnostics(stderr.summary()).find(
      (record) => record.event === 'window-placement',
    );
    expect(placement, `Expected structured placement evidence in stderr:\n${stderr.summary()}`).toBeDefined();

    const primaryDisplay = placement?.primaryDisplay as DisplaySnapshot;
    const targetDisplay = placement?.targetDisplay as DisplaySnapshot;
    const workArea = placement?.workArea as DisplayRectangle;
    const requestedWindowBounds = placement?.requestedWindowBounds as DisplayRectangle;
    const actualWindowBounds = placement?.actualWindowBounds as DisplayRectangle;
    const centerDisplayId = placement?.centerDisplayId as number;

    expect(targetDisplay.id).not.toBe(primaryDisplay.id);
    expect(workArea).toEqual(targetDisplay.workArea);
    expect(centerDisplayId).toBe(targetDisplay.id);
    expect(containsRectangle(workArea, requestedWindowBounds)).toBe(true);
    expect(containsRectangle(workArea, actualWindowBounds)).toBe(true);

    const evidence = JSON.stringify(placement, null, 2);
    await testInfo.attach('secondary-display-placement.json', {
      body: evidence,
      contentType: 'application/json',
    });
    console.log(`Secondary display placement:\n${evidence}`);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, stderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopPackagedApp(appProcess);
  }
});
