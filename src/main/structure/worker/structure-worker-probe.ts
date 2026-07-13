import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  UtilityWorkerRunner,
  UtilityWorkerRunnerError,
} from './structure-worker-runner';

export const WRITESTORM_STRUCTURE_WORKER_PROBE_ENV = 'WRITESTORM_STRUCTURE_WORKER_PROBE';
export const WRITESTORM_STRUCTURE_WORKER_PROBE_RESULT_ENV = 'WRITESTORM_STRUCTURE_WORKER_PROBE_RESULT';

export type StructureWorkerProbeOptions = {
  readonly runner: UtilityWorkerRunner;
  readonly env?: NodeJS.ProcessEnv;
  readonly quitApp: () => void | Promise<void>;
};

export async function runOptionalStructureWorkerProbe(
  options: StructureWorkerProbeOptions,
): Promise<void> {
  const env = options.env ?? process.env;
  if (env[WRITESTORM_STRUCTURE_WORKER_PROBE_ENV] !== '1') {
    return;
  }

  try {
    const detectionRoundTrip = await options.runner.detect({
      bookTitle: 'Packaged worker fixture',
      sourceText: [
        'Chapter 1: Start',
        'Body',
        'Chapter 2: Continue',
        'Body',
        '',
        '---',
        '',
        'Chapter 3: Aftermath',
        'Body',
      ].join('\n'),
    }, 5_000);
    const timeoutCode = await captureExpectedFailureCode(() => options.runner.hang(100));
    const crashCode = await captureExpectedFailureCode(() => options.runner.crash(5_000));
    const cleanup = options.runner.hang(60_000).catch(() => undefined);
    const cleanupWorkerPid = await waitForWorkerPid(options.runner, 5_000);
    const result = {
      ok: true,
      modulePath: options.runner.workerModulePath,
      modulePathExists: existsSync(options.runner.workerModulePath),
      detectionRoundTrip,
      timeoutCode,
      crashCode,
      cleanupWorkerPid,
      activeBeforeQuit: options.runner.activeCount,
    };

    writeProbeResult(env, result);
    console.error('WRITESTORM_STRUCTURE_WORKER_PROBE ok');
    const disposedPids = options.runner.dispose();
    await cleanup;
    await Promise.all(disposedPids.map((pid) => waitForProcessExit(pid, 5_000)));
    await options.quitApp();
  } catch (error) {
    writeProbeResult(env, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    await options.quitApp();
  }
}

async function captureExpectedFailureCode(
  operation: () => Promise<never>,
): Promise<string> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof UtilityWorkerRunnerError) {
      return error.code;
    }

    throw error;
  }

  throw new Error('Utility worker probe operation unexpectedly completed.');
}

async function waitForWorkerPid(runner: UtilityWorkerRunner, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const workerPid = runner.activePids[0];
    if (workerPid !== undefined) {
      return workerPid;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Utility worker did not expose a process id before the probe timeout.');
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Utility worker ${pid} did not exit after disposal.`);
}

function writeProbeResult(env: NodeJS.ProcessEnv, result: object): void {
  const resultPath = env[WRITESTORM_STRUCTURE_WORKER_PROBE_RESULT_ENV];
  if (!resultPath) {
    return;
  }

  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(result), 'utf8');
}
