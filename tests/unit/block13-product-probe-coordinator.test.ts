import { describe, expect, it, vi } from 'vitest';
import {
  executeCodexProductPackagedProbe,
  type CodexProductPackagedScenarioResult,
} from '../../src/main/ai/providers/codex/codex-product-packaged-probe';

const scenarioResult = (
  scenario: 'success' | 'cancel' | 'timeout',
): CodexProductPackagedScenarioResult => ({
  scenario,
  sessionOrdinal: scenario === 'success' ? 1 : scenario === 'cancel' ? 2 : 3,
  outcome: scenario === 'success' ? 'success' : 'aborted',
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
    abortRequested: scenario !== 'success',
    abortObserved: scenario !== 'success',
    timeoutTriggered: scenario === 'timeout',
    cleanupAcknowledged: true,
    utilityExitClean: true,
    ownershipObserved: true,
    residualScanCompleted: true,
    utilityResidualAbsent: true,
    cliResidualAbsent: true,
    scratchCleanupCompleted: true,
  },
});

describe('Block 13.11 product packaged probe coordinator', () => {
  it('uses three sequential isolated utility sessions and emits sanitized evidence', async () => {
    const runScenario = vi.fn(async (scenario) => scenarioResult(scenario));

    const result = await executeCodexProductPackagedProbe({
      runScenario,
      versions: {
        electron: '43.0.0',
        nodeRuntime: '24.17.0',
        codexSdk: '0.144.6',
        codexCli: '0.144.6',
        platformPackage: '0.144.6-win32-x64',
      },
    });

    expect(runScenario.mock.calls.map(([scenario]) => scenario)).toEqual([
      'success',
      'cancel',
      'timeout',
    ]);
    expect(result.classification).toBe('windows_product_packaged_runtime_verified');
    expect(result.scenarios.map((scenario) => scenario.sessionOrdinal)).toEqual([1, 2, 3]);
    expect(JSON.stringify(result)).not.toMatch(
      /prompt|response|rawError|stack|cause|workingDirectory|pathValue|credential|providerId|pid/i,
    );
  });

  it('fails closed when any scenario lacks cleanup or the expected lifecycle outcome', async () => {
    const result = await executeCodexProductPackagedProbe({
      runScenario: async (scenario) => ({
        ...scenarioResult(scenario),
        ...(scenario === 'timeout'
          ? { assertions: { ...scenarioResult(scenario).assertions, cliResidualAbsent: false } }
          : {}),
      }),
      versions: {
        electron: '43.0.0',
        nodeRuntime: '24.17.0',
        codexSdk: '0.144.6',
        codexCli: '0.144.6',
        platformPackage: '0.144.6-win32-x64',
      },
    });

    expect(result.classification).toBe('windows_product_packaged_runtime_failed');
  });
});
