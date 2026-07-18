import { chromium, expect, test, type Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
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
  spawnPackagedApp,
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

    await page.getByRole('link', { name: 'Technique library' }).click();
    await expect(page.getByRole('heading', { name: 'Technique library' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '来自已采纳候选' })).toBeVisible();
    await expect(page.getByText('No TechniqueEntry persistence or adoption producer is admitted yet.'))
      .toBeVisible();
    await expect(page.getByRole('heading', { name: 'Editing unavailable' })).toBeVisible();
    await expect(page.getByText(
      'TechniqueEntry persistence and the adopted-candidate adoption transaction are not admitted.',
    )).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SourceSnapshot contract' })).toBeVisible();
    await expect(page.getByText(
      'Future TechniqueEntry detail · secondary provenance information',
    )).toBeVisible();
    await expect(page.getByText('Read-only · no write-back')).toBeVisible();
    await expect(page.getByText(
      'Technique Library never updates source observations, candidates, EvidenceAnchors, review state, or the source Breakdown Book.',
    )).toBeVisible();
    await expect(page.getByText(
      'No SourceSnapshot instance is available in this blocked state.',
    )).toBeVisible();
    const adoptCandidate = page.getByRole('button', { name: 'Adopt confirmed candidate' });
    await expect(adoptCandidate).toBeVisible();
    await expect(adoptCandidate).toBeDisabled();
    await expect(adoptCandidate).toHaveAttribute(
      'aria-describedby',
      'technique-adoption-disabled-reason',
    );
    await expect(page.locator('#technique-adoption-disabled-reason')).toHaveText(
      'Unavailable: the reusable-candidate owner, confirmed-candidate query, and atomic adoption transaction are not admitted.',
    );
    await expect(page.locator('main button')).toHaveCount(1);
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.locator('main input, main textarea, main select')).toHaveCount(0);
    await expect(page.getByText(/sourceBookId|sourceCandidateId|capturedAt/)).toHaveCount(0);

    await page.getByRole('link', { name: 'Original shelf' }).click();
    await expect(page.getByRole('heading', { name: 'Original shelf' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create original project' })).toBeDisabled();
    await expect(page.getByText('Original project creation is outside the V1 admitted scope.'))
      .toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('Adopt confirmed candidate');
    await expect(page.getByRole('main')).not.toContainText('SourceSnapshot');

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Local observability' })).toBeVisible();
    await expect(page.getByText('Local only', { exact: true })).toBeVisible();
    await expect(page.getByText('Crash reports', { exact: true })).toBeVisible();
    await expect(page.getByText('Usage statistics', { exact: true })).toBeVisible();
    await expect(page.getByText('Source text snippets', { exact: true })).toBeVisible();
    await expect(page.getByText('Not uploaded by default', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Never recorded or uploaded', { exact: true })).toBeVisible();
    await expect(page.getByText(
      'No local error-summary reader is admitted. This does not mean that no errors occurred.',
    )).toBeVisible();
    await expect(page.getByText('No recent errors', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear local logs' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Manually export logs' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Sample preview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run sample preview' })).toBeDisabled();
    await expect(page.getByText(
      'A template version cannot be published until its sample preview status is passed.',
    )).toBeVisible();
    await expect(page.getByText('codex_sdk_gate_required', { exact: true })).toBeVisible();
    await expect(page.getByText('sample_preview_runtime_not_admitted', { exact: true }))
      .toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publication controls' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish template' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Roll back published version' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Disable template' })).toBeDisabled();
    await expect(page.getByText('sample_preview_not_passed', { exact: true })).toBeVisible();
    await expect(page.getByText('prompt_template_persistence_not_admitted', { exact: true }).first())
      .toBeVisible();
    await expect(page.getByText(
      'These controls only explain state-machine permissions. They execute no transition and never change an existing Book snapshot.',
    )).toBeVisible();
  });

  expect(existsSync(path.join(libraryRoot, 'manifest.json'))).toBe(true);
  expect(existsSync(path.join(libraryRoot, 'writestorm.sqlite'))).toBe(true);
  expect(readProductionSchemaVersion(libraryRoot)).toBe(currentAppSchemaVersion);
  expect(readTechniqueProductionTables(libraryRoot)).toEqual([]);

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

  const appProcess = spawnPackagedApp({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    env: {
      WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
      WRITESTORM_E2E_LIBRARY_ROOT: libraryRoot,
      WRITESTORM_E2E_LIBRARY_NAME: libraryName,
    },
  });
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

function readTechniqueProductionTables(libraryRoot: string): string[] {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const techniqueTableNames = [
      'technique_entries',
      'source_snapshots',
      'reusable_technique_candidates',
      'work_technique_observations',
    ];
    const placeholders = techniqueTableNames.map(() => '?').join(', ');

    return database.prepare(
      `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (${placeholders}) ORDER BY name`,
    ).pluck().all(...techniqueTableNames) as string[];
  } finally {
    database.close();
  }
}
