import {
  createDomainError,
  type DomainError,
  type DomainErrorCode,
} from '../../shared/errors';

export const AI_FAILURE_CLASSIFICATIONS = [
  'auth',
  'rate_limited',
  'schema_invalid',
  'network_unavailable',
  'runtime_unavailable',
] as const;

export const AI_DIAGNOSTIC_LOG_MAX_ENTRIES = 256;

export type AiFailureClassification = (typeof AI_FAILURE_CLASSIFICATIONS)[number];
export type AiFailureEvidence =
  | 'structured_runtime'
  | 'local_validation'
  | 'runtime_unknown';
type AiDomainErrorCode = Extract<
  DomainErrorCode,
  | 'AI_AUTH_ERROR'
  | 'AI_RATE_LIMITED'
  | 'AI_SCHEMA_INVALID'
  | 'AI_NETWORK_UNAVAILABLE'
  | 'AI_RUNTIME_UNAVAILABLE'
>;

declare const failureObservationBrand: unique symbol;
declare const usageObservationBrand: unique symbol;

export type AiFailureObservation = Readonly<{
  readonly [failureObservationBrand]: never;
  classification: AiFailureClassification;
  evidence: AiFailureEvidence;
  observedAt: string;
}>;

export type AiUsageObservation =
  | Readonly<{
    readonly [usageObservationBrand]: never;
    availability: 'reported';
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  }>
  | Readonly<{
    readonly [usageObservationBrand]: never;
    availability: 'unknown';
  }>;

export type AiDiagnosticLogRecord =
  | Readonly<{
    kind: 'failure';
    observedAt: string;
    attempt: number;
    generation: number;
    code: AiDomainErrorCode;
  }>
  | Readonly<{
    kind: 'usage';
    observedAt: string;
    attempt: number;
    generation: number;
    availability: 'unknown';
  }>
  | Readonly<{
    kind: 'usage';
    observedAt: string;
    attempt: number;
    generation: number;
    availability: 'reported';
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  }>;

const authoritativeFailureObservations = new WeakSet<object>();
const authoritativeUsageObservations = new WeakSet<object>();
const unknownUsageObservation = Object.freeze({
  availability: 'unknown',
}) as AiUsageObservation;
authoritativeUsageObservations.add(unknownUsageObservation);

const failureDomainErrors = Object.freeze({
  auth: Object.freeze({
    code: 'AI_AUTH_ERROR',
    message: 'AI authentication is unavailable.',
    recoverable: true,
  }),
  rate_limited: Object.freeze({
    code: 'AI_RATE_LIMITED',
    message: 'AI service is temporarily rate limited.',
    recoverable: true,
  }),
  schema_invalid: Object.freeze({
    code: 'AI_SCHEMA_INVALID',
    message: 'AI structured output is invalid.',
    recoverable: false,
  }),
  network_unavailable: Object.freeze({
    code: 'AI_NETWORK_UNAVAILABLE',
    message: 'AI network connection is unavailable.',
    recoverable: true,
  }),
  runtime_unavailable: Object.freeze({
    code: 'AI_RUNTIME_UNAVAILABLE',
    message: 'AI runtime is unavailable.',
    recoverable: true,
  }),
} satisfies Record<AiFailureClassification, DomainError>);

export function createAiFailureObservationAuthority(): Readonly<{
  mint(input: unknown): AiFailureObservation;
}> {
  return Object.freeze({
    mint(input: unknown): AiFailureObservation {
      if (!isPlainRecord(input)
        || !hasExactKeys(input, ['classification', 'evidence', 'observedAt'])
        || !isFailureClassification(input.classification)
        || !isFailureEvidence(input.evidence)
        || !isCanonicalIsoTimestamp(input.observedAt)
        || !evidenceMatches(input.classification, input.evidence)) {
        throw new Error('AI failure observation is invalid.');
      }
      const observation = Object.freeze({
        classification: input.classification,
        evidence: input.evidence,
        observedAt: input.observedAt,
      }) as AiFailureObservation;
      authoritativeFailureObservations.add(observation);
      return observation;
    },
  });
}

export function mapAiFailureToDomainError(
  observation: AiFailureObservation,
): DomainError {
  if (!isPlainRecord(observation)
    || !authoritativeFailureObservations.has(observation)) {
    throw new Error('AI failure observation is not authoritative.');
  }
  return Object.freeze(createDomainError(failureDomainErrors[observation.classification]));
}

export function createAiUsageObservation(input: unknown): AiUsageObservation {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, ['inputTokens', 'cachedInputTokens', 'outputTokens'])
    || !isNonNegativeSafeInteger(input.inputTokens)
    || !isNonNegativeSafeInteger(input.cachedInputTokens)
    || !isNonNegativeSafeInteger(input.outputTokens)) {
    return unknownUsageObservation;
  }
  const observation = Object.freeze({
    availability: 'reported',
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens,
    outputTokens: input.outputTokens,
  }) as AiUsageObservation;
  authoritativeUsageObservations.add(observation);
  return observation;
}

export function isAiUsageObservation(value: unknown): value is AiUsageObservation {
  return isPlainRecord(value) && authoritativeUsageObservations.has(value);
}

export class AiDiagnosticLog {
  readonly #capacity: number;
  readonly #records: AiDiagnosticLogRecord[] = [];

  constructor(input: unknown) {
    if (!isPlainRecord(input)
      || !hasExactKeys(input, ['capacity'])
      || !Number.isSafeInteger(input.capacity)
      || Number(input.capacity) < 1
      || Number(input.capacity) > AI_DIAGNOSTIC_LOG_MAX_ENTRIES) {
      throw new Error('AI diagnostic log configuration is invalid.');
    }
    this.#capacity = Number(input.capacity);
  }

  recordFailure(input: unknown): void {
    if (!isPlainRecord(input)
      || !hasExactKeys(input, ['token', 'failure'])
      || !isAttemptToken(input.token)
      || !isPlainRecord(input.failure)
      || !authoritativeFailureObservations.has(input.failure)) {
      throw new Error('AI diagnostic log input is invalid.');
    }
    const failure = input.failure as AiFailureObservation;
    this.#append(Object.freeze({
      kind: 'failure',
      observedAt: failure.observedAt,
      attempt: input.token.attempt,
      generation: input.token.generation,
      code: failureDomainErrors[failure.classification].code,
    }) as AiDiagnosticLogRecord);
  }

  recordUsage(input: unknown): void {
    if (!isPlainRecord(input)
      || !hasExactKeys(input, ['token', 'observedAt', 'usage'])
      || !isAttemptToken(input.token)
      || !isCanonicalIsoTimestamp(input.observedAt)
      || !isAiUsageObservation(input.usage)) {
      throw new Error('AI diagnostic log input is invalid.');
    }
    const usage = input.usage;
    this.#append(Object.freeze(usage.availability === 'reported'
      ? {
        kind: 'usage',
        observedAt: input.observedAt,
        attempt: input.token.attempt,
        generation: input.token.generation,
        availability: usage.availability,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
      }
      : {
        kind: 'usage',
        observedAt: input.observedAt,
        attempt: input.token.attempt,
        generation: input.token.generation,
        availability: usage.availability,
      }) as AiDiagnosticLogRecord);
  }

  read(): readonly AiDiagnosticLogRecord[] {
    return Object.freeze([...this.#records]);
  }

  #append(record: AiDiagnosticLogRecord): void {
    if (this.#records.length === this.#capacity) this.#records.shift();
    this.#records.push(record);
  }
}

function evidenceMatches(
  classification: AiFailureClassification,
  evidence: AiFailureEvidence,
): boolean {
  if (classification === 'auth'
    || classification === 'rate_limited'
    || classification === 'network_unavailable') {
    return evidence === 'structured_runtime';
  }
  if (classification === 'schema_invalid') return evidence === 'local_validation';
  return evidence === 'runtime_unknown';
}

function isFailureClassification(value: unknown): value is AiFailureClassification {
  return typeof value === 'string'
    && AI_FAILURE_CLASSIFICATIONS.includes(value as AiFailureClassification);
}

function isFailureEvidence(value: unknown): value is AiFailureEvidence {
  return value === 'structured_runtime'
    || value === 'local_validation'
    || value === 'runtime_unknown';
}

function isAttemptToken(value: unknown): value is {
  readonly attempt: number;
  readonly generation: number;
} {
  return isPlainRecord(value)
    && hasExactKeys(value, ['attempt', 'generation'])
    && Number.isSafeInteger(value.attempt)
    && Number(value.attempt) > 0
    && Number.isSafeInteger(value.generation)
    && Number(value.generation) > 0;
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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
