import { describe, expect, it, vi } from 'vitest';
import {
  createAiRuntimeCleanupObservation,
  type AiRuntimeCleanupObservation,
} from '../../src/main/ai/ai-attempt-lifecycle';
import {
  CodexConnectionCheckAttemptController,
} from '../../src/main/ai/providers/codex/codex-connection-check-attempt-controller';
import type {
  CodexConnectionCheckRuntimeExecution,
} from '../../src/main/ai/providers/codex/codex-connection-check-runtime';
import type { AiAttemptToken } from '../../src/main/ai/ai-execution-port';

const observedAt = '2026-07-24T12:00:00.000Z';

describe('Block 13.12 connection-check attempt ownership', () => {
  it('uses the lifecycle controller for concurrent admission and explicit generations', async () => {
    const runs: ReturnType<typeof runtimeRun>[] = [];
    const runtime = {
      start: vi.fn((token: AiAttemptToken) => {
        const run = runtimeRun(token.attempt);
        runs.push(run);
        return run.execution;
      }),
    };
    const controller = new CodexConnectionCheckAttemptController({
      runtime,
      now: () => observedAt,
    });

    const first = controller.beginExplicit();
    expect(first.accepted).toBe(true);
    expect(controller.beginExplicit()).toEqual({
      accepted: false,
      reason: 'attempt_active',
    });
    runs[0]!.result.resolve(result(1, 'authenticated'));
    await expect(first.accepted && first.result).resolves.toMatchObject({
      kind: 'probe',
      classification: 'authenticated',
      executionSucceeded: true,
      observedAt,
    });

    const retry = controller.beginExplicit();
    expect(retry.accepted).toBe(true);
    expect(runtime.start.mock.calls.map(([token]) => token)).toEqual([
      { attempt: 1, generation: 1 },
      { attempt: 2, generation: 2 },
    ]);
    runs[1]!.result.resolve(result(2, 'runtime_unavailable'));
    await expect(retry.accepted && retry.result).resolves.toMatchObject({
      kind: 'runtime_unavailable',
      observedAt,
    });
  });

  it('cannot promote a late success after Library replacement termination', async () => {
    const run = runtimeRun(1);
    const controller = new CodexConnectionCheckAttemptController({
      runtime: { start: () => run.execution },
      now: () => observedAt,
    });
    const attempt = controller.beginExplicit();
    expect(attempt.accepted).toBe(true);
    await controller.requestTermination('library_replacement');
    run.result.resolve(result(1, 'authenticated'));

    await expect(attempt.accepted && attempt.result).resolves.toMatchObject({
      kind: 'runtime_unavailable',
    });
  });

  it('quarantines unverified cleanup and blocks explicit retry', async () => {
    const run = runtimeRun(1, unverifiedCleanup());
    const controller = new CodexConnectionCheckAttemptController({
      runtime: { start: () => run.execution },
      now: () => observedAt,
    });
    const attempt = controller.beginExplicit();
    expect(attempt.accepted).toBe(true);
    run.result.resolve(result(1, 'authenticated'));
    await expect(attempt.accepted && attempt.result).resolves.toMatchObject({
      kind: 'runtime_unavailable',
    });
    expect(controller.beginExplicit()).toEqual({
      accepted: false,
      reason: 'cleanup_unverified',
    });
  });
});

function runtimeRun(
  ordinal: number,
  cleanup: AiRuntimeCleanupObservation = gracefulCleanup(),
): {
  readonly execution: CodexConnectionCheckRuntimeExecution;
  readonly result: ReturnType<typeof deferred<
    Awaited<CodexConnectionCheckRuntimeExecution['result']>
  >>;
} {
  const pending = deferred<Awaited<CodexConnectionCheckRuntimeExecution['result']>>();
  return {
    execution: {
      result: pending.promise,
      session: {
        terminate: async () => cleanup,
      },
    },
    result: pending,
  };
}

function result(attempt: number, outcome: 'authenticated' | 'runtime_unavailable') {
  return {
    version: 1 as const,
    origin: 'utility' as const,
    type: 'ai.connection-check.result' as const,
    token: { attempt, generation: attempt },
    outcome,
  };
}

function gracefulCleanup(): AiRuntimeCleanupObservation {
  return createAiRuntimeCleanupObservation({
    classification: 'graceful',
    abortRequested: true,
    abortObserved: true,
    executionSettled: true,
    cleanupAcknowledged: true,
    utilityExitObserved: true,
    utilityExitClean: true,
    utilityKillOwnershipProven: false,
    utilityKillAttempted: false,
    residualScanCompleted: true,
    utilityResidualAbsent: true,
    cliResidualAbsent: true,
  });
}

function unverifiedCleanup(): AiRuntimeCleanupObservation {
  return createAiRuntimeCleanupObservation({
    classification: 'unverified',
    abortRequested: false,
    abortObserved: false,
    executionSettled: false,
    cleanupAcknowledged: false,
    utilityExitObserved: false,
    utilityExitClean: false,
    utilityKillOwnershipProven: false,
    utilityKillAttempted: false,
    residualScanCompleted: false,
    utilityResidualAbsent: false,
    cliResidualAbsent: false,
  });
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
