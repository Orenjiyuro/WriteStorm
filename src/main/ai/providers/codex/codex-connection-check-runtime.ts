import type { AiRuntimeSession } from '../../ai-attempt-lifecycle';
import type { AiAttemptToken } from '../../ai-execution-port';
import { CodexUtilityCleanupController } from './codex-utility-cleanup';
import {
  isCodexConnectionCheckResponse,
  type CodexConnectionCheckResponse,
} from './codex-connection-check-protocol';
import type {
  CodexUtilityLauncher,
  CodexUtilityProcessHandle,
} from './codex-utility-launcher';
import { CodexUtilityProcessCleanupDriver } from './codex-utility-process-cleanup-driver';
import type { CodexWindowsProcessGuard } from './codex-windows-process-guard';

export type CodexConnectionCheckRuntimeResult = Extract<
  CodexConnectionCheckResponse,
  { readonly type: 'ai.connection-check.result' }
>;

export type CodexConnectionCheckRuntimeExecution = {
  readonly session: AiRuntimeSession;
  readonly result: Promise<CodexConnectionCheckRuntimeResult>;
};

export class CodexConnectionCheckRuntime {
  constructor(private readonly dependencies: {
    readonly launcher: Pick<CodexUtilityLauncher, 'launch'>;
    readonly createProcessGuard: (observationStartedAt: number) => Pick<
      CodexWindowsProcessGuard,
      'bindUtility' | 'isUtilityOwnedAndRunning' | 'scanResiduals'
    >;
    readonly cleanupGraceMs: number;
  }) {}

  start(token: AiAttemptToken): CodexConnectionCheckRuntimeExecution {
    const observationStartedAt = Date.now();
    const guard = this.dependencies.createProcessGuard(observationStartedAt);
    const child = this.dependencies.launcher.launch();
    const result = deferred<CodexConnectionCheckRuntimeResult>();
    const driver = new CodexUtilityProcessCleanupDriver({
      process: child,
      token,
      isOwnedAndRunning: () => guard.isUtilityOwnedAndRunning(),
      scanResiduals: () => guard.scanResiduals(),
    });
    const session = new CodexUtilityCleanupController({
      driver,
      graceMs: this.dependencies.cleanupGraceMs,
    });
    const dispose = (): void => {
      child.removeListener('spawn', onSpawn);
      child.removeListener('message', onMessage);
      child.removeListener('exit', onExit);
    };
    const onSpawn = (): void => {
      if (child.pid === undefined) {
        result.reject(new Error('AI utility process identifier unavailable.'));
        return;
      }
      guard.bindUtility(child.pid);
      try {
        child.postMessage({
          version: 1,
          origin: 'main',
          type: 'ai.connection-check.start',
          token,
          fixtureId: 'block13-connection-check-v1',
        });
      } catch {
        result.reject(new Error('AI utility connection check could not start.'));
      }
    };
    const onMessage = (message: unknown): void => {
      if (!isCodexConnectionCheckResponse(message)
        || message.token.attempt !== token.attempt
        || message.token.generation !== token.generation
        || message.type !== 'ai.connection-check.result') {
        return;
      }
      result.resolve(message);
      dispose();
    };
    const onExit = (): void => {
      result.reject(new Error('AI utility exited before connection check completed.'));
      dispose();
    };
    child.on('spawn', onSpawn);
    child.on('message', onMessage);
    child.on('exit', onExit);
    return Object.freeze({ session, result: result.promise });
  }
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve, reject };
}
