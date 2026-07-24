import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import {
  createAiAttemptResourceLimits,
} from '../../src/main/ai/ai-attempt-controller';
import {
  AiAttemptLifecycleService,
  AiRuntimeLifecycleRegistry,
  createAiRuntimeCleanupObservation,
  type AiRuntimeCleanupObservation,
  type AiRuntimeSession,
  type AiTerminationTrigger,
} from '../../src/main/ai/ai-attempt-lifecycle';
import { createAiExecutionEvent } from '../../src/main/ai/ai-execution-port';
import { createAiStructuredOutputContract } from '../../src/main/ai/ai-structured-output';

const gracefulCleanup = createAiRuntimeCleanupObservation({
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

const unverifiedCleanup = createAiRuntimeCleanupObservation({
  classification: 'unverified',
  abortRequested: true,
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

describe('Block 13.9 application attempt lifecycle', () => {
  it('waits for graceful utility cleanup before publishing explicit cancellation', async () => {
    const cleanup = deferred<AiRuntimeCleanupObservation>();
    const session = fakeSession(() => cleanup.promise);
    const service = createService(() => session);
    const started = service.startExplicit();
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;

    const cancelling = service.requestTermination('explicit_cancel');
    expect(session.terminate).toHaveBeenCalledWith('explicit_cancel');
    expect(service.read().phase).toBe('terminating');

    cleanup.resolve(gracefulCleanup);
    await expect(cancelling).resolves.toMatchObject({
      trigger: 'explicit_cancel',
      cleanup: { classification: 'graceful' },
      disposition: {
        terminalCandidate: { state: 'cancelled' },
      },
    });
    expect(service.read().phase).toBe('idle');
  });

  it('preserves the first lifecycle trigger and executes cleanup once', async () => {
    const cleanup = deferred<AiRuntimeCleanupObservation>();
    const session = fakeSession(() => cleanup.promise);
    const service = createService(() => session);
    service.startExplicit();

    const windowClose = service.requestTermination('window_close');
    const appQuit = service.requestTermination('app_quit');
    expect(appQuit).toBe(windowClose);
    cleanup.resolve(gracefulCleanup);

    await expect(appQuit).resolves.toMatchObject({ trigger: 'window_close' });
    expect(session.terminate).toHaveBeenCalledTimes(1);
  });

  it('maps a graceful timeout to failed without automatically retrying', async () => {
    let fireTimeout = (): void => undefined;
    const createSession = vi.fn(() => fakeSession(async () => gracefulCleanup));
    const service = createService(createSession, (callback) => {
      fireTimeout = callback;
      return () => undefined;
    });
    const started = service.startExplicit();
    expect(started.accepted).toBe(true);

    fireTimeout();
    await service.waitForIdle();

    expect(service.lastSettlement()).toMatchObject({
      trigger: 'timeout',
      disposition: {
        terminalCandidate: {
          token: { attempt: 1, generation: 1 },
        },
      },
    });
    expect(service.lastSettlement()).toMatchObject({
      disposition: {
        terminalCandidate: { state: 'failed', reason: 'timeout' },
      },
    });
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['forced', forcedCleanup(), 'cleanup_forced'],
    ['unverified', unverifiedCleanup, 'cleanup_unverified'],
  ] as const)('fails closed when cleanup is %s', async (_name, cleanup, reason) => {
    const service = createService(() => fakeSession(async () => cleanup));
    service.startExplicit();

    await expect(service.requestTermination('explicit_cancel')).resolves.toMatchObject({
      disposition: {
        terminalCandidate: { state: 'failed', reason },
      },
    });
  });

  it('withholds a valid terminal candidate until cleanup and overrides it on cleanup failure', async () => {
    const cleanup = deferred<AiRuntimeCleanupObservation>();
    const service = createService(() => fakeSession(() => cleanup.promise));
    const started = service.startExplicit();
    if (!started.accepted) return;

    const settling = service.acceptEvent(createAiExecutionEvent({
      ...started.token,
      sequence: 1,
      kind: 'final',
      content: '{"summary":"done"}',
    }));
    let settled = false;
    void settling.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    cleanup.resolve(unverifiedCleanup);
    await expect(settling).resolves.toMatchObject({
      disposition: {
        terminalCandidate: { state: 'failed', reason: 'cleanup_unverified' },
      },
    });
  });

  it('requires an explicit retry and permanently rejects the old generation', async () => {
    const createSession = vi.fn(() => fakeSession(async () => gracefulCleanup));
    const service = createService(createSession);
    const first = service.startExplicit();
    if (!first.accepted) return;
    await service.requestTermination('explicit_cancel');

    expect(service.startExplicit()).toEqual({
      accepted: false,
      reason: 'explicit_retry_required',
    });
    const retry = service.retryExplicit();
    expect(retry).toMatchObject({
      accepted: true,
      token: { attempt: 2, generation: 2 },
    });
    if (!retry.accepted) return;
    await expect(service.acceptEvent(createAiExecutionEvent({
      ...first.token,
      sequence: 1,
      kind: 'final',
      content: '{"summary":"late"}',
    }))).resolves.toEqual({
      disposition: { disposition: 'ignored', reason: 'stale_generation' },
      cleanup: null,
    });
    expect(service.read()).toMatchObject({ phase: 'active', token: retry.token });
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('rejects a concurrent retry and output received after termination starts', async () => {
    const cleanup = deferred<AiRuntimeCleanupObservation>();
    const service = createService(() => fakeSession(() => cleanup.promise));
    const started = service.startExplicit();
    if (!started.accepted) return;

    const cancelling = service.requestTermination('library_replacement');
    expect(service.retryExplicit()).toEqual({
      accepted: false,
      reason: 'attempt_active',
    });
    await expect(service.acceptEvent(createAiExecutionEvent({
      ...started.token,
      sequence: 1,
      kind: 'partial',
      content: 'late',
    }))).resolves.toEqual({
      disposition: { disposition: 'ignored', reason: 'lifecycle_terminating' },
      cleanup: null,
    });
    cleanup.resolve(gracefulCleanup);
    await cancelling;
  });

  it('fans lifecycle triggers into tracked active services and closes registration on shutdown', async () => {
    const registry = new AiRuntimeLifecycleRegistry();
    const triggers: AiTerminationTrigger[] = [];
    const participant = {
      isActive: () => true,
      pauseAdmission: vi.fn(),
      resumeAdmission: vi.fn(),
      requestTermination: vi.fn(async (trigger: AiTerminationTrigger) => {
        triggers.push(trigger);
        return {
          trigger,
          disposition: { disposition: 'ignored', reason: 'no_active_attempt' },
          cleanup: gracefulCleanup,
        } as const;
      }),
    };
    registry.track(participant);

    await registry.prepareForLibraryReplacement();
    registry.resumeAfterLibraryReplacement();
    await registry.windowClosed();
    await registry.shutdown();

    expect(triggers).toEqual(['library_replacement', 'window_close', 'app_quit']);
    expect(participant.pauseAdmission).toHaveBeenCalledTimes(3);
    expect(participant.resumeAdmission).toHaveBeenCalledOnce();
    expect(() => registry.track(participant)).toThrow();
  });

  it('blocks attempt admission across Library replacement until Main explicitly resumes it', async () => {
    const registry = new AiRuntimeLifecycleRegistry();
    const service = createService(() => fakeSession(async () => gracefulCleanup));
    registry.track(service);

    await registry.prepareForLibraryReplacement();
    expect(service.startExplicit()).toEqual({
      accepted: false,
      reason: 'admission_paused',
    });

    registry.resumeAfterLibraryReplacement();
    expect(service.startExplicit()).toMatchObject({ accepted: true });
  });

  it('quarantines unverified cleanup and blocks retry plus Library replacement', async () => {
    const registry = new AiRuntimeLifecycleRegistry();
    const service = createService(() => fakeSession(async () => unverifiedCleanup));
    registry.track(service);
    service.startExplicit();

    await service.requestTermination('explicit_cancel');
    expect(service.read().phase).toBe('quarantined');
    expect(service.retryExplicit()).toEqual({
      accepted: false,
      reason: 'cleanup_unverified',
    });
    await expect(registry.prepareForLibraryReplacement()).rejects.toThrow(
      'AI runtime cleanup remains unverified.',
    );
  });

  it('waitForIdle remains pending while execution is active and resolves after safe cleanup', async () => {
    const service = createService(() => fakeSession(async () => gracefulCleanup));
    service.startExplicit();
    let idle = false;
    void service.waitForIdle().then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);

    await service.requestTermination('explicit_cancel');
    await expect(service.waitForIdle()).resolves.toBeUndefined();
    expect(idle).toBe(true);
  });

  it('does not expose its mutable attempt controller', () => {
    const service = createService(() => fakeSession(async () => gracefulCleanup));
    expect(service).not.toHaveProperty('controller');
  });

  it('pauses admission before taking the window-close cleanup snapshot', async () => {
    const cleanup = deferred<AiRuntimeCleanupObservation>();
    const registry = new AiRuntimeLifecycleRegistry();
    const service = createService(() => fakeSession(() => cleanup.promise));
    registry.track(service);
    service.startExplicit();

    const closing = registry.windowClosed();
    expect(service.startExplicit()).toEqual({
      accepted: false,
      reason: 'admission_paused',
    });
    expect(service.retryExplicit()).toEqual({
      accepted: false,
      reason: 'admission_paused',
    });
    cleanup.resolve(gracefulCleanup);
    await closing;
    expect(service.startExplicit()).toEqual({
      accepted: false,
      reason: 'admission_paused',
    });
  });

  it('refuses to unregister an active or quarantined participant', async () => {
    const registry = new AiRuntimeLifecycleRegistry();
    const service = createService(() => fakeSession(async () => unverifiedCleanup));
    const unregister = registry.track(service);
    service.startExplicit();

    expect(unregister).toThrow('Cannot unregister an active AI lifecycle participant.');
    await service.requestTermination('explicit_cancel');
    expect(service.read().phase).toBe('quarantined');
    expect(unregister).toThrow('Cannot unregister an active AI lifecycle participant.');

    const safeService = createService(() => fakeSession(async () => gracefulCleanup));
    const unregisterSafe = registry.track(safeService);
    safeService.startExplicit();
    await safeService.requestTermination('explicit_cancel');
    expect(unregisterSafe).not.toThrow();
  });

  it('contains scheduler failure and quarantines when cleanup cannot be proven', async () => {
    const session = fakeSession(async () => unverifiedCleanup);
    const service = createService(() => session, () => {
      throw new Error('scheduler infrastructure detail');
    });

    expect(service.startExplicit()).toEqual({
      accepted: false,
      reason: 'session_start_failed',
    });
    await Promise.resolve();
    expect(session.terminate).toHaveBeenCalledWith('failed');
    expect(service.read().phase).toBe('quarantined');
    expect(service.retryExplicit()).toEqual({
      accepted: false,
      reason: 'cleanup_unverified',
    });
  });

  it('contains no persistence, Job, renderer, provider or automatic retry dependency', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/main/ai/ai-attempt-lifecycle.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/better-sqlite3|sqlite|Job(?:Service|Repository)|renderer/i);
    expect(source).not.toMatch(/codex|openai|jsonl|child_process/i);
    expect(source).not.toMatch(/setInterval|retry\(\)|auto.?retry/i);
  });
});

function createService(
  createSession: () => AiRuntimeSession,
  scheduleTimeout: (
    callback: () => void,
    milliseconds: number,
  ) => () => void = () => () => undefined,
): AiAttemptLifecycleService {
  return new AiAttemptLifecycleService({
    structuredOutput: createAiStructuredOutputContract({
      schema: z.object({ summary: z.string() }).strict(),
      maxFinalBytes: 256,
    }),
    resourceLimits: createAiAttemptResourceLimits({
      maxEventBytes: 512,
      maxTotalBytes: 2_048,
      maxEventCount: 8,
      maxPartialBytes: 256,
    }),
    createSession: () => createSession(),
    timeoutMs: 1_000,
    scheduleTimeout,
  });
}

function fakeSession(
  terminate: (trigger: AiTerminationTrigger) => Promise<AiRuntimeCleanupObservation>,
): AiRuntimeSession & { terminate: ReturnType<typeof vi.fn> } {
  return {
    terminate: vi.fn(terminate),
  };
}

function forcedCleanup(): AiRuntimeCleanupObservation {
  return createAiRuntimeCleanupObservation({
    classification: 'forced',
    abortRequested: true,
    abortObserved: false,
    executionSettled: false,
    cleanupAcknowledged: false,
    utilityExitObserved: true,
    utilityExitClean: false,
    utilityKillOwnershipProven: true,
    utilityKillAttempted: true,
    residualScanCompleted: true,
    utilityResidualAbsent: true,
    cliResidualAbsent: true,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
