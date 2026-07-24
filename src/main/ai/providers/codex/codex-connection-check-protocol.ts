import type { AiAttemptToken } from '../../ai-execution-port';

export type CodexConnectionCheckRequest = {
  readonly version: 1;
  readonly origin: 'main';
  readonly type: 'ai.connection-check.start';
  readonly token: AiAttemptToken;
  readonly fixtureId: 'block13-connection-check-v1';
};

export type CodexConnectionCheckResponse =
  | {
    readonly version: 1;
    readonly origin: 'utility';
    readonly type: 'ai.connection-check.started';
    readonly token: AiAttemptToken;
  }
  | {
    readonly version: 1;
    readonly origin: 'utility';
    readonly type: 'ai.connection-check.result';
    readonly token: AiAttemptToken;
    readonly outcome: 'authenticated' | 'runtime_unavailable';
  };

export function isCodexConnectionCheckRequest(
  value: unknown,
): value is CodexConnectionCheckRequest {
  return isPlainRecord(value)
    && hasExactKeys(value, ['version', 'origin', 'type', 'token', 'fixtureId'])
    && value.version === 1
    && value.origin === 'main'
    && value.type === 'ai.connection-check.start'
    && isAttemptToken(value.token)
    && value.fixtureId === 'block13-connection-check-v1';
}

export function isCodexConnectionCheckResponse(
  value: unknown,
): value is CodexConnectionCheckResponse {
  if (!isPlainRecord(value)
    || value.version !== 1
    || value.origin !== 'utility'
    || !isAttemptToken(value.token)) {
    return false;
  }
  if (value.type === 'ai.connection-check.started') {
    return hasExactKeys(value, ['version', 'origin', 'type', 'token']);
  }
  return value.type === 'ai.connection-check.result'
    && hasExactKeys(value, ['version', 'origin', 'type', 'token', 'outcome'])
    && (value.outcome === 'authenticated' || value.outcome === 'runtime_unavailable');
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
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length
    && actual.every((key, index) => key === sorted[index]);
}
