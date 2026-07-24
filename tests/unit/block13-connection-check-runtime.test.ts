import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  CodexConnectionCheckRuntime,
} from '../../src/main/ai/providers/codex/codex-connection-check-runtime';

describe('Block 13.12 production connection-check runtime', () => {
  it('launches one utility with only the fixed protocol request', async () => {
    const child = new FakeUtilityProcess();
    const bindUtility = vi.fn();
    const runtime = new CodexConnectionCheckRuntime({
      launcher: { launch: () => child },
      createProcessGuard: () => ({
        bindUtility,
        isUtilityOwnedAndRunning: () => true,
        scanResiduals: async () => ({
          residualScanCompleted: true,
          utilityResidualAbsent: true,
          cliResidualAbsent: true,
        }),
      }),
      cleanupGraceMs: 50,
    });
    const execution = runtime.start({ attempt: 1, generation: 1 });
    child.emit('spawn');

    expect(bindUtility).toHaveBeenCalledWith(4312);
    expect(child.posted).toEqual([{
      version: 1,
      origin: 'main',
      type: 'ai.connection-check.start',
      token: { attempt: 1, generation: 1 },
      fixtureId: 'block13-connection-check-v1',
    }]);
    child.emit('message', {
      version: 1,
      origin: 'utility',
      type: 'ai.connection-check.result',
      token: { attempt: 1, generation: 1 },
      outcome: 'authenticated',
    });
    await expect(execution.result).resolves.toMatchObject({
      outcome: 'authenticated',
    });
  });
});

class FakeUtilityProcess extends EventEmitter {
  readonly pid = 4312;
  readonly posted: unknown[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  kill(): boolean {
    this.emit('exit', 0, null);
    return true;
  }
}
