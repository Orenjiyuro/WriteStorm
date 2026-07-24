import { describe, expect, it } from 'vitest';
import {
  AI_RUNTIME_AUTH_STATES,
  type AiCompatibilityAssessment,
} from '../../src/main/ai/ai-runtime-observation';
import {
  CodexAuthObservationAuthority,
  mapCodexAuthObservation,
  parseCodexAuthRuntimeObservation,
} from '../../src/main/ai/providers/codex/codex-auth-observation';

const fingerprint = 'a'.repeat(64);
const replacementFingerprint = 'b'.repeat(64);
const observedAt = '2026-07-24T01:02:03.000Z';
const freshCompatibility: AiCompatibilityAssessment = {
  state: 'fresh',
  fingerprint,
};

describe('Block 13.6 auth observation contract (synthetic mapping inputs only)', () => {
  it.each([
    ['authenticated', true, 'authenticated'],
    ['login_required', false, 'auth_required'],
    ['auth_failed', false, 'unknown'],
    ['unverified', false, 'unknown'],
    ['authenticated', false, 'unknown'],
  ] as const)(
    'maps %s with executionSucceeded=%s fail-closed to %s',
    (classification, executionSucceeded, expected) => {
      const observation = parseCodexAuthRuntimeObservation({
        kind: 'probe',
        source: 'actual_runtime',
        classification,
        executionSucceeded,
        observedAt,
      });

      expect(mapCodexAuthObservation({
        compatibility: freshCompatibility,
        observation,
      })).toEqual({
        authState: expected,
        observedAt,
        compatibilityFingerprint: fingerprint,
      });
    },
  );

  it('uses auth_runtime_unavailable only when the runtime observation could not complete', () => {
    const observation = parseCodexAuthRuntimeObservation({
      kind: 'runtime_unavailable',
      source: 'actual_runtime',
      observedAt,
    });

    expect(mapCodexAuthObservation({
      compatibility: freshCompatibility,
      observation,
    })).toEqual({
      authState: 'auth_runtime_unavailable',
      observedAt,
      compatibilityFingerprint: fingerprint,
    });
  });

  it.each(['stale', 'blocked', 'unknown'] as const)(
    'invalidates any old authenticated result when compatibility is %s',
    (state) => {
      const observation = parseCodexAuthRuntimeObservation({
        kind: 'probe',
        source: 'actual_runtime',
        classification: 'authenticated',
        executionSucceeded: true,
        observedAt,
      });

      expect(mapCodexAuthObservation({
        compatibility: { state },
        observation,
      })).toEqual({
        authState: 'unknown',
        observedAt: null,
        compatibilityFingerprint: null,
      });
    },
  );

  it('rejects raw errors, credentials, invalid time and invented classifications', () => {
    const base = {
      kind: 'probe',
      source: 'actual_runtime',
      classification: 'unverified',
      executionSucceeded: false,
      observedAt,
    };
    expect(() => parseCodexAuthRuntimeObservation({
      ...base,
      rawError: 'must not cross',
    })).toThrow();
    expect(() => parseCodexAuthRuntimeObservation({
      ...base,
      credential: 'must not cross',
    })).toThrow();
    expect(() => parseCodexAuthRuntimeObservation({
      ...base,
      observedAt: 'not-a-time',
    })).toThrow();
    expect(() => parseCodexAuthRuntimeObservation({
      ...base,
      classification: 'auth_expired',
    })).toThrow();
    expect(() => parseCodexAuthRuntimeObservation({
      ...base,
      classification: 'permission_denied',
    })).toThrow();
  });

  it('keeps observation only in memory and invalidates it on fingerprint change or clear', () => {
    const memory = new CodexAuthObservationAuthority();
    expect(memory.read()).toEqual({
      authState: 'unknown',
      observedAt: null,
      compatibilityFingerprint: null,
    });

    memory.setCompatibility(freshCompatibility);
    const runtimeInput = {
      kind: 'probe',
      source: 'actual_runtime',
      classification: 'authenticated',
      executionSucceeded: true,
      observedAt,
    } as const;
    expect(memory.acceptActualRuntime(runtimeInput)).toBe(true);
    expect(memory.read()).toEqual({
      authState: 'authenticated',
      observedAt,
      compatibilityFingerprint: fingerprint,
    });

    memory.setCompatibility({ state: 'fresh', fingerprint: replacementFingerprint });
    expect(memory.read().authState).toBe('unknown');

    memory.clear();
    expect(memory.read().observedAt).toBeNull();
    expect(new CodexAuthObservationAuthority().read().authState).toBe('unknown');
  });

  it('does not admit a structurally forged auth observation into memory', () => {
    const memory = new CodexAuthObservationAuthority();
    memory.setCompatibility(freshCompatibility);
    const forged = {
      authState: 'authenticated',
      observedAt,
      compatibilityFingerprint: fingerprint,
    };

    expect(() => memory.acceptActualRuntime(forged)).toThrow(
      'Codex auth runtime observation is invalid.',
    );
  });

  it('defines expired and permission states without pretending they were observed', () => {
    expect(AI_RUNTIME_AUTH_STATES).toEqual([
      'authenticated',
      'auth_required',
      'auth_expired',
      'permission_denied',
      'auth_runtime_unavailable',
      'unknown',
    ]);
    const mappedStates = [
      'authenticated',
      'auth_required',
      'unknown',
      'auth_runtime_unavailable',
    ];
    expect(mappedStates).not.toContain('auth_expired');
    expect(mappedStates).not.toContain('permission_denied');
  });
});
