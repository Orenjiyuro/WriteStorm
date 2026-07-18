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
    const harness = page.locator('#app-router-session-root');

    await expect(harness.getByText('Library A', { exact: true })).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/techniques'; });
    await expect(harness.getByRole('heading', { name: 'Technique library' })).toBeVisible();
    await page.evaluate(() => (
      window as unknown as { __probeTechniqueRouteQueryGate: () => Promise<void> }
    ).__probeTechniqueRouteQueryGate());
    await page.waitForTimeout(750);
    await expect(page.evaluate(() => (
      window as unknown as {
        __getBreakdownQueryCalls: () => Record<string, number>;
      }
    ).__getBreakdownQueryCalls())).resolves.toEqual({
      books: 0,
      jobs: 0,
      jobDetail: 0,
      structure: 0,
      modules: 0,
      exportStatus: 0,
      typeLibraryOptions: 0,
      typeLibraryBinding: 0,
    });

    await harness.getByRole('link', { name: 'Settings' }).click();
    await expect(harness.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(harness.getByRole('heading', { name: 'AI & connectors' })).toBeVisible();
    await expect(harness.getByText('Codex SDK gate', { exact: true })).toBeVisible();
    await expect(harness.getByText('Required', { exact: true })).toBeVisible();
    await expect(harness.getByText('Connector', { exact: true })).toBeVisible();
    await expect(harness.getByText('Unavailable', { exact: true }).first()).toBeVisible();
    for (const action of [
      'Manage templates',
      'Inspect schemas',
      'Repair library',
      'Run health check',
    ]) {
      await expect(harness.getByRole('button', { name: action })).toBeDisabled();
    }
    await expect(harness.getByRole('heading', { name: 'Local observability' })).toBeVisible();
    await expect(harness.getByText('Local only', { exact: true })).toBeVisible();
    await expect(harness.getByRole('button', { name: 'Clear local logs' })).toBeDisabled();
    await expect(harness.getByRole('button', { name: 'Manually export logs' })).toBeDisabled();
    await page.waitForTimeout(750);
    await expect(page.evaluate(() => (
      window as unknown as {
        __getBreakdownQueryCalls: () => Record<string, number>;
      }
    ).__getBreakdownQueryCalls())).resolves.toEqual({
      books: 0,
      jobs: 0,
      jobDetail: 0,
      structure: 0,
      modules: 0,
      exportStatus: 0,
      typeLibraryOptions: 0,
      typeLibraryBinding: 0,
    });

    await harness.getByRole('link', { name: 'Original shelf' }).click();
    await expect(harness.getByRole('heading', { name: 'Original shelf' })).toBeVisible();
    await expect(harness.getByRole('button', { name: 'Create original project' })).toBeDisabled();
    await expect(harness.getByText('Original project creation is outside the V1 admitted scope.'))
      .toBeVisible();
    await expect(harness.getByRole('main')).not.toContainText('Adopt confirmed candidate');
    await expect(harness.getByRole('main')).not.toContainText('SourceSnapshot');
    await page.waitForTimeout(750);
    await expect(page.evaluate(() => (
      window as unknown as {
        __getBreakdownQueryCalls: () => Record<string, number>;
      }
    ).__getBreakdownQueryCalls())).resolves.toEqual({
      books: 0,
      jobs: 0,
      jobDetail: 0,
      structure: 0,
      modules: 0,
      exportStatus: 0,
      typeLibraryOptions: 0,
      typeLibraryBinding: 0,
    });
    await page.evaluate(() => (
      window as unknown as { __finishTechniqueRouteQueryGateProbe: () => void }
    ).__finishTechniqueRouteQueryGateProbe());

    await page.evaluate(() => { window.location.hash = '#/'; });
    await expect(harness.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await harness.getByRole('button', { name: 'Review structure' }).click();
    const jobRecoveryPanel = harness.locator('.job-recovery-panel');
    await expect(jobRecoveryPanel).toContainText('0 jobs');
    await expect(jobRecoveryPanel.locator('[data-not-job="true"]')).toHaveCount(1);
    await expect(jobRecoveryPanel).toContainText('Export readiness (not a Job)');
    await expect(jobRecoveryPanel).toContainText('Markdown package');
    await expect(jobRecoveryPanel).toContainText('Blocked');
    await expect(jobRecoveryPanel).toContainText('Machine package');
    await expect(jobRecoveryPanel).toContainText('Unavailable');
    await expect(jobRecoveryPanel).toContainText('analysis_module_not_generated');
    await expect(jobRecoveryPanel.locator('.job-recovery-list')).toHaveCount(0);
    const workbench = harness.locator('.analysis-module-workbench');
    await expect(workbench.locator('.analysis-module-list > li')).toHaveCount(7);
    await expect(workbench).toContainText('Not generated');

    const mainType = harness.locator('#book-classification-main-type');
    const firstFocus = harness.locator('#book-classification-focus-1');
    await mainType.selectOption('builtin_main_001_v1');
    await firstFocus.selectOption('builtin_focus_001_v1');
    await harness.getByRole('button', { name: 'Save classification' }).click();
    await expect(harness.getByText('Classification changed in another session')).toBeVisible();
    await expect(mainType).toHaveValue('builtin_main_001_v1');
    await expect(firstFocus).toHaveValue('builtin_focus_001_v1');
    await expect(harness.getByRole('button', { name: 'Retry my selection' })).toBeVisible();
    await harness.getByRole('button', { name: 'Load latest saved classification' }).click();
    await expect(harness.getByText('Classification changed in another session')).toHaveCount(0);
    await expect(mainType).toHaveValue('builtin_main_004_v1');
    await expect(firstFocus).toHaveValue('builtin_focus_005_v1');

    await mainType.selectOption('builtin_main_001_v1');
    await firstFocus.selectOption('builtin_focus_001_v1');
    await page.evaluate(() => (
      window as unknown as { __armTypeLibraryConflict: () => void }
    ).__armTypeLibraryConflict());
    await harness.getByRole('button', { name: 'Save classification' }).click();
    await expect(harness.getByText('Classification changed in another session')).toBeVisible();
    await expect(mainType).toHaveValue('builtin_main_001_v1');
    await expect(firstFocus).toHaveValue('builtin_focus_001_v1');
    await harness.getByRole('button', { name: 'Retry my selection' }).click();
    await expect(harness.getByText('Classification changed in another session')).toHaveCount(0);
    await expect(mainType).toHaveValue('builtin_main_001_v1');
    await expect(firstFocus).toHaveValue('builtin_focus_001_v1');
    await expect(page.evaluate(() => (
      window as unknown as {
        __getTypeLibraryUpdateRequests: () => Array<{ expectedRevision: number }>;
      }
    ).__getTypeLibraryUpdateRequests().map(({ expectedRevision }) => expectedRevision)))
      .resolves.toEqual([1, 2, 3]);

    await page.evaluate(() => (
      window as unknown as { __switchAppRouterLibrary: () => Promise<void> }
    ).__switchAppRouterLibrary());

    await expect(harness.getByText('Library B', { exact: true })).toBeVisible();
    await expect(harness.getByText('Session B book', { exact: true })).toBeVisible();
    await expect(harness.getByText('Session A book', { exact: true })).toHaveCount(0);
    await expect(workbench).toHaveCount(0);
    await harness.getByRole('button', { name: 'Review structure' }).click();
    await expect(jobRecoveryPanel.locator('[data-not-job="true"]')).toHaveCount(1);
    await expect(jobRecoveryPanel).toContainText('analysis_module_needs_rebuild');
    await expect(jobRecoveryPanel).not.toContainText('analysis_module_not_generated');
    await expect(jobRecoveryPanel.locator('.job-recovery-list')).toHaveCount(0);
    const libraryBWorkbench = harness.locator('.analysis-module-workbench');
    await expect(libraryBWorkbench.locator('.analysis-module-list > li')).toHaveCount(7);
    await expect(libraryBWorkbench).toContainText('Needs rebuild');
    await expect(libraryBWorkbench).not.toContainText('Not generated');
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { __hasAppRouterSessionACache: () => boolean }
    ).__hasAppRouterSessionACache())).toBe(false);
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
