import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  SourceTextWorkerRunner,
  type ForkSourceTextUtilityProcess,
  type SourceTextUtilityProcessHandle,
} from '../../src/main/source-text/worker-runner';
import type { SourceTextWorkerRequest } from '../../src/main/source-text/worker-protocol';

class FakeSourceTextProcess extends EventEmitter implements SourceTextUtilityProcessHandle {
  readonly pid = 4242;

  constructor(
    private readonly respond: (
      request: SourceTextWorkerRequest,
      process: FakeSourceTextProcess,
    ) => void,
  ) {
    super();
    queueMicrotask(() => this.emit('spawn'));
  }

  postMessage(message: unknown): void {
    this.respond(message as SourceTextWorkerRequest, this);
  }

  kill(): boolean {
    return true;
  }
}

describe('SourceTextWorkerRunner', () => {
  it('preserves a stable worker error code for encoding retry decisions', async () => {
    const fork: ForkSourceTextUtilityProcess = () => new FakeSourceTextProcess(
      (request, process) => queueMicrotask(() => process.emit('message', {
        version: 1,
        requestId: request.requestId,
        command: 'prepare-import',
        ok: false,
        workerPid: process.pid,
        error: {
          code: 'SOURCE_TEXT_ENCODING_REQUIRED',
          message: 'raw decoder details must not escape',
        },
      })),
    );
    const runner = new SourceTextWorkerRunner({
      modulePath: 'worker-entry.js',
      fork,
      createRequestId: () => 'request-1',
    });

    await expect(runner.prepareImport({
      jobId: 'job-1',
      sourcePath: 'C:\\source.txt',
      libraryRootPath: 'C:\\library',
      maxSizeBytes: 1024,
      encoding: 'utf-8',
    }, 100)).rejects.toMatchObject({
      code: 'SOURCE_IMPORT_WORKER_FAILED',
      reason: 'worker_error',
      workerErrorCode: 'SOURCE_TEXT_ENCODING_REQUIRED',
      message: 'Source import worker could not prepare the selected file.',
    });
  });
});
