import {
  type AiAttemptController,
  type AiAttemptDisposition,
} from './ai-attempt-controller';
import {
  type AiAttemptToken,
  type AiExecutionEvent,
} from './ai-execution-port';

export const AI_TERMINATION_TRIGGERS = [
  'completed',
  'failed',
  'explicit_cancel',
  'timeout',
  'window_close',
  'app_quit',
  'library_replacement',
] as const;

export type AiTerminationTrigger = typeof AI_TERMINATION_TRIGGERS[number];

export type AiRuntimeCleanupObservation = Readonly<{
  classification: 'graceful' | 'forced' | 'unverified';
  abortRequested: boolean;
  abortObserved: boolean;
  executionSettled: boolean;
  cleanupAcknowledged: boolean;
  utilityExitObserved: boolean;
  utilityKillOwnershipProven: boolean;
  utilityKillAttempted: boolean;
  residualScanCompleted: boolean;
  utilityResidualAbsent: boolean;
  cliResidualAbsent: boolean;
}>;

export type AiRuntimeSession = {
  terminate(trigger: AiTerminationTrigger): Promise<AiRuntimeCleanupObservation>;
};

export type AiLifecycleParticipant = {
  isActive(): boolean;
  pauseAdmission(): void;
  resumeAdmission(): void;
  requestTermination(trigger: AiTerminationTrigger): Promise<unknown>;
};

type LifecycleTerminatingDisposition = Readonly<{
  disposition: 'ignored';
  reason: 'lifecycle_terminating';
}>;

export type AiLifecycleEventOutcome = Readonly<{
  disposition: AiAttemptDisposition | LifecycleTerminatingDisposition;
  cleanup: AiRuntimeCleanupObservation | null;
}>;

export type AiLifecycleSettlement = Readonly<{
  trigger: AiTerminationTrigger;
  disposition: AiAttemptDisposition;
  cleanup: AiRuntimeCleanupObservation;
}>;

type ActiveLifecycleAttempt = {
  readonly token: AiAttemptToken;
  readonly session: AiRuntimeSession;
  cancelTimeout: () => void;
  termination: Promise<AiLifecycleSettlement> | null;
};

const UNVERIFIED_CLEANUP = createAiRuntimeCleanupObservation({
  classification: 'unverified',
  abortRequested: false,
  abortObserved: false,
  executionSettled: false,
  cleanupAcknowledged: false,
  utilityExitObserved: false,
  utilityKillOwnershipProven: false,
  utilityKillAttempted: false,
  residualScanCompleted: false,
  utilityResidualAbsent: false,
  cliResidualAbsent: false,
});

export function createAiRuntimeCleanupObservation(
  input: AiRuntimeCleanupObservation,
): AiRuntimeCleanupObservation {
  const booleanKeys = [
    'abortRequested',
    'abortObserved',
    'executionSettled',
    'cleanupAcknowledged',
    'utilityExitObserved',
    'utilityKillOwnershipProven',
    'utilityKillAttempted',
    'residualScanCompleted',
    'utilityResidualAbsent',
    'cliResidualAbsent',
  ] as const;
  const keys = [
    'classification',
    ...booleanKeys,
  ];
  if (!isPlainRecord(input)
    || !hasExactKeys(input, keys)
    || !['graceful', 'forced', 'unverified'].includes(input.classification)
    || booleanKeys.some((key) => typeof input[key] !== 'boolean')
    || (input.classification === 'graceful' && !isGraceful(input))
    || (input.classification === 'forced' && !isForced(input))) {
    throw new Error('AI runtime cleanup observation is invalid.');
  }
  return Object.freeze({ ...input });
}

export class AiAttemptLifecycleService implements AiLifecycleParticipant {
  readonly controller: AiAttemptController;
  private readonly createSession: (token: AiAttemptToken) => AiRuntimeSession;
  private readonly timeoutMs: number;
  private readonly scheduleTimeout: (
    callback: () => void,
    milliseconds: number,
  ) => () => void;
  private active: ActiveLifecycleAttempt | null = null;
  private hasStarted = false;
  private admissionPaused = false;
  private latestSettlement: AiLifecycleSettlement | null = null;

  constructor(input: {
    readonly controller: AiAttemptController;
    readonly createSession: (token: AiAttemptToken) => AiRuntimeSession;
    readonly timeoutMs: number;
    readonly scheduleTimeout?: (
      callback: () => void,
      milliseconds: number,
    ) => () => void;
  }) {
    if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1) {
      throw new Error('AI attempt timeout is invalid.');
    }
    this.controller = input.controller;
    this.createSession = input.createSession;
    this.timeoutMs = input.timeoutMs;
    this.scheduleTimeout = input.scheduleTimeout ?? scheduleTimeout;
  }

  startExplicit():
    | Readonly<{ accepted: true; token: AiAttemptToken }>
    | Readonly<{
      accepted: false;
      reason:
        | 'attempt_active'
        | 'admission_paused'
        | 'explicit_retry_required'
        | 'session_start_failed';
    }> {
    if (this.admissionPaused) {
      return Object.freeze({ accepted: false, reason: 'admission_paused' });
    }
    if (this.active) return Object.freeze({ accepted: false, reason: 'attempt_active' });
    if (this.hasStarted) {
      return Object.freeze({ accepted: false, reason: 'explicit_retry_required' });
    }
    return this.beginAttempt();
  }

  retryExplicit():
    | Readonly<{ accepted: true; token: AiAttemptToken }>
    | Readonly<{
      accepted: false;
      reason:
        | 'attempt_active'
        | 'admission_paused'
        | 'no_previous_attempt'
        | 'session_start_failed';
    }> {
    if (this.admissionPaused) {
      return Object.freeze({ accepted: false, reason: 'admission_paused' });
    }
    if (this.active) return Object.freeze({ accepted: false, reason: 'attempt_active' });
    if (!this.hasStarted) {
      return Object.freeze({ accepted: false, reason: 'no_previous_attempt' });
    }
    return this.beginAttempt();
  }

  acceptEvent(event: AiExecutionEvent): Promise<AiLifecycleEventOutcome> {
    const active = this.active;
    if (active?.termination) {
      return Promise.resolve(Object.freeze({
        disposition: Object.freeze({
          disposition: 'ignored',
          reason: 'lifecycle_terminating',
        }),
        cleanup: null,
      }));
    }
    const disposition = this.controller.accept(event);
    if (disposition.disposition === 'accepted' && disposition.terminalCandidate) {
      const trigger = disposition.terminalCandidate.state === 'succeeded'
        ? 'completed'
        : 'failed';
      return this.beginTermination(trigger, disposition).then((settlement) => Object.freeze({
        disposition: settlement.disposition,
        cleanup: settlement.cleanup,
      }));
    }
    return Promise.resolve(Object.freeze({ disposition, cleanup: null }));
  }

  requestTermination(trigger: AiTerminationTrigger): Promise<AiLifecycleSettlement> {
    const active = this.active;
    if (!active) {
      return Promise.resolve(Object.freeze({
        trigger,
        disposition: Object.freeze({
          disposition: 'ignored',
          reason: 'no_active_attempt',
        }),
        cleanup: UNVERIFIED_CLEANUP,
      }));
    }
    return this.beginTermination(trigger, null);
  }

  isActive(): boolean {
    return this.active !== null;
  }

  pauseAdmission(): void {
    this.admissionPaused = true;
  }

  resumeAdmission(): void {
    this.admissionPaused = false;
  }

  read(): Readonly<{
    phase: 'idle' | 'active' | 'terminating';
    token: AiAttemptToken | null;
  }> {
    const active = this.active;
    return Object.freeze({
      phase: active?.termination ? 'terminating' : active ? 'active' : 'idle',
      token: active?.token ?? null,
    });
  }

  waitForIdle(): Promise<void> {
    return this.active?.termination?.then(() => undefined) ?? Promise.resolve();
  }

  lastSettlement(): AiLifecycleSettlement | null {
    return this.latestSettlement;
  }

  private beginAttempt():
    | Readonly<{ accepted: true; token: AiAttemptToken }>
    | Readonly<{ accepted: false; reason: 'attempt_active' | 'session_start_failed' }> {
    const started = this.controller.startAttempt();
    if (!started.accepted) return started;
    this.hasStarted = true;
    let session: AiRuntimeSession;
    try {
      session = this.createSession(started.token);
    } catch {
      this.controller.failLifecycle(started.token, 'session_start_failed');
      return Object.freeze({ accepted: false, reason: 'session_start_failed' });
    }
    const active: ActiveLifecycleAttempt = {
      token: started.token,
      session,
      cancelTimeout: () => undefined,
      termination: null,
    };
    this.active = active;
    active.cancelTimeout = this.scheduleTimeout(() => {
      void this.requestTermination('timeout');
    }, this.timeoutMs);
    return started;
  }

  private beginTermination(
    trigger: AiTerminationTrigger,
    terminalDisposition: AiAttemptDisposition | null,
  ): Promise<AiLifecycleSettlement> {
    const active = this.active;
    if (!active) return this.requestTermination(trigger);
    if (active.termination) return active.termination;
    active.cancelTimeout();
    active.termination = this.runTermination(active, trigger, terminalDisposition);
    return active.termination;
  }

  private async runTermination(
    active: ActiveLifecycleAttempt,
    trigger: AiTerminationTrigger,
    terminalDisposition: AiAttemptDisposition | null,
  ): Promise<AiLifecycleSettlement> {
    let cleanup = UNVERIFIED_CLEANUP;
    try {
      cleanup = createAiRuntimeCleanupObservation(await active.session.terminate(trigger));
    } catch {
      cleanup = UNVERIFIED_CLEANUP;
    }

    let disposition: AiAttemptDisposition;
    if (cleanup.classification === 'forced') {
      disposition = this.controller.failLifecycle(active.token, 'cleanup_forced');
    } else if (cleanup.classification !== 'graceful') {
      disposition = this.controller.failLifecycle(active.token, 'cleanup_unverified');
    } else if (trigger === 'timeout') {
      disposition = this.controller.failLifecycle(active.token, 'timeout');
    } else if (trigger === 'completed' || trigger === 'failed') {
      disposition = terminalDisposition ?? this.controller.failLifecycle(
        active.token,
        'cleanup_unverified',
      );
    } else {
      disposition = this.controller.cancel(active.token);
    }
    const settlement = Object.freeze({ trigger, disposition, cleanup });
    if (this.active === active) this.active = null;
    this.latestSettlement = settlement;
    return settlement;
  }
}

export class AiRuntimeLifecycleRegistry {
  private readonly participants = new Set<AiLifecycleParticipant>();
  private closed = false;
  private admissionPaused = false;

  track(participant: AiLifecycleParticipant): () => void {
    if (this.closed) throw new Error('AI runtime lifecycle registry is closed.');
    this.participants.add(participant);
    if (this.admissionPaused) participant.pauseAdmission();
    return () => {
      this.participants.delete(participant);
    };
  }

  prepareForLibraryReplacement(): Promise<void> {
    this.admissionPaused = true;
    for (const participant of this.participants) participant.pauseAdmission();
    return this.terminateActive('library_replacement');
  }

  resumeAfterLibraryReplacement(): void {
    if (this.closed) return;
    this.admissionPaused = false;
    for (const participant of this.participants) participant.resumeAdmission();
  }

  windowClosed(): Promise<void> {
    return this.terminateActive('window_close');
  }

  shutdown(): Promise<void> {
    this.closed = true;
    this.admissionPaused = true;
    for (const participant of this.participants) participant.pauseAdmission();
    return this.terminateActive('app_quit');
  }

  private async terminateActive(trigger: AiTerminationTrigger): Promise<void> {
    await Promise.all([...this.participants]
      .filter((participant) => participant.isActive())
      .map((participant) => participant.requestTermination(trigger)));
  }
}

function scheduleTimeout(callback: () => void, milliseconds: number): () => void {
  const handle = setTimeout(callback, milliseconds);
  return () => clearTimeout(handle);
}

function isGraceful(value: AiRuntimeCleanupObservation): boolean {
  return value.abortRequested
    && value.abortObserved
    && value.executionSettled
    && value.cleanupAcknowledged
    && value.utilityExitObserved
    && !value.utilityKillOwnershipProven
    && !value.utilityKillAttempted
    && value.residualScanCompleted
    && value.utilityResidualAbsent
    && value.cliResidualAbsent;
}

function isForced(value: AiRuntimeCleanupObservation): boolean {
  return value.utilityKillOwnershipProven
    && value.utilityKillAttempted
    && value.utilityExitObserved
    && value.residualScanCompleted
    && value.utilityResidualAbsent
    && value.cliResidualAbsent;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, expected: string[]): boolean {
  const expectedSorted = [...expected].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expectedSorted.length
    && actual.every((key, index) => key === expectedSorted[index]);
}
