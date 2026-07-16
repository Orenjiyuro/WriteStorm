import { chromium, expect, test } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { build } from 'vite';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'AppRouter renderer mount targets packaged Electron Chromium.');

test('does not display Library A module instances after an in-place switch to Library B', async () => {
  test.setTimeout(60_000);
  const bundle = await buildHarnessBundle();
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', `app-router-session-${port}`);
  const electronStderr = createElectronStderrBuffer();
  rmSync(userDataDir, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });
  const appProcess = spawnPackagedApp({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
  });
  let appExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  appProcess.stderr?.on('data', (chunk: Buffer) => electronStderr.push(chunk));
  appProcess.once('exit', (code, signal) => { appExit = { code, signal }; });

  let browser: Awaited<ReturnType<typeof connectToElectron>> | undefined;
  try {
    browser = await connectToElectron(port, () => appExit);
    const page = browser.contexts()[0].pages()[0] ??
      await browser.contexts()[0].waitForEvent('page');
    await page.evaluate(() => {
      document.body.hidden = true;
      const harnessRoot = document.createElement('div');
      harnessRoot.id = 'app-router-session-root';
      document.documentElement.append(harnessRoot);
    });
    await page.evaluate(bundle);

    await expect(page.getByText('Library A', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review structure' }).click();
    const jobRecoveryPanel = page.locator('.job-recovery-panel');
    await expect(jobRecoveryPanel).toContainText('0 jobs');
    await expect(jobRecoveryPanel.locator('[data-not-job="true"]')).toHaveCount(1);
    await expect(jobRecoveryPanel).toContainText('Export readiness (not a Job)');
    await expect(jobRecoveryPanel).toContainText('Markdown package');
    await expect(jobRecoveryPanel).toContainText('Blocked');
    await expect(jobRecoveryPanel).toContainText('Machine package');
    await expect(jobRecoveryPanel).toContainText('Unavailable');
    await expect(jobRecoveryPanel).toContainText('analysis_module_not_generated');
    await expect(jobRecoveryPanel.locator('.job-recovery-list')).toHaveCount(0);
    const workbench = page.locator('.analysis-module-workbench');
    await expect(workbench.locator('.analysis-module-list > li')).toHaveCount(7);
    await expect(workbench).toContainText('Not generated');

    await page.evaluate(() => (
      window as unknown as { __switchAppRouterLibrary: () => Promise<void> }
    ).__switchAppRouterLibrary());

    await expect(page.getByText('Library B', { exact: true })).toBeVisible();
    await expect(page.getByText('Session B book', { exact: true })).toBeVisible();
    await expect(page.getByText('Session A book', { exact: true })).toHaveCount(0);
    await expect(workbench).toHaveCount(0);
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(jobRecoveryPanel.locator('[data-not-job="true"]')).toHaveCount(1);
    await expect(jobRecoveryPanel).toContainText('analysis_module_needs_rebuild');
    await expect(jobRecoveryPanel).not.toContainText('analysis_module_not_generated');
    await expect(jobRecoveryPanel.locator('.job-recovery-list')).toHaveCount(0);
    const libraryBWorkbench = page.locator('.analysis-module-workbench');
    await expect(libraryBWorkbench.locator('.analysis-module-list > li')).toHaveCount(7);
    await expect(libraryBWorkbench).toContainText('Needs rebuild');
    await expect(libraryBWorkbench).not.toContainText('Not generated');
    await expect(page.evaluate(() => (
      window as unknown as { __hasAppRouterSessionACache: () => boolean }
    ).__hasAppRouterSessionACache())).resolves.toBe(false);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, electronStderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
});

async function buildHarnessBundle(): Promise<string> {
  type HarnessBuildOutput = { readonly output: ReadonlyArray<{
    readonly type: 'asset' | 'chunk';
    readonly code?: string;
  }> };
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: false,
      target: 'es2022',
      lib: {
        entry: path.resolve('tests/e2e/fixtures/app-router-session-harness.tsx'),
        formats: ['iife'],
        name: 'AppRouterSessionHarness',
      },
    },
  }) as unknown as HarnessBuildOutput | readonly HarnessBuildOutput[];
  const output = Array.isArray(result)
    ? result.flatMap((buildOutput) => buildOutput.output)
    : (result as HarnessBuildOutput).output;
  const entry = output.find((item) => item.type === 'chunk' && item.code);
  if (!entry?.code) throw new Error('Vite did not emit the AppRouter session harness chunk.');
  return entry.code;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => typeof address === 'object' && address?.port
        ? resolve(address.port)
        : reject(new Error('Unable to allocate a local debugging port.')));
    });
  });
}

async function connectToElectron(
  port: number,
  getAppExit: () => { code: number | null; signal: NodeJS.Signals | null } | undefined,
) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const appExit = getAppExit();
    if (appExit) throw new Error(
      `Electron exited before CDP connection (code: ${appExit.code ?? 'null'}, signal: ${appExit.signal ?? 'null'}).`,
    );
    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not connect to ${endpoint}`);
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.killed) processToStop.kill();
}
