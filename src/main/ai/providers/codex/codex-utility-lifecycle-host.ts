import type { AiAttemptToken } from '../../ai-execution-port';
import {
  isCodexUtilityLifecycleRequest,
  sameAttemptToken,
  type CodexUtilityAbortResponse,
  type CodexUtilityLifecycleResponse,
  type CodexUtilityShutdownResponse,
} from './codex-utility-lifecycle-protocol';

export const CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE = 28 as const;

type ActiveExecution = {
  readonly token: AiAttemptToken;
  readonly abort: () => void;
  readonly settled: Promise<unknown>;
  abortRequested: boolean;
};

export class CodexUtilityLifecycleHost {
  private active: ActiveExecution | null = null;
  private boundToken: AiAttemptToken | null = null;
  private termination: Promise<void> | null = null;

  constructor(private readonly dependencies: {
    readonly postMessage: (message: CodexUtilityLifecycleResponse) => void;
    readonly scheduleExit: (code: number) => void;
  }) {}

  bindActiveExecution(input: {
    readonly token: AiAttemptToken;
    readonly abort: () => void;
    readonly settled: Promise<unknown>;
  }): void {
    if (this.active || this.termination) {
      throw new Error('Codex utility execution is already active or terminating.');
    }
    this.boundToken = Object.freeze({ ...input.token });
    this.active = {
      ...input,
      token: this.boundToken,
      abortRequested: false,
    };
  }

  accept(message: unknown): Promise<void> {
    if (this.termination) return this.termination;
    if (!isCodexUtilityLifecycleRequest(message)
      || (this.boundToken && !sameAttemptToken(message.token, this.boundToken))) {
      this.termination = this.terminateMalformed();
      return this.termination;
    }
    this.boundToken ??= Object.freeze({ ...message.token });
    if (message.type === 'ai.abort') return this.respondAbort(message.token);
    this.termination = this.respondShutdown(message.token);
    return this.termination;
  }

  private async respondAbort(token: AiAttemptToken): Promise<void> {
    const observation = await this.abortActive();
    const response: CodexUtilityAbortResponse = {
      version: 1,
      origin: 'utility',
      type: 'ai.abort-result',
      token,
      ...observation,
    };
    this.dependencies.postMessage(response);
  }

  private async respondShutdown(token: AiAttemptToken): Promise<void> {
    await this.abortActive();
    const response: CodexUtilityShutdownResponse = {
      version: 1,
      origin: 'utility',
      type: 'ai.shutdown-result',
      token,
      cleanupAcknowledged: true,
    };
    this.dependencies.postMessage(response);
    this.dependencies.scheduleExit(0);
  }

  private async terminateMalformed(): Promise<void> {
    await this.abortActive();
    this.dependencies.scheduleExit(CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE);
  }

  private async abortActive(): Promise<{
    readonly abortRequested: boolean;
    readonly abortObserved: boolean;
    readonly executionSettled: boolean;
  }> {
    const active = this.active;
    if (!active) {
      return {
        abortRequested: false,
        abortObserved: false,
        executionSettled: true,
      };
    }
    if (!active.abortRequested) {
      active.abortRequested = true;
      try {
        active.abort();
      } catch {
        await active.settled.catch(() => undefined);
        this.active = null;
        return {
          abortRequested: true,
          abortObserved: false,
          executionSettled: true,
        };
      }
    }
    await active.settled.catch(() => undefined);
    this.active = null;
    return {
      abortRequested: true,
      abortObserved: true,
      executionSettled: true,
    };
  }
}
