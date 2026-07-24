import {
  AI_TERMINATION_TRIGGERS,
  type AiTerminationTrigger,
} from '../../ai-attempt-lifecycle';
import type { AiAttemptToken } from '../../ai-execution-port';

export type CodexUtilityAbortRequest = {
  readonly version: 1;
  readonly origin: 'main';
  readonly type: 'ai.abort';
  readonly token: AiAttemptToken;
  readonly trigger: AiTerminationTrigger;
};

export type CodexUtilityShutdownRequest = {
  readonly version: 1;
  readonly origin: 'main';
  readonly type: 'ai.shutdown';
  readonly token: AiAttemptToken;
};

export type CodexUtilityLifecycleRequest =
  | CodexUtilityAbortRequest
  | CodexUtilityShutdownRequest;

export type CodexUtilityAbortResponse = {
  readonly version: 1;
  readonly origin: 'utility';
  readonly type: 'ai.abort-result';
  readonly token: AiAttemptToken;
  readonly abortRequested: boolean;
  readonly abortObserved: boolean;
  readonly executionSettled: boolean;
};

export type CodexUtilityShutdownResponse = {
  readonly version: 1;
  readonly origin: 'utility';
  readonly type: 'ai.shutdown-result';
  readonly token: AiAttemptToken;
  readonly cleanupAcknowledged: boolean;
};

export type CodexUtilityLifecycleResponse =
  | CodexUtilityAbortResponse
  | CodexUtilityShutdownResponse;

export function isCodexUtilityLifecycleRequest(
  value: unknown,
): value is CodexUtilityLifecycleRequest {
  if (!isPlainRecord(value)
    || value.version !== 1
    || value.origin !== 'main'
    || !isAttemptToken(value.token)) {
    return false;
  }
  if (value.type === 'ai.abort') {
    return hasExactKeys(value, ['version', 'origin', 'type', 'token', 'trigger'])
      && typeof value.trigger === 'string'
      && (AI_TERMINATION_TRIGGERS as readonly string[]).includes(value.trigger);
  }
  return value.type === 'ai.shutdown'
    && hasExactKeys(value, ['version', 'origin', 'type', 'token']);
}

export function isCodexUtilityLifecycleResponse(
  value: unknown,
): value is CodexUtilityLifecycleResponse {
  if (!isPlainRecord(value)
    || value.version !== 1
    || value.origin !== 'utility'
    || !isAttemptToken(value.token)) {
    return false;
  }
  if (value.type === 'ai.abort-result') {
    return hasExactKeys(value, [
      'version',
      'origin',
      'type',
      'token',
      'abortRequested',
      'abortObserved',
      'executionSettled',
    ])
      && typeof value.abortRequested === 'boolean'
      && typeof value.abortObserved === 'boolean'
      && typeof value.executionSettled === 'boolean';
  }
  return value.type === 'ai.shutdown-result'
    && hasExactKeys(value, [
      'version',
      'origin',
      'type',
      'token',
      'cleanupAcknowledged',
    ])
    && typeof value.cleanupAcknowledged === 'boolean';
}

export function sameAttemptToken(left: AiAttemptToken, right: AiAttemptToken): boolean {
  return left.attempt === right.attempt && left.generation === right.generation;
}

function isAttemptToken(value: unknown): value is AiAttemptToken {
  return isPlainRecord(value)
    && hasExactKeys(value, ['attempt', 'generation'])
    && Number.isSafeInteger(value.attempt)
    && Number(value.attempt) > 0
    && Number.isSafeInteger(value.generation)
    && Number(value.generation) > 0;
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
