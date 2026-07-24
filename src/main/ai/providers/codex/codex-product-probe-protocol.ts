import type { AiAttemptToken } from '../../ai-execution-port';

export const CODEX_PRODUCT_PROBE_SCENARIOS = [
  'success',
  'cancel',
  'timeout',
] as const;

export type CodexProductProbeScenario =
  (typeof CODEX_PRODUCT_PROBE_SCENARIOS)[number];

export type CodexProductProbeRequest = {
  readonly version: 1;
  readonly origin: 'main';
  readonly type: 'ai.product-probe.start';
  readonly token: AiAttemptToken;
  readonly scenario: CodexProductProbeScenario;
  readonly fixtureId: 'block13-product-packaged-probe-v1';
};

export type CodexProductProbeStartedResponse = {
  readonly version: 1;
  readonly origin: 'utility';
  readonly type: 'ai.product-probe.started';
  readonly token: AiAttemptToken;
  readonly scenario: CodexProductProbeScenario;
};

export type CodexProductProbeUtilityAssertions = {
  readonly sdkImported: boolean;
  readonly clientConstructed: boolean;
  readonly scratchInsideOsTemp: boolean;
  readonly nonGitWorkspace: boolean;
  readonly skipGitRepoCheck: boolean;
  readonly environmentAllowlisted: boolean;
  readonly finalJsonParsed: boolean;
  readonly strictValidatorAccepted: boolean;
  readonly expectedValueMatched: boolean;
  readonly abortObserved: boolean;
  readonly scratchCleanupCompleted: boolean;
};

export type CodexProductProbeResultResponse = {
  readonly version: 1;
  readonly origin: 'utility';
  readonly type: 'ai.product-probe.result';
  readonly token: AiAttemptToken;
  readonly scenario: CodexProductProbeScenario;
  readonly outcome: 'success' | 'aborted' | 'runtime_unavailable';
  readonly assertions: CodexProductProbeUtilityAssertions;
};

export type CodexProductProbeResponse =
  | CodexProductProbeStartedResponse
  | CodexProductProbeResultResponse;

export function isCodexProductProbeRequest(
  value: unknown,
): value is CodexProductProbeRequest {
  return isPlainRecord(value)
    && hasExactKeys(value, [
      'version',
      'origin',
      'type',
      'token',
      'scenario',
      'fixtureId',
    ])
    && value.version === 1
    && value.origin === 'main'
    && value.type === 'ai.product-probe.start'
    && isAttemptToken(value.token)
    && isScenario(value.scenario)
    && value.fixtureId === 'block13-product-packaged-probe-v1';
}

export function isCodexProductProbeResponse(
  value: unknown,
): value is CodexProductProbeResponse {
  if (
    !isPlainRecord(value)
    || value.version !== 1
    || value.origin !== 'utility'
    || !isAttemptToken(value.token)
    || !isScenario(value.scenario)
  ) {
    return false;
  }
  if (value.type === 'ai.product-probe.started') {
    return hasExactKeys(value, [
      'version',
      'origin',
      'type',
      'token',
      'scenario',
    ]);
  }
  return value.type === 'ai.product-probe.result'
    && hasExactKeys(value, [
      'version',
      'origin',
      'type',
      'token',
      'scenario',
      'outcome',
      'assertions',
    ])
    && (
      value.outcome === 'success'
      || value.outcome === 'aborted'
      || value.outcome === 'runtime_unavailable'
    )
    && isUtilityAssertions(value.assertions);
}

function isUtilityAssertions(
  value: unknown,
): value is CodexProductProbeUtilityAssertions {
  const keys = [
    'sdkImported',
    'clientConstructed',
    'scratchInsideOsTemp',
    'nonGitWorkspace',
    'skipGitRepoCheck',
    'environmentAllowlisted',
    'finalJsonParsed',
    'strictValidatorAccepted',
    'expectedValueMatched',
    'abortObserved',
    'scratchCleanupCompleted',
  ];
  return isPlainRecord(value)
    && hasExactKeys(value, keys)
    && keys.every((key) => typeof value[key] === 'boolean');
}

function isScenario(value: unknown): value is CodexProductProbeScenario {
  return typeof value === 'string'
    && (CODEX_PRODUCT_PROBE_SCENARIOS as readonly string[]).includes(value);
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
