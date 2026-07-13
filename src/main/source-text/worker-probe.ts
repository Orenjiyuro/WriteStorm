import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createElectronSourceTextWorkerRunner,
  resolveSourceTextWorkerModulePath,
} from './worker-runner';

export const SOURCE_TEXT_WORKER_PROBE_ENV = 'WRITESTORM_SOURCE_TEXT_WORKER_PROBE';
export const SOURCE_TEXT_WORKER_PROBE_RESULT_ENV = 'WRITESTORM_SOURCE_TEXT_WORKER_PROBE_RESULT';

export async function runOptionalSourceTextWorkerProbe(options: {
  readonly mainBundleDirectory: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly quitApp: () => void;
}): Promise<void> {
  const env = options.env ?? process.env;
  if (env[SOURCE_TEXT_WORKER_PROBE_ENV] !== '1') return;

  const resultPath = env[SOURCE_TEXT_WORKER_PROBE_RESULT_ENV];
  if (!resultPath) throw new Error('Source-text worker probe result path is required.');

  const probeRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-worker-probe-'));
  const sourcePath = path.join(probeRoot, 'probe.md');
  const sourceText = '# Packaged source worker\n正文\n';
  const modulePath = resolveSourceTextWorkerModulePath(options.mainBundleDirectory);
  const runner = createElectronSourceTextWorkerRunner(options.mainBundleDirectory);

  try {
    writeFileSync(sourcePath, sourceText, 'utf8');
    const prepared = await runner.prepareImport({
      jobId: 'packaged-probe',
      sourcePath,
      libraryRootPath: probeRoot,
      maxSizeBytes: 1024,
      encoding: 'utf-8',
    }, 5_000);
    const stagingPath = path.join(probeRoot, ...prepared.stagingRelativePath.split('/'));
    const workerReaped = await waitForProcessExit(prepared.workerPid, 5_000);

    mkdirSync(path.dirname(resultPath), { recursive: true });
    writeFileSync(resultPath, JSON.stringify({
      ok: true,
      modulePath,
      modulePathExists: existsSync(modulePath),
      workerPid: prepared.workerPid,
      workerReaped,
      stagingRelativePath: prepared.stagingRelativePath,
      stagingText: readFileSync(stagingPath, 'utf8'),
      sizeBytes: prepared.sizeBytes,
      contentHash: prepared.contentHash,
      encoding: prepared.encoding,
    }), 'utf8');
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
    options.quitApp();
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isProcessAlive(pid);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
