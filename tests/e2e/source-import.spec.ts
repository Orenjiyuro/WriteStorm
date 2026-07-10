import { chromium, expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import Database from 'better-sqlite3';
import net from 'node:net';
import path from 'node:path';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  resolvePackagedAppPath,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron source import smoke targets Windows and macOS.');

test('imports a txt/md source through the packaged desktop entry using a main-process dialog stub', async () => {
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-source-import');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const sourcePath = path.join(fixtureRoot, 'Packaged Fixture.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(sourcePath, '# Packaged Fixture\nImported from packaged e2e.\n');

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await page.getByRole('button', { name: 'Create library' }).click();

    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import source' })).toBeVisible();
    await page.getByRole('button', { name: 'Import source' }).click();

    await expect(page.getByText('Packaged Fixture', { exact: true })).toBeVisible();
    await expect(page.getByText('Packaged Fixture.md')).toBeVisible();
    await expect(page.getByText('Source imported.')).toBeVisible();
  });

  const importRows = readImportRows(libraryRoot);
  expect(importRows.books).toEqual([{
    id: expect.any(String),
    title: 'Packaged Fixture',
    source_text_id: expect.any(String),
  }]);
  expect(importRows.sourceTexts).toEqual([{
    id: importRows.books[0].source_text_id,
    original_file_name: 'Packaged Fixture.md',
    relative_path: `source/${importRows.books[0].source_text_id}/Packaged Fixture.md`,
  }]);
  const copiedPath = path.join(libraryRoot, importRows.sourceTexts[0].relative_path);
  expect(existsSync(copiedPath)).toBe(true);
  expect(readFileSync(copiedPath, 'utf8')).toBe('# Packaged Fixture\nImported from packaged e2e.\n');
});

async function withPackagedApp(
  libraryRoot: string,
  sourcePath: string,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', `electron-source-import-user-data-${port}`);
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
        WRITESTORM_E2E_LIBRARY_NAME: 'E2E Import Library',
        WRITESTORM_E2E_IMPORT_DIALOG_STUB: '1',
        WRITESTORM_E2E_IMPORT_SOURCE_PATH: sourcePath,
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

function readImportRows(libraryRoot: string): {
  books: Array<{
    id: string;
    title: string;
    source_text_id: string;
  }>;
  sourceTexts: Array<{
    id: string;
    original_file_name: string;
    relative_path: string;
  }>;
} {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    return {
      books: database.prepare('SELECT id, title, source_text_id FROM books ORDER BY id').all() as Array<{
        id: string;
        title: string;
        source_text_id: string;
      }>,
      sourceTexts: database.prepare(`
        SELECT id, original_file_name, relative_path
        FROM source_texts
        ORDER BY id
      `).all() as Array<{
        id: string;
        original_file_name: string;
        relative_path: string;
      }>,
    };
  } finally {
    database.close();
  }
}
