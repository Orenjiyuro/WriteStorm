import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { utilityProcess } from 'electron';
import {
  SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
  isSourceTextWorkerResponse,
  type PrepareSourceImportInput,
  type PrepareSourceImportResult,
  type SourceTextWorkerErrorCode,
  type SourceTextWorkerRequest,
} from './worker-protocol';

export type SourceTextUtilityProcessHandle = {
  readonly pid: number | undefined;
  on(event: 'spawn', listener: () => void): unknown;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  removeListener(event: 'spawn', listener: () => void): unknown;
  removeListener(event: 'message', listener: (message: unknown) => void): unknown;
  removeListener(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: unknown): void;
  kill(): boolean;
};

export type ForkSourceTextUtilityProcess = (
  modulePath: string,
  args: string[],
  options: { readonly serviceName: string; readonly stdio: 'pipe' },
) => SourceTextUtilityProcessHandle;

export type SourceTextWorkerFailureReason =
  | 'timeout'
  | 'crash'
  | 'cancelled'
  | 'protocol'
  | 'worker_error';

export class SourceTextWorkerRunnerError extends Error {
  readonly code = 'SOURCE_IMPORT_WORKER_FAILED' as const;
  readonly reason: SourceTextWorkerFailureReason;
  readonly workerErrorCode?: SourceTextWorkerErrorCode;

  constructor(
    reason: SourceTextWorkerFailureReason,
    message: string,
    workerErrorCode?: SourceTextWorkerErrorCode,
  ) {
    super(message);
    this.name = 'SourceTextWorkerRunnerError';
    this.reason = reason;
    this.workerErrorCode = workerErrorCode;
  }
}

export class SourceTextWorkerRunner {
  private readonly modulePath: string;
  private readonly fork: ForkSourceTextUtilityProcess;
  private readonly createRequestId: () => string;

  constructor(options: {
    readonly modulePath: string;
    readonly fork?: ForkSourceTextUtilityProcess;
    readonly createRequestId?: () => string;
  }) {
    this.modulePath = options.modulePath;
    this.fork = options.fork ?? electronFork;
    this.createRequestId = options.createRequestId ?? randomUUID;
  }

  prepareImport(
    input: PrepareSourceImportInput,
    timeoutMs: number,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<PrepareSourceImportResult & { readonly workerPid: number }> {
    const request: SourceTextWorkerRequest = {
      version: SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
      origin: 'main',
      requestId: this.createRequestId(),
      command: 'prepare-import',
      input,
    };
    const stagingPath = path.join(
      input.libraryRootPath,
      'source',
      '.staging',
      `${input.jobId}.tmp`,
    );

    if (options.signal?.aborted) {
      removeIncompleteStaging(stagingPath);
      return Promise.reject(workerFailure('cancelled'));
    }

    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Source Import Worker',
      stdio: 'pipe',
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cleanup = (): void => {
        if (timeout !== undefined) clearTimeout(timeout);
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
        options.signal?.removeEventListener('abort', onAbort);
      };
      const rejectFailure = (error: SourceTextWorkerRunnerError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        removeIncompleteStaging(stagingPath);
        reject(error);
      };
      const onSpawn = (): void => {
        timeout = setTimeout(() => {
          rejectFailure(workerFailure('timeout'));
          child.kill();
        }, timeoutMs);
        child.postMessage(request);
      };
      const onMessage = (message: unknown): void => {
        if (settled) return;
        if (!isSourceTextWorkerResponse(message) ||
          message.command !== 'prepare-import' ||
          message.requestId !== request.requestId) {
          rejectFailure(workerFailure('protocol'));
          child.kill();
          return;
        }
        if (!message.ok) {
          rejectFailure(workerFailure('worker_error', message.error.code));
          child.kill();
          return;
        }
        settled = true;
        cleanup();
        resolve({ ...message.result, workerPid: message.workerPid });
        child.kill();
      };
      const onExit = (): void => rejectFailure(workerFailure('crash'));
      const onAbort = (): void => {
        rejectFailure(workerFailure('cancelled'));
        child.kill();
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
      options.signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

function workerFailure(
  reason: SourceTextWorkerFailureReason,
  workerErrorCode?: SourceTextWorkerErrorCode,
): SourceTextWorkerRunnerError {
  const messages = {
    timeout: 'Source import worker timed out.',
    crash: 'Source import worker exited before responding.',
    cancelled: 'Source import worker was cancelled.',
    protocol: 'Source import worker returned an invalid response.',
    worker_error: 'Source import worker could not prepare the selected file.',
  } as const;
  return new SourceTextWorkerRunnerError(reason, messages[reason], workerErrorCode);
}

function removeIncompleteStaging(stagingPath: string): void {
  try {
    rmSync(stagingPath, { force: true });
  } catch {
    // Cleanup is best effort; source health reports stale staging in Task 14.
  }
}

export function resolveSourceTextWorkerModulePath(mainBundleDirectory: string): string {
  return path.join(mainBundleDirectory, 'worker-entry.js');
}

export function createElectronSourceTextWorkerRunner(mainBundleDirectory: string): SourceTextWorkerRunner {
  return new SourceTextWorkerRunner({
    modulePath: resolveSourceTextWorkerModulePath(mainBundleDirectory),
  });
}

const electronFork: ForkSourceTextUtilityProcess = (modulePath, args, options) => (
  utilityProcess.fork(modulePath, args, options) as SourceTextUtilityProcessHandle
);
