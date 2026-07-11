import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { utilityProcess } from 'electron';
import {
  STRUCTURE_WORKER_PROTOCOL_VERSION,
  isUtilityWorkerResponse,
  type UtilityWorkerRequest,
  type UtilityWorkerResponse,
  type StructureWorkerDetectionInput,
  type StructureWorkerDetectionResult,
  type StructureWorkerDetectionTelemetry,
} from './structure-worker-protocol';

export type { UtilityWorkerRequest } from './structure-worker-protocol';

export type UtilityProcessHandle = {
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

export type ForkUtilityProcess = (
  modulePath: string,
  args: string[],
  options: {
    readonly serviceName: string;
    readonly stdio: 'pipe';
  },
) => UtilityProcessHandle;

export type UtilityWorkerRunnerErrorCode =
  | 'UTILITY_WORKER_TIMEOUT'
  | 'UTILITY_WORKER_CRASH'
  | 'UTILITY_WORKER_CANCELLED'
  | 'UTILITY_WORKER_PROTOCOL'
  | 'UTILITY_WORKER_DISPOSED';

export class UtilityWorkerRunnerError extends Error {
  readonly code: UtilityWorkerRunnerErrorCode;

  constructor(code: UtilityWorkerRunnerErrorCode, message: string) {
    super(message);
    this.name = 'UtilityWorkerRunnerError';
    this.code = code;
  }
}

type ActiveOperation = {
  readonly process: UtilityProcessHandle;
  readonly reject: (error: UtilityWorkerRunnerError) => void;
  settled: boolean;
  timeout: ReturnType<typeof setTimeout> | undefined;
  cleanup: () => void;
};

export type UtilityWorkerRunnerOptions = {
  readonly modulePath: string;
  readonly fork?: ForkUtilityProcess;
  readonly createRequestId?: () => string;
  readonly now?: () => number;
  readonly onDetectionComplete?: (sample: StructureWorkerPerformanceSample) => void;
};

export type StructureWorkerPerformanceSample = {
  readonly input: StructureWorkerDetectionInput;
  readonly mainElapsedMs: number;
  readonly workerPid: number;
  readonly telemetry: StructureWorkerDetectionTelemetry;
};

export class UtilityWorkerRunner {
  private readonly modulePath: string;
  private readonly fork: ForkUtilityProcess;
  private readonly createRequestId: () => string;
  private readonly now: () => number;
  private readonly onDetectionComplete?: (sample: StructureWorkerPerformanceSample) => void;
  private readonly activeOperations = new Set<ActiveOperation>();
  private disposed = false;

  constructor(options: UtilityWorkerRunnerOptions) {
    this.modulePath = options.modulePath;
    this.fork = options.fork ?? electronForkUtilityProcess;
    this.createRequestId = options.createRequestId ?? randomUUID;
    this.now = options.now ?? (() => performance.now());
    this.onDetectionComplete = options.onDetectionComplete;
  }

  get activeCount(): number {
    return this.activeOperations.size;
  }

  get workerModulePath(): string {
    return this.modulePath;
  }

  get activePids(): number[] {
    return [...this.activeOperations]
      .map((operation) => operation.process.pid)
      .filter((pid): pid is number => typeof pid === 'number');
  }

  async echo(payload: string, timeoutMs: number): Promise<{ payload: string; workerPid: number }> {
    const response = await this.run({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: this.createRequestId(),
      command: 'echo',
      payload,
    }, timeoutMs);

    if (response.command !== 'echo') {
      throw new UtilityWorkerRunnerError(
        'UTILITY_WORKER_PROTOCOL',
        'Echo worker response used the wrong command.',
      );
    }

    return {
      payload: response.payload,
      workerPid: response.workerPid,
    };
  }

  async detect(
    input: StructureWorkerDetectionInput,
    timeoutMs: number,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<{
    result: StructureWorkerDetectionResult;
    workerPid: number;
    telemetry: StructureWorkerDetectionTelemetry;
  }> {
    const startedAt = this.now();
    const response = await this.run({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: this.createRequestId(),
      command: 'detect',
      input,
    }, timeoutMs, options.signal);

    if (response.command !== 'detect') {
      throw new UtilityWorkerRunnerError(
        'UTILITY_WORKER_PROTOCOL',
        'Detection worker response used the wrong command.',
      );
    }

    try {
      this.onDetectionComplete?.({
        input,
        mainElapsedMs: Math.max(0, this.now() - startedAt),
        workerPid: response.workerPid,
        telemetry: response.telemetry,
      });
    } catch {
      // Observation-only recording must never change product detection behavior.
    }

    return {
      result: response.result,
      workerPid: response.workerPid,
      telemetry: response.telemetry,
    };
  }

  async hang(timeoutMs: number): Promise<never> {
    await this.run({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: this.createRequestId(),
      command: 'hang',
    }, timeoutMs);
    throw new UtilityWorkerRunnerError('UTILITY_WORKER_PROTOCOL', 'Hung worker unexpectedly responded.');
  }

  async crash(timeoutMs: number): Promise<never> {
    await this.run({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: this.createRequestId(),
      command: 'crash',
    }, timeoutMs);
    throw new UtilityWorkerRunnerError('UTILITY_WORKER_PROTOCOL', 'Crashing worker unexpectedly responded.');
  }

  dispose(): number[] {
    this.disposed = true;
    const killedPids: number[] = [];

    for (const operation of [...this.activeOperations]) {
      const pid = operation.process.pid;
      if (typeof pid === 'number') {
        killedPids.push(pid);
      }
      operation.reject(new UtilityWorkerRunnerError(
        'UTILITY_WORKER_DISPOSED',
        'Utility worker was stopped because the app is quitting.',
      ));
      operation.process.kill();
    }

    return killedPids;
  }

  private run(
    request: UtilityWorkerRequest,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<UtilityWorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new UtilityWorkerRunnerError(
        'UTILITY_WORKER_DISPOSED',
        'Utility worker runner has been disposed.',
      ));
    }

    if (signal?.aborted) {
      return Promise.reject(new UtilityWorkerRunnerError(
        'UTILITY_WORKER_CANCELLED',
        'Utility worker operation was cancelled before it started.',
      ));
    }

    const process = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Structure Worker',
      stdio: 'pipe',
    });

    return new Promise((resolve, reject) => {
      const onSpawn = (): void => {
        if (operation.settled) {
          return;
        }

        operation.timeout = setTimeout(() => {
          if (operation.settled) {
            return;
          }

          settleReject(new UtilityWorkerRunnerError(
            'UTILITY_WORKER_TIMEOUT',
            `Utility worker timed out while running ${request.command}.`,
          ));
          process.kill();
        }, timeoutMs);
        process.postMessage(request);
      };
      const onMessage = (message: unknown): void => {
        if (operation.settled) {
          return;
        }

        if (!isUtilityWorkerResponse(message) ||
          message.requestId !== request.requestId ||
          message.command !== request.command) {
          settleReject(new UtilityWorkerRunnerError(
            'UTILITY_WORKER_PROTOCOL',
            'Utility worker response did not match the typed protocol.',
          ));
          process.kill();
          return;
        }

        settleResolve(message);
        process.kill();
      };
      const onExit = (code: number): void => {
        if (!operation.settled) {
          settleReject(new UtilityWorkerRunnerError(
            'UTILITY_WORKER_CRASH',
            `Utility worker exited before responding with code ${code}.`,
          ));
        }
      };
      const onAbort = (): void => {
        if (operation.settled) {
          return;
        }

        settleReject(new UtilityWorkerRunnerError(
          'UTILITY_WORKER_CANCELLED',
          `Utility worker was cancelled while running ${request.command}.`,
        ));
        process.kill();
      };
      const cleanup = (): void => {
        if (operation.timeout !== undefined) {
          clearTimeout(operation.timeout);
        }
        process.removeListener('spawn', onSpawn);
        process.removeListener('message', onMessage);
        process.removeListener('exit', onExit);
        signal?.removeEventListener('abort', onAbort);
        this.activeOperations.delete(operation);
      };
      const settleResolve = (value: UtilityWorkerResponse): void => {
        if (operation.settled) {
          return;
        }
        operation.settled = true;
        cleanup();
        resolve(value);
      };
      const settleReject = (error: UtilityWorkerRunnerError): void => {
        if (operation.settled) {
          return;
        }
        operation.settled = true;
        cleanup();
        reject(error);
      };
      const operation: ActiveOperation = {
        process,
        reject: settleReject,
        settled: false,
        timeout: undefined,
        cleanup,
      };

      this.activeOperations.add(operation);
      process.on('spawn', onSpawn);
      process.on('message', onMessage);
      process.on('exit', onExit);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export function resolveUtilityWorkerModulePath(mainBundleDirectory: string): string {
  return path.join(mainBundleDirectory, 'structure-worker-entry.js');
}

export function createElectronStructureWorkerRunner(
  mainBundleDirectory: string,
  options: Pick<UtilityWorkerRunnerOptions, 'onDetectionComplete'> = {},
): UtilityWorkerRunner {
  return new UtilityWorkerRunner({
    modulePath: resolveUtilityWorkerModulePath(mainBundleDirectory),
    ...options,
  });
}

const electronForkUtilityProcess: ForkUtilityProcess = (modulePath, args, options) => {
  return utilityProcess.fork(modulePath, args, options) as UtilityProcessHandle;
};
