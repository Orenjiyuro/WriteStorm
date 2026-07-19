import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createIdempotentLifecycleTrigger,
  findAttributedProcess,
  isSameProcessIdentityPresent,
  type WindowsProcessSnapshot,
} from '../../src/main/codex-feasibility/lifecycle';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.7 lifecycle and owned-process boundary', () => {
  it('locks the four real lifecycle scenarios and their distinct event semantics', () => {
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a7-lifecycle-cleanup.json',
    ), 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      scenarios: Array<{
        scenario: string;
        classification: string;
        result: Record<string, unknown>;
        processAssertions: Record<string, boolean>;
        lifecycleEvents: Record<string, unknown>;
      }>;
    };

    expect(evidence.source).toBe('real_sdk');
    expect(evidence.classification).toBe('lifecycle_probe_matrix_passed');
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(evidence.scenarios.map((item) => item.scenario)).toEqual([
      'app-timeout',
      'explicit-cancel',
      'window-close',
      'app-quit',
    ]);
    for (const scenario of evidence.scenarios) {
      expect(scenario.classification).toBe('lifecycle_probe_passed');
      expect(scenario.result).toMatchObject({
        trigger: scenario.scenario,
        outcome: 'aborted',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
      });
      expect(Object.values(scenario.processAssertions).every(Boolean)).toBe(true);
      expect(scenario.lifecycleEvents.cleanupExecutionCount).toBe(1);
    }
    expect(evidence.scenarios[0]).toMatchObject({
      scenario: 'app-timeout',
      timeoutCleanup: {
        classification: 'graceful',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
        cleanupAcknowledged: true,
        utilityExitObserved: true,
      },
      processAssertions: {
        runnerTimeoutPathExercised: true,
        timeoutCleanupGraceful: true,
        timeoutUtilityExitObserved: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      },
    });
    expect(evidence.scenarios[2]?.lifecycleEvents).toMatchObject({
      initialTrigger: 'window-close',
      cleanupRequestCount: 2,
      cleanupExecutionCount: 1,
      windowCloseObserved: true,
      windowAllClosedObserved: true,
      beforeQuitObserved: true,
    });
    expect(evidence.scenarios[3]?.lifecycleEvents).toMatchObject({
      initialTrigger: 'app-quit',
      cleanupRequestCount: 1,
      cleanupExecutionCount: 1,
      windowCloseObserved: false,
      windowAllClosedObserved: false,
      beforeQuitObserved: true,
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toMatch(/[A-Z]:\\\\/);
    expect(serialized).not.toMatch(/"(?:pid|path|prompt|stdout|stderr|commandLine|utilityPid)"\s*:/i);
  });

  it('admits closed start/cancel lifecycle commands without prompt, signal or process injection', () => {
    const start = {
      version: 1,
      origin: 'main',
      requestId: 'lifecycle-start',
      command: 'start-lifecycle-probe',
      input: {
        scenario: 'explicit-cancel',
        workingDirectory: 'C:\\probe\\git',
      },
    };
    const cancel = {
      version: 1,
      origin: 'main',
      requestId: 'lifecycle-cancel',
      command: 'cancel-lifecycle-probe',
      trigger: 'explicit-cancel',
    };

    expect(isCodexFeasibilityRequest(start)).toBe(true);
    expect(isCodexFeasibilityRequest(cancel)).toBe(true);
    expect(isCodexFeasibilityRequest({ ...start, prompt: 'rejected' })).toBe(false);
    expect(isCodexFeasibilityRequest({ ...cancel, utilityPid: 7 })).toBe(false);
    expect(isCodexFeasibilityResponse({
      version: 1,
      requestId: 'lifecycle-cancel',
      command: 'cancel-lifecycle-probe',
      ok: true,
      utilityPid: 7,
      result: {
        scenario: 'explicit-cancel',
        trigger: 'explicit-cancel',
        outcome: 'aborted',
        authClassification: 'authenticated',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
      },
    })).toBe(true);
  });

  it('preserves the first lifecycle trigger and executes cleanup once', async () => {
    const execute = vi.fn(async (trigger: string) => trigger);
    const gate = createIdempotentLifecycleTrigger(execute);
    const first = gate.request('window-close');
    const second = gate.request('app-quit');

    await expect(first).resolves.toBe('window-close');
    await expect(second).resolves.toBe('window-close');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(gate.snapshot()).toEqual({
      initialTrigger: 'window-close',
      requestCount: 2,
      executionCount: 1,
    });
  });

  it('attributes only exact path-and-time descendants and checks the same identity for residue', () => {
    const snapshots: WindowsProcessSnapshot[] = [
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 101, parentPid: 100, executablePath: 'C:\\project\\helper.exe', startedAt: 1001 },
      { pid: 102, parentPid: 101, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
      { pid: 103, parentPid: 1, executablePath: 'C:\\project\\codex.exe', startedAt: 999 },
    ];
    const identity = findAttributedProcess(
      snapshots,
      snapshots[0]!,
      'C:\\project\\codex.exe',
    );

    expect(identity).toEqual(snapshots[2]);
    expect(isSameProcessIdentityPresent(snapshots, identity!)).toBe(true);
    expect(isSameProcessIdentityPresent([
      { ...snapshots[2]!, startedAt: 2000 },
    ], identity!)).toBe(false);
  });

  it('keeps window-close and app-quit as hidden, distinct initial triggers', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/lifecycle-probe-main.ts'),
      'utf8',
    );
    expect(source).toContain('show: false');
    expect(source).toContain("probeWindow.on('close'");
    expect(source).toContain("app.on('before-quit'");
    expect(source).toContain("app.on('window-all-closed'");
    expect(source).toContain("'window-close'");
    expect(source).toContain("'app-quit'");
    expect(source).not.toContain('BrowserWindow({ show: true');
    expect(source).not.toMatch(/Get-Process.*ProcessName|Stop-Process.*codex/i);
  });
});
