import { expect, test } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron source-text worker probe targets Windows and macOS.');

test('packaged Electron runs and reaps the source-text utility worker', async () => {
  const resultRoot = path.join(process.cwd(), 'test-results', 'electron-source-text-worker-probe');
  const resultPath = path.join(resultRoot, 'probe-result.json');
  const userDataDir = path.join(resultRoot, 'user-data');
  const stderr = createElectronStderrBuffer();
  rmSync(resultRoot, { recursive: true, force: true });
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawnPackagedApp({
    args: [`--user-data-dir=${userDataDir}`],
    env: {
      WRITESTORM_SOURCE_TEXT_WORKER_PROBE: '1',
      WRITESTORM_SOURCE_TEXT_WORKER_PROBE_RESULT: resultPath,
    },
  });
  const appExit = waitForExit(appProcess);
  appProcess.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));

  try {
    await expect.poll(() => existsSync(resultPath), {
      timeout: 10_000,
      intervals: [50, 100, 250],
    }).toBe(true);
    const result = JSON.parse(readFileSync(resultPath, 'utf8')) as Record<string, unknown>;
    expect(result).toMatchObject({
      ok: true,
      modulePath: expect.stringMatching(/worker-entry\.js$/),
      modulePathExists: true,
      workerPid: expect.any(Number),
      workerReaped: true,
      stagingRelativePath: 'source/.staging/packaged-probe.tmp',
      stagingText: '# Packaged source worker\n正文\n',
      sizeBytes: Buffer.byteLength('# Packaged source worker\n正文\n'),
      contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      encoding: 'utf-8',
    });
    stopProcess(appProcess);
    await expect(withTimeout(appExit, 10_000)).resolves.toBeDefined();
  } catch (error) {
    throw formatErrorWithElectronStderr(error, stderr.summary());
  } finally {
    stopProcess(appProcess);
  }
});

function waitForExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Packaged source worker probe did not exit.')), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error: unknown) => { clearTimeout(timeout); reject(error); },
    );
  });
}

function stopProcess(child: ChildProcess): void {
  if (!child.killed) child.kill();
}
