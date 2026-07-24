import { Buffer } from 'node:buffer';
import {
  type AiAttemptToken,
  type AiExecutionEvent,
} from './ai-execution-port';
import type { AiUsageObservation } from './ai-runtime-diagnostics';
import {
  type AiStructuredOutputContract,
  type AiStructuredOutputRejection,
  type AiStructuredOutputValue,
  validateAiStructuredOutput,
} from './ai-structured-output';

export const AI_ATTEMPT_RESOURCE_CEILINGS = Object.freeze({
  maxEventBytes: 2_621_440,
  maxTotalBytes: 16_777_216,
  maxEventCount: 4_096,
  maxPartialBytes: 1_048_576,
});

export type AiAttemptResourceLimits = {
  readonly maxEventBytes: number;
  readonly maxTotalBytes: number;
  readonly maxEventCount: number;
  readonly maxPartialBytes: number;
};

export type AiAttemptResource = 'event_bytes'
  | 'total_bytes'
  | 'event_count'
  | 'partial_bytes';

export type AiCheckpointCandidate = {
  readonly kind: 'checkpoint_candidate';
  readonly token: AiAttemptToken;
  readonly sequence: number;
  readonly progressEventCount: number;
  readonly partial: string | null;
  readonly resources: {
    readonly eventCount: number;
    readonly totalBytes: number;
    readonly partialBytes: number;
  };
};

export type AiTerminalStateCandidate =
  | {
    readonly kind: 'terminal_state_candidate';
    readonly token: AiAttemptToken;
    readonly sequence: number;
    readonly state: 'succeeded';
    readonly value: AiStructuredOutputValue;
    readonly usage: AiUsageObservation;
  }
  | {
    readonly kind: 'terminal_state_candidate';
    readonly token: AiAttemptToken;
    readonly sequence: number;
    readonly state: 'failed';
    readonly reason: 'invalid_final';
    readonly finalClassification: AiStructuredOutputRejection;
  }
  | {
    readonly kind: 'terminal_state_candidate';
    readonly token: AiAttemptToken;
    readonly sequence: number;
    readonly state: 'failed';
    readonly reason: 'resource_limit';
    readonly resource: AiAttemptResource;
  }
  | {
    readonly kind: 'terminal_state_candidate';
    readonly token: AiAttemptToken;
    readonly sequence: number;
    readonly state: 'failed';
    readonly reason:
      | 'event_sequence_violation'
      | 'runtime_error'
      | 'incomplete_stream'
      | 'timeout'
      | 'cleanup_forced'
      | 'cleanup_unverified'
      | 'session_start_failed';
  }
  | {
    readonly kind: 'terminal_state_candidate';
    readonly token: AiAttemptToken;
    readonly sequence: number;
    readonly state: 'cancelled';
  };

export type AiAttemptAcceptance = Readonly<{
  disposition: 'accepted';
  checkpointCandidate: AiCheckpointCandidate | null;
  terminalCandidate: AiTerminalStateCandidate | null;
}>;

export type AiAttemptIgnored = Readonly<{
  disposition: 'ignored';
  reason: 'no_active_attempt' | 'stale_generation' | 'attempt_terminal';
}>;

export type AiAttemptDisposition = AiAttemptAcceptance | AiAttemptIgnored;

export type AiAttemptSnapshot =
  | Readonly<{
    phase: 'idle';
    token: null;
  }>
  | Readonly<{
    phase: 'active' | 'terminal';
    token: AiAttemptToken;
    expectedSequence: number;
    progressEventCount: number;
    eventCount: number;
    totalBytes: number;
    partialBytes: number;
  }>;

type ActiveAttempt = {
  readonly token: AiAttemptToken;
  expectedSequence: number;
  progressEventCount: number;
  eventCount: number;
  totalBytes: number;
  partial: string | null;
  terminal: AiTerminalStateCandidate | null;
};

export function createAiAttemptResourceLimits(
  input: AiAttemptResourceLimits,
): AiAttemptResourceLimits {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, Object.keys(AI_ATTEMPT_RESOURCE_CEILINGS))
    || !isLimit(input.maxEventBytes, AI_ATTEMPT_RESOURCE_CEILINGS.maxEventBytes)
    || !isLimit(input.maxTotalBytes, AI_ATTEMPT_RESOURCE_CEILINGS.maxTotalBytes)
    || !isLimit(input.maxEventCount, AI_ATTEMPT_RESOURCE_CEILINGS.maxEventCount)
    || !isLimit(input.maxPartialBytes, AI_ATTEMPT_RESOURCE_CEILINGS.maxPartialBytes)) {
    throw new Error('AI attempt resource limits are invalid.');
  }
  return Object.freeze({ ...input });
}

export class AiAttemptController {
  private readonly structuredOutput: AiStructuredOutputContract;
  private readonly resourceLimits: AiAttemptResourceLimits;
  private attemptCounter = 0;
  private generationCounter = 0;
  private current: ActiveAttempt | null = null;

  constructor(input: {
    readonly structuredOutput: AiStructuredOutputContract;
    readonly resourceLimits: AiAttemptResourceLimits;
  }) {
    this.structuredOutput = input.structuredOutput;
    this.resourceLimits = createAiAttemptResourceLimits(input.resourceLimits);
  }

  startAttempt():
    | Readonly<{ accepted: true; token: AiAttemptToken }>
    | Readonly<{ accepted: false; reason: 'attempt_active' }> {
    if (this.current && !this.current.terminal) {
      return Object.freeze({ accepted: false, reason: 'attempt_active' });
    }
    const token = Object.freeze({
      attempt: ++this.attemptCounter,
      generation: ++this.generationCounter,
    });
    this.current = {
      token,
      expectedSequence: 1,
      progressEventCount: 0,
      eventCount: 0,
      totalBytes: 0,
      partial: null,
      terminal: null,
    };
    return Object.freeze({ accepted: true, token });
  }

  accept(event: AiExecutionEvent): AiAttemptDisposition {
    const current = this.current;
    const eligibility = this.checkEligibility(event);
    if (eligibility) return eligibility;
    if (!current) return ignored('no_active_attempt');

    if (event.sequence !== current.expectedSequence) {
      return this.finish(failedCandidate(
        current.token,
        event.sequence,
        'event_sequence_violation',
      ));
    }

    const eventBytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
    const nextEventCount = current.eventCount + 1;
    const nextTotalBytes = current.totalBytes + eventBytes;
    const exceeded = eventBytes > this.resourceLimits.maxEventBytes
      ? 'event_bytes'
      : nextTotalBytes > this.resourceLimits.maxTotalBytes
        ? 'total_bytes'
        : nextEventCount > this.resourceLimits.maxEventCount
          ? 'event_count'
          : null;
    if (exceeded) {
      return this.finish(resourceCandidate(current.token, event.sequence, exceeded));
    }

    current.eventCount = nextEventCount;
    current.totalBytes = nextTotalBytes;
    current.expectedSequence += 1;

    if (event.kind === 'error') {
      return this.finish(failedCandidate(current.token, event.sequence, 'runtime_error'));
    }
    if (event.kind === 'final') {
      const validation = validateAiStructuredOutput(this.structuredOutput, event.content);
      if (!validation.accepted) {
        return this.finish(Object.freeze({
          kind: 'terminal_state_candidate',
          token: current.token,
          sequence: event.sequence,
          state: 'failed',
          reason: 'invalid_final',
          finalClassification: validation.classification,
        }));
      }
      return this.finish(Object.freeze({
        kind: 'terminal_state_candidate',
        token: current.token,
        sequence: event.sequence,
        state: 'succeeded',
        value: validation.value,
        usage: event.usage,
      }));
    }

    if (event.kind === 'progress') current.progressEventCount += 1;
    if (event.kind === 'partial') {
      const partialBytes = Buffer.byteLength(event.content, 'utf8');
      if (partialBytes > this.resourceLimits.maxPartialBytes) {
        return this.finish(resourceCandidate(
          current.token,
          event.sequence,
          'partial_bytes',
        ));
      }
      current.partial = event.content;
    }
    return accepted(checkpointCandidate(current));
  }

  cancel(token: AiAttemptToken): AiAttemptDisposition {
    const eligibility = this.checkEligibility(token);
    if (eligibility) return eligibility;
    const current = this.current;
    if (!current) return ignored('no_active_attempt');
    return this.finish(Object.freeze({
      kind: 'terminal_state_candidate',
      token: current.token,
      sequence: current.expectedSequence - 1,
      state: 'cancelled',
    }));
  }

  endInput(token: AiAttemptToken): AiAttemptDisposition {
    const eligibility = this.checkEligibility(token);
    if (eligibility) return eligibility;
    const current = this.current;
    if (!current) return ignored('no_active_attempt');
    return this.finish(failedCandidate(
      current.token,
      current.expectedSequence - 1,
      'incomplete_stream',
    ));
  }

  failLifecycle(
    token: AiAttemptToken,
    reason: 'timeout' | 'cleanup_forced' | 'cleanup_unverified' | 'session_start_failed',
  ): AiAttemptDisposition {
    const current = this.current;
    if (!current) return ignored('no_active_attempt');
    if (token.attempt !== current.token.attempt
      || token.generation !== current.token.generation) {
      return ignored('stale_generation');
    }
    return this.finish(failedCandidate(
      current.token,
      current.expectedSequence - 1,
      reason,
    ));
  }

  read(): AiAttemptSnapshot {
    const current = this.current;
    if (!current) return Object.freeze({ phase: 'idle', token: null });
    return Object.freeze({
      phase: current.terminal ? 'terminal' : 'active',
      token: current.token,
      expectedSequence: current.expectedSequence,
      progressEventCount: current.progressEventCount,
      eventCount: current.eventCount,
      totalBytes: current.totalBytes,
      partialBytes: current.partial === null
        ? 0
        : Buffer.byteLength(current.partial, 'utf8'),
    });
  }

  private checkEligibility(token: AiAttemptToken): AiAttemptIgnored | null {
    const current = this.current;
    if (!current) return ignored('no_active_attempt');
    if (token.attempt !== current.token.attempt
      || token.generation !== current.token.generation) {
      return ignored('stale_generation');
    }
    if (current.terminal) return ignored('attempt_terminal');
    return null;
  }

  private finish(candidate: AiTerminalStateCandidate): AiAttemptAcceptance {
    if (!this.current) throw new Error('AI attempt state is unavailable.');
    this.current.terminal = candidate;
    return accepted(null, candidate);
  }
}

function checkpointCandidate(current: ActiveAttempt): AiCheckpointCandidate {
  return Object.freeze({
    kind: 'checkpoint_candidate',
    token: current.token,
    sequence: current.expectedSequence - 1,
    progressEventCount: current.progressEventCount,
    partial: current.partial,
    resources: Object.freeze({
      eventCount: current.eventCount,
      totalBytes: current.totalBytes,
      partialBytes: current.partial === null
        ? 0
        : Buffer.byteLength(current.partial, 'utf8'),
    }),
  });
}

function resourceCandidate(
  token: AiAttemptToken,
  sequence: number,
  resource: AiAttemptResource,
): AiTerminalStateCandidate {
  return Object.freeze({
    kind: 'terminal_state_candidate',
    token,
    sequence,
    state: 'failed',
    reason: 'resource_limit',
    resource,
  });
}

function failedCandidate(
  token: AiAttemptToken,
  sequence: number,
  reason:
    | 'event_sequence_violation'
    | 'runtime_error'
    | 'incomplete_stream'
    | 'timeout'
    | 'cleanup_forced'
    | 'cleanup_unverified'
    | 'session_start_failed',
): AiTerminalStateCandidate {
  return Object.freeze({
    kind: 'terminal_state_candidate',
    token,
    sequence,
    state: 'failed',
    reason,
  });
}

function accepted(
  checkpointCandidateValue: AiCheckpointCandidate | null,
  terminalCandidateValue: AiTerminalStateCandidate | null = null,
): AiAttemptAcceptance {
  return Object.freeze({
    disposition: 'accepted',
    checkpointCandidate: checkpointCandidateValue,
    terminalCandidate: terminalCandidateValue,
  });
}

function ignored(reason: AiAttemptIgnored['reason']): AiAttemptIgnored {
  return Object.freeze({ disposition: 'ignored', reason });
}

function isLimit(value: unknown, ceiling: number): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= ceiling;
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
