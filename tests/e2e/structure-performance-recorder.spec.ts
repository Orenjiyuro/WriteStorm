import { chromium, expect, test, type Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { BreakdownBookId } from '../../src/shared/domain';
import {
  STRUCTURE_PERFORMANCE_FIXTURES,
  generateStructurePerformanceFixture,
} from '../../src/main/structure/performance/structure-performance-fixtures';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged structure performance recorder targets Windows and macOS.');
test.setTimeout(120_000);

test('records 50KB/1MB/5MB txt/md detection and keeps the renderer responsive at 5MiB', async () => {
  const resultRoot = path.join(process.cwd(), 'test-results', 'structure-performance');
  rmSync(resultRoot, { recursive: true, force: true });
  mkdirSync(resultRoot, { recursive: true });
  const observations: PerformanceObservation[] = [];

  for (const fixture of STRUCTURE_PERFORMANCE_FIXTURES) {
    const fixturePath = path.join(resultRoot, 'fixtures', `${fixture.name}.${fixture.format}`);
    const libraryRoot = path.join(resultRoot, 'libraries', fixture.name);
    const rawResultPath = path.join(resultRoot, 'raw', `${fixture.name}.json`);
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, generateStructurePerformanceFixture(fixture), 'utf8');

    const observation = await withPackagedApp(
      { fixturePath, libraryRoot, rawResultPath, resultRoot, fixtureName: fixture.name },
      async (page) => {
        await page.getByRole('button', { name: 'Create library' }).click();
        await page.getByRole('button', { name: 'Import source' }).click();
        await expect(page.locator('.book-list').getByText(fixture.name, { exact: true })).toBeVisible();
        const bookId = readBookId(libraryRoot);
        await expect.poll(
          () => readLatestStructureDetectionState(libraryRoot),
          { timeout: 30_000, intervals: [20, 50, 100] },
        ).toBe('completed');
        rmSync(rawResultPath, { force: true });
        const started = await startDetectionHeartbeat(page, bookId);

        await expect.poll(
          () => readJobState(libraryRoot, started.jobId),
          { timeout: 30_000, intervals: [20, 50, 100] },
        ).toBe('completed');
        const heartbeat = await stopDetectionHeartbeat(page);
        await expect.poll(() => existsSync(rawResultPath), { timeout: 5_000 }).toBe(true);

        return {
          fixture: fixture.name,
          expectedBytes: fixture.sizeBytes,
          heartbeat,
          recorder: readLatestRecorderSample(rawResultPath),
        };
      },
    );
    observations.push(observation);
  }

  const baseline = {
    schemaVersion: 1,
    thresholdPolicy: 'observation_only',
    observations,
  };
  writeFileSync(path.join(resultRoot, 'baseline.json'), JSON.stringify(baseline, null, 2), 'utf8');

  expect(observations).toHaveLength(6);
  for (const observation of observations) {
    expect(observation.recorder).toMatchObject({
      thresholdPolicy: 'observation_only',
      samples: [{
        fixture: observation.fixture,
        inputBytes: observation.expectedBytes,
        mainElapsedMs: expect.any(Number),
        workerPid: expect.any(Number),
        worker: {
          durationMs: expect.any(Number),
          maxRssBytes: expect.any(Number),
        },
      }],
    });
  }
  const fiveMiB = observations.filter((observation) => observation.fixture.startsWith('5mb-'));
  for (const observation of fiveMiB) {
    expect(observation.heartbeat.clickAcknowledgedWhileDetectionPending).toBe(true);
    expect(observation.heartbeat.framesWhileDetectionPending).toBeGreaterThan(0);
  }
});

type PerformanceObservation = {
  fixture: string;
  expectedBytes: number;
  heartbeat: {
    clickAcknowledgedWhileDetectionPending: boolean;
    framesWhileDetectionPending: number;
    maxFrameGapMs: number;
  };
  recorder: {
    thresholdPolicy: string;
    samples: unknown[];
  };
};

async function startDetectionHeartbeat(page: Page, bookId: string): Promise<{ jobId: string }> {
  return page.evaluate(async (id) => {
    const probe = {
      active: true,
      frames: 0,
      maxFrameGapMs: 0,
      lastFrameAt: performance.now(),
      clickAcknowledged: false,
      detectionSettled: false,
    };
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      probe.clickAcknowledged = true;
    });
    document.body.append(button);
    const frame = (timestamp: number): void => {
      if (!probe.active) return;
      probe.frames += 1;
      probe.maxFrameGapMs = Math.max(probe.maxFrameGapMs, timestamp - probe.lastFrameAt);
      probe.lastFrameAt = timestamp;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const detection = window.writestorm.structure.detect({ bookId: id as BreakdownBookId });
    button.click();
    const clickAcknowledgedWhileDetectionPending = probe.clickAcknowledged && !probe.detectionSettled;
    const response = await detection.finally(() => {
      probe.detectionSettled = true;
    });
    if (!response.ok) throw new Error(response.error.message);
    (window as typeof window & { __structurePerformanceProbe?: unknown }).__structurePerformanceProbe = {
      probe,
      clickAcknowledgedWhileDetectionPending,
      button,
    };
    return { jobId: response.data.job.id };
  }, bookId);
}

async function stopDetectionHeartbeat(page: Page): Promise<PerformanceObservation['heartbeat']> {
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __structurePerformanceProbe?: {
        probe: { active: boolean; frames: number; maxFrameGapMs: number };
        clickAcknowledgedWhileDetectionPending: boolean;
        button: HTMLButtonElement;
      };
    }).__structurePerformanceProbe;
    if (!state) throw new Error('Missing structure performance heartbeat state.');
    state.probe.active = false;
    state.button.remove();
    return {
      clickAcknowledgedWhileDetectionPending: state.clickAcknowledgedWhileDetectionPending,
      framesWhileDetectionPending: state.probe.frames,
      maxFrameGapMs: state.probe.maxFrameGapMs,
    };
  });
}

async function withPackagedApp<T>(
  options: {
    fixturePath: string;
    libraryRoot: string;
    rawResultPath: string;
    resultRoot: string;
    fixtureName: string;
  },
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const port = await getFreePort();
  const stderr = createElectronStderrBuffer();
  const userDataDir = path.join(options.resultRoot, 'user-data', options.fixtureName);
  mkdirSync(userDataDir, { recursive: true });
  const appProcess = spawnPackagedApp({
    args: [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
    ],
    env: {
      WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
      WRITESTORM_E2E_LIBRARY_ROOT: options.libraryRoot,
      WRITESTORM_E2E_LIBRARY_NAME: `Performance ${options.fixtureName}`,
      WRITESTORM_E2E_IMPORT_DIALOG_STUB: '1',
      WRITESTORM_E2E_IMPORT_SOURCE_PATH: options.fixturePath,
      WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER: '1',
      WRITESTORM_STRUCTURE_PERFORMANCE_RESULT: options.rawResultPath,
    },
  });
  appProcess.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
  let browser: Awaited<ReturnType<typeof connectToElectron>> | undefined;

  try {
    browser = await connectToElectron(port);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    return await run(page);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, stderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
}

function readBookId(libraryRoot: string): string {
  const database = openLibraryDatabase(libraryRoot);
  try {
    return database.prepare('SELECT id FROM books LIMIT 1').pluck().get() as string;
  } finally {
    database.close();
  }
}

function readJobState(libraryRoot: string, jobId: string): string | undefined {
  const database = openLibraryDatabase(libraryRoot);
  try {
    return database.prepare('SELECT state FROM jobs WHERE id = ?').pluck().get(jobId) as string | undefined;
  } finally {
    database.close();
  }
}

function readLatestStructureDetectionState(libraryRoot: string): string | undefined {
  const database = openLibraryDatabase(libraryRoot);
  try {
    return database.prepare(`SELECT job.state FROM structure_detection_runs run
      JOIN jobs job ON job.id = run.job_id
      ORDER BY run.run_sequence DESC LIMIT 1`).pluck().get() as string | undefined;
  } finally {
    database.close();
  }
}

function readLatestRecorderSample(rawResultPath: string): PerformanceObservation['recorder'] {
  const recorder = JSON.parse(readFileSync(rawResultPath, 'utf8')) as PerformanceObservation['recorder'];
  const latest = recorder.samples.at(-1);
  if (!latest) throw new Error('Expected a structure performance recorder sample.');
  return { ...recorder, samples: [latest] };
}

function openLibraryDatabase(libraryRoot: string): Database.Database {
  return new Database(path.join(libraryRoot, 'writestorm.sqlite'), { readonly: true, fileMustExist: true });
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

async function connectToElectron(port: number) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not connect to ${endpoint}`);
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.killed) processToStop.kill();
}
