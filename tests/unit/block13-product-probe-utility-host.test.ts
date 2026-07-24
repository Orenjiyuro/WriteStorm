import { describe, expect, it, vi } from 'vitest';
import { CodexProductProbeUtilityHost } from '../../src/main/ai/providers/codex/codex-product-probe-utility-host';
import { CodexUtilityLifecycleHost } from '../../src/main/ai/providers/codex/codex-utility-lifecycle-host';

const token = { attempt: 1, generation: 1 } as const;

describe('Block 13.11 production utility fixed probe host', () => {
  it('runs only the pinned fixture and reports a sanitized strict success', async () => {
    const messages: unknown[] = [];
    const run = vi.fn(async () => ({
      finalResponse: '{ "status": "WS13" }',
      items: [],
      usage: null,
    }));
    const startThread = vi.fn(() => ({ run }));
    const lifecycle = new CodexUtilityLifecycleHost({
      postMessage: (message) => messages.push(message),
      scheduleExit: vi.fn(),
    });
    const host = new CodexProductProbeUtilityHost({
      createClient: () => ({ startThread }),
      lifecycle,
      postMessage: (message) => messages.push(message),
    });

    host.accept({
      version: 1,
      origin: 'main',
      type: 'ai.product-probe.start',
      token,
      scenario: 'success',
      fixtureId: 'block13-product-packaged-probe-v1',
    });
    await vi.waitFor(() => {
      expect(messages).toHaveLength(2);
    });

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('{"status":"WS13"}'),
      expect.objectContaining({
        outputSchema: {
          type: 'object',
          properties: { status: { type: 'string', const: 'WS13' } },
          required: ['status'],
          additionalProperties: false,
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({
      skipGitRepoCheck: true,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
    }));
    expect(messages[1]).toMatchObject({
      type: 'ai.product-probe.result',
      outcome: 'success',
      assertions: {
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        scratchCleanupCompleted: true,
      },
    });
    expect(JSON.stringify(messages)).not.toMatch(/rawError|stack|cause|workingDirectory/);
  });

  it('accepts cancellation only through the lifecycle host and observes AbortError', async () => {
    const messages: unknown[] = [];
    const run = vi.fn((_input: string, options: { readonly signal: AbortSignal }) => (
      new Promise<never>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('cancelled');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      })
    ));
    const lifecycle = new CodexUtilityLifecycleHost({
      postMessage: (message) => messages.push(message),
      scheduleExit: vi.fn(),
    });
    const host = new CodexProductProbeUtilityHost({
      createClient: () => ({
        startThread: () => ({ run }),
      }),
      lifecycle,
      postMessage: (message) => messages.push(message),
    });
    host.accept({
      version: 1,
      origin: 'main',
      type: 'ai.product-probe.start',
      token,
      scenario: 'cancel',
      fixtureId: 'block13-product-packaged-probe-v1',
    });

    await lifecycle.accept({
      version: 1,
      origin: 'main',
      type: 'ai.abort',
      token,
      trigger: 'explicit_cancel',
    });

    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'ai.product-probe.result',
        outcome: 'aborted',
        assertions: expect.objectContaining({
          abortObserved: true,
          scratchCleanupCompleted: true,
        }),
      }),
      expect.objectContaining({
        type: 'ai.abort-result',
        abortRequested: true,
        abortObserved: true,
        executionSettled: true,
      }),
    ]));
  });
});
