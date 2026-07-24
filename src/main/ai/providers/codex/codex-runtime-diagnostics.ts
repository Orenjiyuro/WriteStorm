import {
  createAiFailureObservationAuthority,
  createAiUsageObservation,
  type AiFailureObservation,
  type AiUsageObservation,
} from '../../ai-runtime-diagnostics';

export class CodexRuntimeDiagnosticAuthority {
  readonly #failureAuthority = createAiFailureObservationAuthority();

  observeLocalSchemaFailure(observedAt: string): AiFailureObservation {
    return this.#failureAuthority.mint({
      classification: 'schema_invalid',
      evidence: 'local_validation',
      observedAt,
    });
  }

  observeUnknownRuntimeFailure(observedAt: string): AiFailureObservation {
    return this.#failureAuthority.mint({
      classification: 'runtime_unavailable',
      evidence: 'runtime_unknown',
      observedAt,
    });
  }

  observeUsage(input: unknown): AiUsageObservation {
    if (!isPlainRecord(input)
      || !hasExactKeys(input, ['input_tokens', 'cached_input_tokens', 'output_tokens'])) {
      return createAiUsageObservation(undefined);
    }
    return createAiUsageObservation({
      inputTokens: input.input_tokens,
      cachedInputTokens: input.cached_input_tokens,
      outputTokens: input.output_tokens,
    });
  }
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
