import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isCodexConnectionCheckRequest,
  isCodexConnectionCheckResponse,
} from '../../src/main/ai/providers/codex/codex-connection-check-protocol';
import {
  CodexConnectionCheckUtilityHost,
} from '../../src/main/ai/providers/codex/codex-connection-check-utility-host';

const token = { attempt: 1, generation: 1 };

describe('Block 13.12 Codex-private connection-check protocol', () => {
  it('accepts only the fixed fixture request and bounded result vocabulary', () => {
    expect(isCodexConnectionCheckRequest({
      version: 1,
      origin: 'main',
      type: 'ai.connection-check.start',
      token,
      fixtureId: 'block13-connection-check-v1',
    })).toBe(true);
    expect(isCodexConnectionCheckRequest({
      version: 1,
      origin: 'main',
      type: 'ai.connection-check.start',
      token,
      fixtureId: 'block13-connection-check-v1',
      prompt: 'user content',
    })).toBe(false);
    expect(isCodexConnectionCheckResponse({
      version: 1,
      origin: 'utility',
      type: 'ai.connection-check.result',
      token,
      outcome: 'authenticated',
    })).toBe(true);
    for (const outcome of ['login_required', 'permission_denied', 'auth_expired']) {
      expect(isCodexConnectionCheckResponse({
        version: 1,
        origin: 'utility',
        type: 'ai.connection-check.result',
        token,
        outcome,
      })).toBe(false);
    }
  });

  it('keeps the utility fixture fixed and excludes Library or user-data inputs', () => {
    const source = readFileSync(
      'src/main/ai/providers/codex/codex-connection-check-utility-host.ts',
      'utf8',
    );
    expect(source).toContain("status set to WS13");
    expect(source).toContain("...workspace.threadOptions");
    expect(source).toContain("networkAccessEnabled: false");
    expect(source).not.toMatch(/LibraryService|better-sqlite3|sourceText|bookId|manuscript/);
    expect(source).not.toMatch(/process\.argv|request\.(?:prompt|path|input|schema)/);
  });

  it('runs only the fixed synthetic input and emits a bounded authenticated result', async () => {
    const messages: unknown[] = [];
    let settled: Promise<unknown> | null = null;
    let capturedInput: string | null = null;
    let capturedOptions: unknown = null;
    const host = new CodexConnectionCheckUtilityHost({
      environment: { PATH: 'C:\\Windows\\System32' },
      createClient: () => ({
        startThread: (options: unknown) => {
          capturedOptions = options;
          return {
            run: async (input: string) => {
              capturedInput = input;
              return { finalResponse: '{"status":"WS13"}' };
            },
          };
        },
      } as never),
      lifecycle: {
        bindActiveExecution: (input: { readonly settled: Promise<unknown> }) => {
          settled = input.settled;
        },
      } as never,
      postMessage: (message) => messages.push(message),
    });

    host.accept({
      version: 1,
      origin: 'main',
      type: 'ai.connection-check.start',
      token,
      fixtureId: 'block13-connection-check-v1',
    });
    await settled;

    expect(capturedInput).toBe(
      'Return exactly one JSON object with the single field status set to WS13.',
    );
    expect(capturedOptions).toMatchObject({
      skipGitRepoCheck: true,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
    });
    expect(messages).toEqual([
      {
        version: 1,
        origin: 'utility',
        type: 'ai.connection-check.started',
        token,
      },
      {
        version: 1,
        origin: 'utility',
        type: 'ai.connection-check.result',
        token,
        outcome: 'authenticated',
      },
    ]);
  });
});
