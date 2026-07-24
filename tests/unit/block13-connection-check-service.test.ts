import { describe, expect, it, vi } from 'vitest';
import {
  AiConnectionCheckService,
  type AiConnectionCheckAttemptAdmission,
} from '../../src/main/ai/ai-connection-check-service';
import { CodexAuthObservationAuthority } from '../../src/main/ai/providers/codex/codex-auth-observation';

const fingerprint = 'a'.repeat(64);
const observedAt = '2026-07-24T12:00:00.000Z';

describe('Block 13.12 connection-check application service', () => {
  it('clears the previous observation before each explicit attempt and accepts actual success', async () => {
    const authority = new CodexAuthObservationAuthority();
    const pending = deferred<unknown>();
    const service = new AiConnectionCheckService({
      assessCompatibility: () => ({ state: 'fresh', fingerprint }),
      auth: authority,
      attempts: {
        beginExplicit: () => ({
          accepted: true,
          result: pending.promise,
        }),
      },
    });

    const running = service.checkConnection();
    expect(service.read().runtime).toEqual({ authState: 'unknown', observedAt: null });
    pending.resolve({
      kind: 'probe',
      source: 'actual_runtime',
      classification: 'authenticated',
      executionSucceeded: true,
      observedAt,
    });

    await expect(running).resolves.toMatchObject({
      compatibility: { state: 'fresh', fingerprint },
      runtime: { authState: 'authenticated', observedAt },
    });
  });

  it.each(['stale', 'blocked', 'unknown'] as const)(
    'fails closed without starting runtime when compatibility is %s',
    async (state) => {
      const beginExplicit = vi.fn<() => AiConnectionCheckAttemptAdmission>();
      const service = new AiConnectionCheckService({
        assessCompatibility: () => ({ state }),
        auth: new CodexAuthObservationAuthority(),
        attempts: { beginExplicit },
      });

      await expect(service.checkConnection()).resolves.toMatchObject({
        compatibility: { state },
        runtime: { authState: 'unknown', observedAt: null },
      });
      expect(beginExplicit).not.toHaveBeenCalled();
    },
  );

  it('lets the attempt controller reject concurrent double-click admission', async () => {
    const pending = deferred<unknown>();
    const beginExplicit = vi.fn()
      .mockReturnValueOnce({ accepted: true, result: pending.promise })
      .mockReturnValueOnce({ accepted: false, reason: 'attempt_active' });
    const service = new AiConnectionCheckService({
      assessCompatibility: () => ({ state: 'fresh', fingerprint }),
      auth: new CodexAuthObservationAuthority(),
      attempts: { beginExplicit },
    });

    const first = service.checkConnection();
    await expect(service.checkConnection()).resolves.toMatchObject({
      runtime: { authState: 'unknown', observedAt: null },
    });
    expect(beginExplicit).toHaveBeenCalledTimes(2);
    pending.resolve({
      kind: 'runtime_unavailable',
      source: 'actual_runtime',
      observedAt,
    });
    await first;
  });

  it('does not retain an old authenticated observation when session admission fails', async () => {
    const authority = new CodexAuthObservationAuthority();
    const service = new AiConnectionCheckService({
      assessCompatibility: () => ({ state: 'fresh', fingerprint }),
      auth: authority,
      attempts: {
        beginExplicit: () => ({
          accepted: false,
          reason: 'session_start_failed',
        }),
      },
    });
    authority.acceptActualRuntime({
      kind: 'probe',
      source: 'actual_runtime',
      classification: 'authenticated',
      executionSucceeded: true,
      observedAt,
    });
    expect(service.read().runtime.authState).toBe('authenticated');

    await expect(service.checkConnection()).resolves.toMatchObject({
      runtime: { authState: 'unknown', observedAt: null },
    });
  });

  it('invalidates a late result after Library replacement without writing old observation', async () => {
    const authority = new CodexAuthObservationAuthority();
    const pending = deferred<unknown>();
    const service = new AiConnectionCheckService({
      assessCompatibility: () => ({ state: 'fresh', fingerprint }),
      auth: authority,
      attempts: {
        beginExplicit: () => ({
          accepted: true,
          result: pending.promise,
        }),
      },
    });

    const running = service.checkConnection();
    service.invalidate();
    pending.resolve({
      kind: 'probe',
      source: 'actual_runtime',
      classification: 'authenticated',
      executionSucceeded: true,
      observedAt,
    });

    await expect(running).resolves.toMatchObject({
      runtime: { authState: 'unknown', observedAt: null },
    });
    expect(service.read().runtime).toEqual({ authState: 'unknown', observedAt: null });
  });
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
