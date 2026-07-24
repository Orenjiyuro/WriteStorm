import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  runCodexProductPackagedScenario,
} from '../../src/main/ai/providers/codex/codex-product-packaged-probe';
import type { CodexProductProbeScenario } from '../../src/main/ai/providers/codex/codex-product-probe-protocol';
import type { CodexUtilityProcessHandle } from '../../src/main/ai/providers/codex/codex-utility-launcher';

class FakeUtility extends EventEmitter implements CodexUtilityProcessHandle {
  readonly pid = 42;
  readonly posts: unknown[] = [];

  postMessage(message: unknown): void {
    this.posts.push(message);
    const record = message as Record<string, unknown>;
    const token = record.token;
    if (record.type === 'ai.product-probe.start') {
      const scenario = record.scenario as CodexProductProbeScenario;
      queueMicrotask(() => {
        this.emit('message', {
          version: 1,
          origin: 'utility',
          type: 'ai.product-probe.started',
          token,
          scenario,
        });
        if (scenario === 'success') this.emitProductResult(token, scenario, 'success');
      });
    } else if (record.type === 'ai.abort') {
      const scenario: CodexProductProbeScenario =
        record.trigger === 'timeout' ? 'timeout' : 'cancel';
      queueMicrotask(() => {
        this.emitProductResult(token, scenario, 'aborted');
        this.emit('message', {
          version: 1,
          origin: 'utility',
          type: 'ai.abort-result',
          token,
          abortRequested: true,
          abortObserved: true,
          executionSettled: true,
        });
      });
    } else if (record.type === 'ai.shutdown') {
      queueMicrotask(() => {
        this.emit('message', {
          version: 1,
          origin: 'utility',
          type: 'ai.shutdown-result',
          token,
          cleanupAcknowledged: true,
        });
        this.emit('exit', 0, null);
      });
    }
  }

  kill(): boolean {
    this.emit('exit', null, 'SIGTERM');
    return true;
  }

  private emitProductResult(
    token: unknown,
    scenario: CodexProductProbeScenario,
    outcome: 'success' | 'aborted',
  ): void {
    this.emit('message', {
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.result',
      token,
      scenario,
      outcome,
      assertions: {
        sdkImported: true,
        clientConstructed: true,
        scratchInsideOsTemp: true,
        nonGitWorkspace: true,
        skipGitRepoCheck: true,
        environmentAllowlisted: true,
        finalJsonParsed: scenario === 'success',
        strictValidatorAccepted: scenario === 'success',
        expectedValueMatched: scenario === 'success',
        abortObserved: scenario !== 'success',
        scratchCleanupCompleted: true,
      },
    });
  }
}

describe('Block 13.11 isolated production utility scenario session', () => {
  it.each(['success', 'cancel', 'timeout'] as const)(
    'uses product start and lifecycle cleanup for %s',
    async (scenario) => {
      const child = new FakeUtility();
      const launch = vi.fn(() => {
        queueMicrotask(() => child.emit('spawn'));
        return child;
      });

      const result = await runCodexProductPackagedScenario({
        scenario,
        sessionOrdinal: scenario === 'success' ? 1 : scenario === 'cancel' ? 2 : 3,
        launcher: { launch },
        utilityExecutablePath: 'C:\\Product\\writestorm.exe',
        cliExecutablePath: 'C:\\Product\\codex.exe',
        cancelDelayMs: 0,
        timeoutDelayMs: 0,
        cleanupGraceMs: 100,
        resultDeadlineMs: 100,
        createProcessGuard: () => ({
          bindUtility: vi.fn(),
          isUtilityOwnedAndRunning: () => true,
          hasObservedOwnership: () => true,
          scanResiduals: async () => ({
            residualScanCompleted: true,
            utilityResidualAbsent: true,
            cliResidualAbsent: true,
          }),
        }),
      });

      expect(launch).toHaveBeenCalledOnce();
      expect(child.posts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'ai.product-probe.start',
          scenario,
          fixtureId: 'block13-product-packaged-probe-v1',
        }),
        expect.objectContaining({ type: 'ai.shutdown' }),
      ]));
      expect(result.outcome).toBe(scenario === 'success' ? 'success' : 'aborted');
      expect(result.assertions).toMatchObject({
        cleanupAcknowledged: true,
        utilityExitClean: true,
        ownershipObserved: true,
        residualScanCompleted: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      });
    },
  );
});
