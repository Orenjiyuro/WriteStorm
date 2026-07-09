import { chromium, expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  PERSPECTIVE_DEFINITIONS,
  PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES,
} from '../../src/shared/domain';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  resolvePackagedAppPath,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron smoke currently targets Windows and macOS.');

test('shows the no-library empty state in a real Electron window', async () => {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', 'electron-user-data');
  const electronStderr = createElectronStderrBuffer();
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawn(
    resolvePackagedAppPath(),
    [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    {
      env: {
        ...process.env,
        WRITESTORM_DISABLE_HARDWARE_ACCELERATION: '1',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  let appExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;

  appProcess.stderr?.on('data', (chunk: Buffer) => {
    electronStderr.push(chunk);
  });
  appProcess.once('exit', (code, signal) => {
    appExit = { code, signal };
  });

  let browser: Awaited<ReturnType<typeof connectToElectron>> | undefined;
  try {
    browser = await connectToElectron(port, () => appExit);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent('page'));

    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await expect(page.getByText('Create or open a local library')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analysis module contract readout' })).toBeVisible();
    await expect(page.locator('[data-contract-source="shared-domain-analysis"]')).toBeVisible();
    await expect(page.getByText('Source: shared domain contract')).toBeVisible();
    await expect(page.getByText('7 contract modules')).toBeVisible();
    await expect(page.getByText('8 contract modules')).toHaveCount(0);
    await expect(page.getByText('作品结构与分段')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI 约束摘要' })).toBeVisible();
    await expect(page.getByText('Disabled placeholder')).toBeVisible();
    await expect(
      page.getByText('专题视角是跨模块派生视图，不属于 AnalysisModule scope matrix。'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Perspective contract readout' })).toBeVisible();
    const perspectiveReadout = page.locator('[data-contract-source="shared-domain-perspective"]');
    await expect(perspectiveReadout).toBeVisible();
    await expect(perspectiveReadout.getByText('5 derived views')).toBeVisible();
    await expect(perspectiveReadout.getByText('Derived view, not an AnalysisModule').first()).toBeVisible();
    await expect(perspectiveReadout.getByText('not a fact source').first()).toBeVisible();
    await expect(
      perspectiveReadout.getByRole('heading', { name: 'Dependency status shell' }),
    ).toBeVisible();

    for (const perspectiveDefinition of PERSPECTIVE_DEFINITIONS) {
      await expect(perspectiveReadout.getByText(perspectiveDefinition.name)).toBeVisible();
      await expect(perspectiveReadout.getByText(perspectiveDefinition.key).first()).toBeVisible();
    }

    for (const fixture of PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES) {
      await expect(perspectiveReadout.getByText(fixture.perspectiveKey).first()).toBeVisible();
      await expect(perspectiveReadout.getByText(fixture.missingAssetKind).first()).toBeVisible();
      await expect(perspectiveReadout.getByText(fixture.displayStatus).first()).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: 'Technique library contract readout' })).toBeVisible();
    await expect(page.locator('[data-contract-source="shared-domain-technique"]')).toBeVisible();
    await expect(page.getByText('来自已采纳候选')).toBeVisible();
    await expect(page.getByText('Source snapshot secondary information')).toBeVisible();
    await expect(page.getByText('Read-only provenance position')).toBeVisible();
    await expect(page.getByText('Manual primary action unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open library' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Import source' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run analysis' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adopt candidate' })).toHaveCount(0);

    const health = await page.evaluate(() => window.writestorm.internal.health());
    expect(health).toEqual({ ok: true, app: 'WriteStorm' });

    const currentLibraryResponse = await page.evaluate(() => window.writestorm.library.getCurrent());
    expect(currentLibraryResponse).toEqual({
      ok: true,
      data: null,
    });

    const writestormApiShape = await page.evaluate(() => ({
      root: Object.keys(window.writestorm),
      library: Object.keys(window.writestorm.library),
      books: Object.keys(window.writestorm.books),
      structure: Object.keys(window.writestorm.structure),
      modules: Object.keys(window.writestorm.modules),
      jobs: Object.keys(window.writestorm.jobs),
      exports: Object.keys(window.writestorm.exports),
      hasRawInvoke: 'invoke' in window.writestorm,
      hasRawIpcRenderer: 'ipcRenderer' in window.writestorm,
    }));
    expect(writestormApiShape).toEqual({
      root: ['internal', 'library', 'books', 'structure', 'modules', 'jobs', 'exports'],
      library: ['create', 'open', 'getCurrent'],
      books: ['list', 'importSource'],
      structure: ['get', 'updateNode', 'updateStoryRange', 'freeze'],
      modules: ['listInstances', 'updateBody'],
      jobs: ['list', 'get', 'cancel'],
      exports: ['getStatus'],
      hasRawInvoke: false,
      hasRawIpcRenderer: false,
    });

    const productResponse = await page.evaluate(() => window.writestorm.books.list());
    expect(productResponse).toEqual({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Channel books:list is not implemented.',
        recoverable: false,
        details: {
          channel: 'books:list',
        },
      },
    });

    const hasNodeRequire = await page.evaluate(() => 'require' in window);
    expect(hasNodeRequire).toBe(false);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, electronStderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
});

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) {
          resolve(address.port);
        } else {
          reject(new Error('Unable to allocate a local debugging port.'));
        }
      });
    });
  });
}

async function connectToElectron(
  port: number,
  getAppExit?: () => { code: number | null; signal: NodeJS.Signals | null } | undefined,
) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const appExit = getAppExit?.();
    if (appExit) {
      throw new Error(
        `Electron exited before CDP connection (code: ${appExit.code ?? 'null'}, signal: ${appExit.signal ?? 'null'}).`,
      );
    }

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
  if (!processToStop.killed) {
    processToStop.kill();
  }
}
