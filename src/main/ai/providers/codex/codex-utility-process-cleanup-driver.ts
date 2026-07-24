import type { AiAttemptToken } from '../../ai-execution-port';
import type { AiTerminationTrigger } from '../../ai-attempt-lifecycle';
import type { CodexUtilityCleanupDriver } from './codex-utility-cleanup';
import {
  isCodexUtilityLifecycleResponse,
  sameAttemptToken,
  type CodexUtilityAbortRequest,
  type CodexUtilityShutdownRequest,
} from './codex-utility-lifecycle-protocol';
import { isCodexProductProbeResponse } from './codex-product-probe-protocol';

export type CodexUtilityLifecycleProcess = {
  readonly pid: number | undefined;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number | null, signal?: string | null) => void): unknown;
  removeListener(event: 'message', listener: (message: unknown) => void): unknown;
  removeListener(
    event: 'exit',
    listener: (code: number | null, signal?: string | null) => void,
  ): unknown;
  postMessage(message: unknown): void;
  kill(): boolean;
};

type AbortResult = Awaited<ReturnType<CodexUtilityCleanupDriver['requestAbort']>>;
type ShutdownResult = Awaited<ReturnType<CodexUtilityCleanupDriver['requestShutdown']>>;

export class CodexUtilityProcessCleanupDriver implements CodexUtilityCleanupDriver {
  private abortDeferred: Deferred<AbortResult> | null = null;
  private shutdownDeferred: Deferred<ShutdownResult> | null = null;
  private shutdownAcknowledged = false;
  private exited = false;
  private exitClean = false;
  private exitDeferred = deferred<void>();

  constructor(private readonly input: {
    readonly process: CodexUtilityLifecycleProcess;
    readonly token: AiAttemptToken;
    readonly isOwnedAndRunning: () => boolean;
    readonly scanResiduals: CodexUtilityCleanupDriver['scanResiduals'];
  }) {
    input.process.on('message', this.onMessage);
    input.process.on('exit', this.onExit);
  }

  requestAbort(trigger: AiTerminationTrigger): Promise<AbortResult> {
    if (this.abortDeferred) return this.abortDeferred.promise;
    this.abortDeferred = deferred<AbortResult>();
    const request: CodexUtilityAbortRequest = {
      version: 1,
      origin: 'main',
      type: 'ai.abort',
      token: this.input.token,
      trigger,
    };
    this.post(request, this.abortDeferred);
    return this.abortDeferred.promise;
  }

  requestShutdown(): Promise<ShutdownResult> {
    if (this.shutdownDeferred) return this.shutdownDeferred.promise;
    this.shutdownDeferred = deferred<ShutdownResult>();
    if (this.exited) {
      this.shutdownDeferred.resolve({
        cleanupAcknowledged: false,
        utilityExitObserved: true,
        utilityExitClean: this.exitClean,
      });
      return this.shutdownDeferred.promise;
    }
    const request: CodexUtilityShutdownRequest = {
      version: 1,
      origin: 'main',
      type: 'ai.shutdown',
      token: this.input.token,
    };
    this.post(request, this.shutdownDeferred);
    return this.shutdownDeferred.promise;
  }

  async forceOwnedUtility(): Promise<{
    utilityKillOwnershipProven: boolean;
    utilityKillAttempted: boolean;
    utilityExitObserved: boolean;
  }> {
    if (this.exited) {
      return {
        utilityKillOwnershipProven: false,
        utilityKillAttempted: false,
        utilityExitObserved: true,
      };
    }
    let ownershipProven = false;
    try {
      ownershipProven = this.input.isOwnedAndRunning();
    } catch {
      ownershipProven = false;
    }
    if (!ownershipProven) {
      return {
        utilityKillOwnershipProven: false,
        utilityKillAttempted: false,
        utilityExitObserved: false,
      };
    }
    try {
      this.input.process.kill();
    } catch {
      return {
        utilityKillOwnershipProven: true,
        utilityKillAttempted: true,
        utilityExitObserved: false,
      };
    }
    await this.exitDeferred.promise;
    return {
      utilityKillOwnershipProven: true,
      utilityKillAttempted: true,
      utilityExitObserved: true,
    };
  }

  scanResiduals(): ReturnType<CodexUtilityCleanupDriver['scanResiduals']> {
    return this.input.scanResiduals();
  }

  private readonly onMessage = (message: unknown): void => {
    if (isCodexProductProbeResponse(message)) return;
    if (!isCodexUtilityLifecycleResponse(message)
      || !sameAttemptToken(message.token, this.input.token)) {
      this.rejectPending();
      return;
    }
    if (message.type === 'ai.abort-result' && this.abortDeferred) {
      this.abortDeferred.resolve({
        abortRequested: message.abortRequested,
        abortObserved: message.abortObserved,
        executionSettled: message.executionSettled,
      });
      this.abortDeferred = null;
      return;
    }
    if (message.type === 'ai.shutdown-result' && this.shutdownDeferred) {
      this.shutdownAcknowledged = message.cleanupAcknowledged;
      this.resolveShutdownAfterExit();
      return;
    }
    this.rejectPending();
  };

  private readonly onExit = (code: number | null, signal?: string | null): void => {
    this.exited = true;
    this.exitClean = code === 0 && !signal;
    this.exitDeferred.resolve();
    if (this.abortDeferred) {
      this.abortDeferred.reject(new Error('Codex utility exited before abort acknowledgement.'));
      this.abortDeferred = null;
    }
    this.resolveShutdownAfterExit();
    this.disposeListeners();
  };

  private resolveShutdownAfterExit(): void {
    if (!this.shutdownDeferred || !this.exited) return;
    this.shutdownDeferred.resolve({
      cleanupAcknowledged: this.shutdownAcknowledged,
      utilityExitObserved: true,
      utilityExitClean: this.exitClean,
    });
    this.shutdownDeferred = null;
  }

  private post<T>(message: unknown, pending: Deferred<T>): void {
    try {
      this.input.process.postMessage(message);
    } catch {
      pending.reject(new Error('Codex utility lifecycle request failed.'));
    }
  }

  private rejectPending(): void {
    const error = new Error('Codex utility lifecycle response was rejected.');
    this.abortDeferred?.reject(error);
    this.shutdownDeferred?.reject(error);
    this.abortDeferred = null;
    this.shutdownDeferred = null;
  }

  private disposeListeners(): void {
    this.input.process.removeListener('message', this.onMessage);
    this.input.process.removeListener('exit', this.onExit);
  }
}

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve, reject };
}
