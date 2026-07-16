import { expect, test } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron utility worker probe targets Windows and macOS.');

test('packaged Electron runs and cleans up the typed structure utility worker', async () => {
  const resultRoot = path.join(process.cwd(), 'test-results', 'electron-structure-worker-probe');
  const resultPath = path.join(resultRoot, 'probe-result.json');
  const userDataDir = path.join(resultRoot, 'user-data');
  const stderr = createElectronStderrBuffer();
  rmSync(resultRoot, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawnPackagedApp({
    args: [`--user-data-dir=${userDataDir}`, '--disable-gpu'],
    env: {
      WRITESTORM_STRUCTURE_WORKER_PROBE: '1',
      WRITESTORM_STRUCTURE_WORKER_PROBE_RESULT: resultPath,
    },
  });
  const appExit = waitForExit(appProcess);
  appProcess.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));

  try {
    await expect.poll(
      () => existsSync(resultPath),
      { timeout: 10_000, intervals: [50, 100, 250] },
    ).toBe(true);

    const result = JSON.parse(readFileSync(resultPath, 'utf8')) as {
      ok: boolean;
      modulePath: string;
      modulePathExists: boolean;
      detectionRoundTrip: {
        workerPid: number;
        result: {
          structure: {
            status: string;
            nodes: Array<{ kind: string; title: string }>;
          };
          storyRanges: {
            status: string;
            ranges: Array<{ coveredChapterIds: string[] }>;
          } | null;
        };
      };
      timeoutCode: string;
      crashCode: string;
      cleanupWorkerPid: number;
      activeBeforeQuit: number;
    };

    expect(result).toMatchObject({
      ok: true,
      modulePath: expect.stringMatching(/structure-worker-entry\.js$/),
      modulePathExists: true,
      detectionRoundTrip: {
        workerPid: expect.any(Number),
        result: {
          structure: {
            status: 'candidate_ready',
            nodes: [
              { kind: 'book', title: 'Packaged worker fixture' },
              { kind: 'chapter', title: 'Chapter 1: Start' },
              { kind: 'chapter', title: 'Chapter 2: Continue' },
              { kind: 'chapter', title: 'Chapter 3: Aftermath' },
            ],
          },
          storyRanges: {
            status: 'needs_manual_review',
            ranges: [{
              coveredChapterIds: expect.any(Array),
            }],
          },
        },
      },
      timeoutCode: 'UTILITY_WORKER_TIMEOUT',
      crashCode: 'UTILITY_WORKER_CRASH',
      cleanupWorkerPid: expect.any(Number),
      activeBeforeQuit: 1,
    });

    await expect.poll(() => isProcessAlive(result.cleanupWorkerPid), { timeout: 5_000 }).toBe(false);
    stopProcess(appProcess);
    const exit = await withTimeout(appExit, 5_000, 'Packaged worker probe launcher did not stop.');
    expect(exit.code !== null || exit.signal !== null).toBe(true);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, stderr.summary());
  } finally {
    stopProcess(appProcess);
  }
});

function waitForExit(processToWaitFor: ChildProcess): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}> {
  return new Promise((resolve) => {
    processToWaitFor.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.killed) {
    processToStop.kill();
  }
}
