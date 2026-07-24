import { describe, expect, it } from 'vitest';
import {
  CONTRACT_REGISTRY,
  PRODUCT_IPC_CHANNELS,
  getContract,
} from '../../src/shared/contracts';

describe('Block 13.12 connection-check wire contract', () => {
  it('admits exactly one AI channel with a strict empty request', () => {
    expect(PRODUCT_IPC_CHANNELS.filter((channel) => channel.startsWith('ai:'))).toEqual([
      'ai:check-connection',
    ]);

    const contract = getContract('ai:check-connection');
    expect(contract.request.safeParse({}).success).toBe(true);
    for (const invalid of [
      { prompt: 'user text' },
      { bookId: 'book-1' },
      { retry: true },
      { provider: 'codex' },
    ]) {
      expect(contract.request.safeParse(invalid).success).toBe(false);
    }
  });

  it('returns only the provider-neutral three-layer state and observedAt', () => {
    const response = {
      ok: true,
      data: {
        gate: {
          status: 'passed',
          feasibility: 'windows_passed',
          platform: 'macos_deferred',
          overallVerdict: 'conditional_go',
        },
        compatibility: {
          state: 'fresh',
          fingerprint: 'a'.repeat(64),
        },
        runtime: {
          authState: 'authenticated',
          observedAt: '2026-07-24T12:00:00.000Z',
        },
      },
    };

    expect(CONTRACT_REGISTRY['ai:check-connection'].response.safeParse(response).success)
      .toBe(true);
    for (const extra of [
      { provider: 'codex' },
      { prompt: 'hidden' },
      { response: '{"status":"WS13"}' },
      { path: 'C:\\private' },
    ]) {
      expect(CONTRACT_REGISTRY['ai:check-connection'].response.safeParse({
        ...response,
        data: { ...response.data, ...extra },
      }).success).toBe(false);
    }
  });
});
