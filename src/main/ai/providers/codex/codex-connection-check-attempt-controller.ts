import { z } from 'zod';
import {
  AiAttemptLifecycleService,
  type AiLifecycleParticipant,
  type AiLifecycleSettlement,
  type AiTerminationTrigger,
} from '../../ai-attempt-lifecycle';
import {
  createAiExecutionEvent,
  type AiAttemptToken,
} from '../../ai-execution-port';
import { createAiUsageObservation } from '../../ai-runtime-diagnostics';
import { createAiStructuredOutputContract } from '../../ai-structured-output';
import type {
  AiConnectionCheckAttemptAdmission,
} from '../../ai-connection-check-service';
import type {
  CodexConnectionCheckRuntime,
  CodexConnectionCheckRuntimeExecution,
} from './codex-connection-check-runtime';

const CONNECTION_CHECK_FINAL = '{"status":"WS13"}';

export class CodexConnectionCheckAttemptController implements AiLifecycleParticipant {
  readonly #lifecycle: AiAttemptLifecycleService;
  private activeExecution: CodexConnectionCheckRuntimeExecution | null = null;

  constructor(private readonly dependencies: {
    readonly runtime: Pick<CodexConnectionCheckRuntime, 'start'>;
    readonly now?: () => string;
    readonly timeoutMs?: number;
  }) {
    this.#lifecycle = new AiAttemptLifecycleService({
      structuredOutput: createAiStructuredOutputContract({
        schema: z.object({ status: z.literal('WS13') }).strict(),
        maxFinalBytes: 64,
      }),
      resourceLimits: {
        maxEventBytes: 1_024,
        maxTotalBytes: 2_048,
        maxEventCount: 2,
        maxPartialBytes: 1,
      },
      createSession: (token) => {
        const execution = this.dependencies.runtime.start(token);
        this.activeExecution = execution;
        return execution.session;
      },
      timeoutMs: this.dependencies.timeoutMs ?? 30_000,
    });
  }

  beginExplicit(): AiConnectionCheckAttemptAdmission {
    const admission = this.#lifecycle.beginExplicit();
    if (!admission.accepted) return admission;
    const execution = this.activeExecution;
    if (!execution) {
      return Object.freeze({ accepted: false, reason: 'session_start_failed' });
    }
    return Object.freeze({
      accepted: true,
      result: this.complete(admission.token, execution),
    });
  }

  isActive(): boolean {
    return this.#lifecycle.isActive();
  }

  pauseAdmission(): void {
    this.#lifecycle.pauseAdmission();
  }

  resumeAdmission(): void {
    this.#lifecycle.resumeAdmission();
  }

  requestTermination(trigger: AiTerminationTrigger): Promise<AiLifecycleSettlement> {
    return this.#lifecycle.requestTermination(trigger);
  }

  private async complete(
    token: AiAttemptToken,
    execution: CodexConnectionCheckRuntimeExecution,
  ): Promise<unknown> {
    let authenticated = false;
    try {
      const result = await execution.result;
      authenticated = result.outcome === 'authenticated';
    } catch {
      authenticated = false;
    }
    const outcome = await this.#lifecycle.acceptEvent(createAiExecutionEvent(
      authenticated
        ? {
          ...token,
          sequence: 1,
          kind: 'final',
          content: CONNECTION_CHECK_FINAL,
          usage: createAiUsageObservation(null),
        }
        : {
          ...token,
          sequence: 1,
          kind: 'error',
        },
    ));
    this.activeExecution = null;
    const terminal = outcome.disposition.disposition === 'accepted'
      ? outcome.disposition.terminalCandidate
      : null;
    const executionSucceeded = terminal?.state === 'succeeded'
      && outcome.cleanup?.classification === 'graceful';
    const observedAt = (this.dependencies.now ?? (() => new Date().toISOString()))();
    return executionSucceeded
      ? Object.freeze({
        kind: 'probe',
        source: 'actual_runtime',
        classification: 'authenticated',
        executionSucceeded: true,
        observedAt,
      })
      : Object.freeze({
        kind: 'runtime_unavailable',
        source: 'actual_runtime',
        observedAt,
      });
  }
}
