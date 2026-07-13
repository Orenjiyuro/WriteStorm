import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
  isSourceTextWorkerRequest,
  isSourceTextWorkerResponse,
  type SourceTextWorkerRequest,
} from '../../src/main/source-text/worker-protocol';
import { prepareSourceImport } from '../../src/main/source-text/worker-entry';
import {
  SourceTextWorkerRunner,
  SourceTextWorkerRunnerError,
  resolveSourceTextWorkerModulePath,
  type ForkSourceTextUtilityProcess,
  type SourceTextUtilityProcessHandle,
} from '../../src/main/source-text/worker-runner';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('source-text worker protocol', () => {
  const request = {
    version: 1,
    origin: 'main',
    requestId: 'request-1',
    command: 'prepare-import',
    input: {
      jobId: 'job-1',
      sourcePath: 'C:\\selected\\example.md',
      libraryRootPath: 'C:\\library',
      maxSizeBytes: 1024,
      encoding: 'utf-8',
    },
  } as const;

  it('accepts strict versioned prepare-import and cancel requests', () => {
    expect(isSourceTextWorkerRequest(request)).toBe(true);
    expect(isSourceTextWorkerRequest({
      version: 1,
      origin: 'main',
      requestId: 'cancel-1',
      command: 'cancel',
      targetRequestId: 'request-1',
    })).toBe(true);
  });

  it('rejects unknown versions, extra fields, unsafe job ids, and renderer-originated paths', () => {
    expect(isSourceTextWorkerRequest({ ...request, version: 2 })).toBe(false);
    expect(isSourceTextWorkerRequest({ ...request, rendererPath: 'C:\\leak.txt' })).toBe(false);
    expect(isSourceTextWorkerRequest({ ...request, origin: 'renderer' })).toBe(false);
    expect(isSourceTextWorkerRequest({
      ...request,
      input: { ...request.input, jobId: '..\\escape', filePath: 'C:\\renderer.txt' },
    })).toBe(false);
  });

  it('accepts strict success/error results and rejects extra response fields', () => {
    const success = {
      version: 1,
      requestId: 'request-1',
      command: 'prepare-import',
      ok: true,
      workerPid: 4242,
      result: {
        stagingRelativePath: 'source/.staging/job-1.tmp',
        sizeBytes: 12,
        contentHash: `sha256:${'a'.repeat(64)}`,
        encoding: 'utf-8',
      },
    } as const;
    const failure = {
      version: 1,
      requestId: 'request-1',
      command: 'prepare-import',
      ok: false,
      workerPid: 4242,
      error: {
        code: 'SOURCE_TEXT_ENCODING_REQUIRED',
        message: 'Source text encoding requires explicit selection.',
      },
    } as const;

    expect(isSourceTextWorkerResponse(success)).toBe(true);
    expect(isSourceTextWorkerResponse(failure)).toBe(true);
    expect(isSourceTextWorkerResponse({ ...success, sourcePath: 'C:\\leak.txt' })).toBe(false);
    expect(isSourceTextWorkerResponse({ ...failure, internalError: 'decoder stack' })).toBe(false);
  });
});

describe('source-text worker processing', () => {
  it('bounded-reads, fatally decodes, hashes, and writes one wx staging file', () => {
    const rootPath = tempDirectory();
    const sourcePath = path.join(rootPath, 'selected.md');
    writeFileSync(sourcePath, '# 章节\n正文', 'utf8');

    const result = prepareSourceImport({
      jobId: 'job-prepare',
      sourcePath,
      libraryRootPath: rootPath,
      maxSizeBytes: 1024,
      encoding: 'utf-8',
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        stagingRelativePath: 'source/.staging/job-prepare.tmp',
        sizeBytes: Buffer.byteLength('# 章节\n正文'),
        contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        encoding: 'utf-8',
      },
    });
    expect(readFileSync(path.join(rootPath, 'source', '.staging', 'job-prepare.tmp'), 'utf8'))
      .toBe('# 章节\n正文');
  });

  it('rejects max-size+1, invalid encoding, and an existing staging target', () => {
    const rootPath = tempDirectory();
    const sourcePath = path.join(rootPath, 'selected.txt');
    writeFileSync(sourcePath, Buffer.from([0xff, 0xff]));

    expect(prepareSourceImport({
      jobId: 'job-too-large', sourcePath, libraryRootPath: rootPath, maxSizeBytes: 1, encoding: 'utf-8',
    })).toMatchObject({ ok: false, error: { code: 'SOURCE_FILE_TOO_LARGE' } });
    expect(prepareSourceImport({
      jobId: 'job-encoding', sourcePath, libraryRootPath: rootPath, maxSizeBytes: 2, encoding: 'utf-8',
    })).toMatchObject({ ok: false, error: { code: 'SOURCE_TEXT_ENCODING_REQUIRED' } });

    writeFileSync(sourcePath, 'ok', 'utf8');
    const stagingPath = path.join(rootPath, 'source', '.staging', 'job-conflict.tmp');
    mkdirSync(path.dirname(stagingPath), { recursive: true });
    writeFileSync(stagingPath, 'existing', { flag: 'wx' });
    expect(prepareSourceImport({
      jobId: 'job-conflict', sourcePath, libraryRootPath: rootPath, maxSizeBytes: 2, encoding: 'utf-8',
    })).toMatchObject({ ok: false, error: { code: 'SOURCE_STAGING_CONFLICT' } });
    expect(readFileSync(stagingPath, 'utf8')).toBe('existing');
  });
});

describe('source-text worker runner', () => {
  it('resolves the packaged worker and returns a typed success', async () => {
    expect(resolveSourceTextWorkerModulePath('C:\\app\\.vite\\build')).toBe(
      path.join('C:\\app\\.vite\\build', 'worker-entry.js'),
    );
    const { fork, processes } = fakeFork((request, process) => {
      process.emit('message', {
        version: SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        command: 'prepare-import',
        ok: true,
        workerPid: process.pid,
        result: {
          stagingRelativePath: 'source/.staging/job-runner.tmp',
          sizeBytes: 3,
          contentHash: `sha256:${'b'.repeat(64)}`,
          encoding: 'utf-8',
        },
      });
    });
    const runner = new SourceTextWorkerRunner({
      modulePath: 'worker-entry.js', fork, createRequestId: () => 'request-runner',
    });

    await expect(runner.prepareImport(workerInput('job-runner'), 100)).resolves.toMatchObject({
      stagingRelativePath: 'source/.staging/job-runner.tmp',
      workerPid: 4242,
    });
    expect(processes[0].killed).toBe(true);
  });

  it.each([
    ['timeout', undefined],
    ['crash', 27],
  ] as const)('maps %s to a stable worker failure and removes incomplete staging', async (_case, exitCode) => {
    const rootPath = tempDirectory();
    const stagingPath = createIncompleteStaging(rootPath, 'job-cleanup');
    const { fork } = fakeFork((_request, process) => {
      if (exitCode !== undefined) queueMicrotask(() => process.emit('exit', exitCode));
    });
    const runner = new SourceTextWorkerRunner({
      modulePath: 'worker-entry.js', fork, createRequestId: () => 'request-cleanup',
    });

    await expect(runner.prepareImport(workerInput('job-cleanup', rootPath), 5)).rejects.toMatchObject({
      code: 'SOURCE_IMPORT_WORKER_FAILED',
      reason: exitCode === undefined ? 'timeout' : 'crash',
    } satisfies Partial<SourceTextWorkerRunnerError>);
    expect(existsSync(stagingPath)).toBe(false);
  });

  it('cancels through AbortSignal, kills the worker, and removes incomplete staging', async () => {
    const rootPath = tempDirectory();
    const stagingPath = createIncompleteStaging(rootPath, 'job-cancel');
    const { fork, processes } = fakeFork(() => undefined);
    const runner = new SourceTextWorkerRunner({
      modulePath: 'worker-entry.js', fork, createRequestId: () => 'request-cancel',
    });
    const controller = new AbortController();
    const pending = runner.prepareImport(workerInput('job-cancel', rootPath), 10_000, {
      signal: controller.signal,
    });
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'SOURCE_IMPORT_WORKER_FAILED', reason: 'cancelled',
    } satisfies Partial<SourceTextWorkerRunnerError>);
    expect(processes[0].killed).toBe(true);
    expect(existsSync(stagingPath)).toBe(false);
  });
});

class FakeUtilityProcess extends EventEmitter implements SourceTextUtilityProcessHandle {
  readonly pid = 4242;
  killed = false;

  constructor(private readonly onRequest: (request: SourceTextWorkerRequest, process: FakeUtilityProcess) => void) {
    super();
    queueMicrotask(() => this.emit('spawn'));
  }

  postMessage(message: unknown): void {
    this.onRequest(message as SourceTextWorkerRequest, this);
  }

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function fakeFork(onRequest: (request: SourceTextWorkerRequest, process: FakeUtilityProcess) => void): {
  fork: ForkSourceTextUtilityProcess;
  processes: FakeUtilityProcess[];
} {
  const processes: FakeUtilityProcess[] = [];
  return {
    processes,
    fork: () => {
      const process = new FakeUtilityProcess(onRequest);
      processes.push(process);
      return process;
    },
  };
}

function workerInput(jobId: string, libraryRootPath = tempDirectory()) {
  return {
    jobId,
    sourcePath: path.join(libraryRootPath, 'selected.md'),
    libraryRootPath,
    maxSizeBytes: 1024,
    encoding: 'utf-8' as const,
  };
}

function createIncompleteStaging(rootPath: string, jobId: string): string {
  const stagingPath = path.join(rootPath, 'source', '.staging', `${jobId}.tmp`);
  mkdirSync(path.dirname(stagingPath), { recursive: true });
  writeFileSync(stagingPath, 'incomplete', { flag: 'wx' });
  return stagingPath;
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-worker-'));
  tempDirs.push(directory);
  return directory;
}
