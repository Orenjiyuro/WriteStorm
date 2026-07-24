import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AiDiagnosticLog,
  createAiFailureObservationAuthority,
  createAiUsageObservation,
  mapAiFailureToDomainError,
  type AiFailureObservation,
} from '../../src/main/ai/ai-runtime-diagnostics';

const observedAt = '2026-07-24T10:00:00.000Z';
const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.10 provider-neutral runtime diagnostics', () => {
  it.each([
    ['auth', 'structured_runtime', 'AI_AUTH_ERROR'],
    ['rate_limited', 'structured_runtime', 'AI_RATE_LIMITED'],
    ['schema_invalid', 'local_validation', 'AI_SCHEMA_INVALID'],
    ['network_unavailable', 'structured_runtime', 'AI_NETWORK_UNAVAILABLE'],
    ['runtime_unavailable', 'runtime_unknown', 'AI_RUNTIME_UNAVAILABLE'],
  ] as const)('maps %s to one stable sanitized DomainError', (
    classification,
    evidence,
    code,
  ) => {
    const authority = createAiFailureObservationAuthority();
    const observation = authority.mint({ classification, evidence, observedAt });
    const error = mapAiFailureToDomainError(observation);

    expect(error).toMatchObject({ code, recoverable: expect.any(Boolean) });
    expect(Object.keys(error).sort()).toEqual(['code', 'message', 'recoverable']);
    expect(JSON.stringify(error)).not.toMatch(
      /prompt|response|provider|credential|environment|path|stack|cause/i,
    );
  });

  it('requires structured evidence for auth, rate and network classifications', () => {
    const authority = createAiFailureObservationAuthority();

    for (const classification of ['auth', 'rate_limited', 'network_unavailable']) {
      expect(() => authority.mint({
        classification,
        evidence: 'runtime_unknown',
        observedAt,
      })).toThrow('AI failure observation is invalid.');
    }
    expect(() => authority.mint({
      classification: 'runtime_unavailable',
      evidence: 'structured_runtime',
      observedAt,
    })).toThrow('AI failure observation is invalid.');
    expect(() => authority.mint({
      classification: 'runtime_unavailable',
      evidence: 'runtime_unknown',
      observedAt,
      rawError: 'secret',
    })).toThrow('AI failure observation is invalid.');
  });

  it('rejects a structurally forged failure observation', () => {
    expect(() => mapAiFailureToDomainError({
      classification: 'auth',
      evidence: 'structured_runtime',
      observedAt,
    } as AiFailureObservation)).toThrow('AI failure observation is not authoritative.');
  });

  it('reports usage only when every source field is a non-negative safe integer', () => {
    expect(createAiUsageObservation({
      inputTokens: 10,
      cachedInputTokens: 4,
      outputTokens: 3,
    })).toEqual({
      availability: 'reported',
      inputTokens: 10,
      cachedInputTokens: 4,
      outputTokens: 3,
    });

    for (const input of [
      undefined,
      {},
      { inputTokens: 10, outputTokens: 3 },
      { inputTokens: 10, cachedInputTokens: -1, outputTokens: 3 },
      { inputTokens: 10.5, cachedInputTokens: 4, outputTokens: 3 },
      { inputTokens: 10, cachedInputTokens: 4, outputTokens: 3, totalTokens: 17 },
      { inputTokens: 10, cachedInputTokens: 4, outputTokens: 3, estimatedCost: 1 },
    ]) {
      expect(createAiUsageObservation(input)).toEqual({ availability: 'unknown' });
    }
  });

  it('keeps a bounded in-memory log containing only closed sanitized records', () => {
    const authority = createAiFailureObservationAuthority();
    const log = new AiDiagnosticLog({ capacity: 2 });
    const usage = createAiUsageObservation({
      inputTokens: 10,
      cachedInputTokens: 4,
      outputTokens: 3,
    });

    log.recordFailure({
      token: { attempt: 1, generation: 1 },
      failure: authority.mint({
        classification: 'runtime_unavailable',
        evidence: 'runtime_unknown',
        observedAt,
      }),
    });
    log.recordUsage({
      token: { attempt: 1, generation: 1 },
      observedAt,
      usage,
    });
    log.recordUsage({
      token: { attempt: 2, generation: 2 },
      observedAt,
      usage: createAiUsageObservation(undefined),
    });

    const records = log.read();
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      kind: 'usage',
      availability: 'reported',
      inputTokens: 10,
      cachedInputTokens: 4,
      outputTokens: 3,
    });
    expect(records[1]).toMatchObject({ kind: 'usage', availability: 'unknown' });
    expect(Object.isFrozen(records)).toBe(true);
    expect(records.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(records)).not.toMatch(
      /prompt|response|raw|provider|credential|environment|path|secret|cost|total/i,
    );
    expect(() => new AiDiagnosticLog({ capacity: 257 })).toThrow(
      'AI diagnostic log configuration is invalid.',
    );
  });

  it('rejects free-form logging fields rather than attempting heuristic redaction', () => {
    const authority = createAiFailureObservationAuthority();
    const log = new AiDiagnosticLog({ capacity: 2 });

    expect(() => log.recordFailure({
      token: { attempt: 1, generation: 1 },
      failure: authority.mint({
        classification: 'runtime_unavailable',
        evidence: 'runtime_unknown',
        observedAt,
      }),
      rawError: 'secret provider message',
    } as never)).toThrow('AI diagnostic log input is invalid.');
  });

  it('has no disk, network, console or remote-telemetry side effect surface', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/ai/ai-runtime-diagnostics.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/node:fs|node:http|node:https|node:net|fetch\s*\(|console\.|telemetry/i);
    expect(source).not.toMatch(/prompt|responseBody|rawError|providerId|credential|estimatedCost/i);
  });
});
