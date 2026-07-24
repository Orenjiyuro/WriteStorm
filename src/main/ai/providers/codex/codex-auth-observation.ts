import {
  type AiCompatibilityAssessment,
  type AiRuntimeObservation,
  unknownAiRuntimeObservation,
} from '../../ai-runtime-observation';

export const CODEX_AUTH_PROBE_CLASSIFICATIONS = [
  'authenticated',
  'login_required',
  'auth_failed',
  'unverified',
] as const;

export type CodexAuthProbeObservation = {
  readonly kind: 'probe';
  readonly source: 'actual_runtime';
  readonly classification: typeof CODEX_AUTH_PROBE_CLASSIFICATIONS[number];
  readonly executionSucceeded: boolean;
  readonly observedAt: string;
};

export type CodexAuthRuntimeUnavailableObservation = {
  readonly kind: 'runtime_unavailable';
  readonly source: 'actual_runtime';
  readonly observedAt: string;
};

export type CodexAuthRuntimeObservation =
  | CodexAuthProbeObservation
  | CodexAuthRuntimeUnavailableObservation;

export function parseCodexAuthRuntimeObservation(
  input: unknown,
): CodexAuthRuntimeObservation {
  if (!isPlainRecord(input) || input.source !== 'actual_runtime') {
    throw new Error('Codex auth runtime observation is invalid.');
  }
  assertObservedAt(input.observedAt);
  if (input.kind === 'runtime_unavailable') {
    assertExactKeys(input, ['kind', 'source', 'observedAt']);
    return Object.freeze({
      kind: input.kind,
      source: input.source,
      observedAt: input.observedAt,
    });
  }
  if (input.kind !== 'probe') {
    throw new Error('Codex auth runtime observation kind is invalid.');
  }
  assertExactKeys(input, [
    'kind',
    'source',
    'classification',
    'executionSucceeded',
    'observedAt',
  ]);
  if (!(CODEX_AUTH_PROBE_CLASSIFICATIONS as readonly unknown[])
    .includes(input.classification)
    || typeof input.executionSucceeded !== 'boolean') {
    throw new Error('Codex auth probe observation is invalid.');
  }
  return Object.freeze({
    kind: input.kind,
    source: input.source,
    classification: input.classification as CodexAuthProbeObservation['classification'],
    executionSucceeded: input.executionSucceeded,
    observedAt: input.observedAt,
  });
}

export function mapCodexAuthObservation(input: {
  readonly compatibility: AiCompatibilityAssessment;
  readonly observation: CodexAuthRuntimeObservation | null;
}): AiRuntimeObservation {
  if (input.compatibility.state !== 'fresh' || !input.observation) {
    return unknownAiRuntimeObservation();
  }
  const { fingerprint } = input.compatibility;
  const { observation } = input;
  if (observation.kind === 'runtime_unavailable') {
    return createObservation('auth_runtime_unavailable', observation.observedAt, fingerprint);
  }
  if (observation.classification === 'authenticated') {
    return createObservation(
      observation.executionSucceeded ? 'authenticated' : 'unknown',
      observation.observedAt,
      fingerprint,
    );
  }
  if (observation.classification === 'login_required'
    && observation.executionSucceeded === false) {
    return createObservation('auth_required', observation.observedAt, fingerprint);
  }
  return createObservation('unknown', observation.observedAt, fingerprint);
}

function createObservation(
  authState: AiRuntimeObservation['authState'],
  observedAt: string,
  compatibilityFingerprint: string,
): AiRuntimeObservation {
  return Object.freeze({ authState, observedAt, compatibilityFingerprint });
}

function assertObservedAt(value: unknown): asserts value is string {
  if (typeof value !== 'string'
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    throw new Error('Codex auth observation time is invalid.');
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): void {
  if (Object.keys(value).sort().join('\0') !== [...expected].sort().join('\0')) {
    throw new Error('Codex auth observation contains unknown fields.');
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
