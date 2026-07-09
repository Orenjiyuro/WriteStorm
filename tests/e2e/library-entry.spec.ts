import { chromium, expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import Database from 'better-sqlite3';
import net from 'node:net';
import path from 'node:path';
import { APP_MIGRATIONS } from '../../src/main/db/migrations';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  resolvePackagedAppPath,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron library entry smoke targets Windows and macOS.');

const currentAppSchemaVersion = APP_MIGRATIONS.at(-1)?.id ?? 0;

test('creates and opens a local library from the desktop entry', async () => {
  const libraryRoot = path.join(process.cwd(), 'test-results', 'electron-library-entry', 'library');
  rmSync(libraryRoot, { recursive: true, force: true });
  mkdirSync(path.dirname(libraryRoot), { recursive: true });

  await withPackagedApp(libraryRoot, 'E2E Library', async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create library' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Create library' }).click();

    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await expect(page.getByText('E2E Library')).toBeVisible();
    await expect(page.getByText('No books yet')).toBeVisible();
    await expect(page.getByText(libraryRoot)).toBeVisible();
  });

  expect(existsSync(path.join(libraryRoot, 'manifest.json'))).toBe(true);
  expect(existsSync(path.join(libraryRoot, 'writestorm.sqlite'))).toBe(true);
  expect(readProductionSchemaVersion(libraryRoot)).toBe(currentAppSchemaVersion);

  await withPackagedApp(libraryRoot, 'Ignored Open Name', async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open library' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Open library' }).click();

    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await expect(page.getByText('E2E Library')).toBeVisible();
    await expect(page.getByText('No books yet')).toBeVisible();
    await expect(page.getByText(libraryRoot)).toBeVisible();
  });
  expect(readProductionSchemaVersion(libraryRoot)).toBe(currentAppSchemaVersion);
});

async function withPackagedApp(
  libraryRoot: string,
  libraryName: string,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', `electron-library-entry-user-data-${port}`);
  const electronStderr = createElectronStderrBuffer();
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawn(
    resolvePackagedAppPath(),
    [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    {
      env: {
        ...process.env,
        WRITESTORM_DISABLE_HARDWARE_ACCELERATION: '1',
        WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
        WRITESTORM_E2E_LIBRARY_ROOT: libraryRoot,
        WRITESTORM_E2E_LIBRARY_NAME: libraryName,
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

    await run(page);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, electronStderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
}

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

function readProductionSchemaVersion(libraryRoot: string): number {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const version = database.prepare('SELECT MAX(id) FROM schema_migrations').pluck().get();

    return typeof version === 'number' ? version : 0;
  } finally {
    database.close();
  }
}
