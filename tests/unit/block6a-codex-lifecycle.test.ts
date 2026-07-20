import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createIdempotentLifecycleTrigger,
  findAttributedProcess,
  isSameProcessIdentityPresent,
  WindowsOwnedProcessGuard,
  WindowsOwnedProcessTracker,
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

  it('freezes PID, creation time, executable path and the observed parent chain for one probe', () => {
    const tracker = new WindowsOwnedProcessTracker({
      utilityPid: 100,
      utilityExecutablePath: 'C:\\project\\electron.exe',
      cliExecutablePath: 'C:\\project\\codex.exe',
      observationStartedAt: 1000,
    });
    const snapshots: WindowsProcessSnapshot[] = [
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 101, parentPid: 100, executablePath: 'C:\\project\\helper.exe', startedAt: 1001 },
      { pid: 102, parentPid: 101, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ];

    tracker.observe(snapshots);

    expect(tracker.evidenceAssertions()).toEqual({
      utilityIdentityBound: true,
      cliIdentityBound: true,
      pidCreationTimeExecutablePathBound: true,
      observedParentRelationshipBound: true,
      ownershipFrozenForSession: true,
    });
    expect(tracker.residualAssertions(snapshots)).toEqual({
      utilityResidualAbsent: false,
      cliResidualAbsent: false,
    });
    expect(tracker.residualAssertions([
      { ...snapshots[0]!, startedAt: 2000 },
      { ...snapshots[2]!, startedAt: 2002 },
    ])).toEqual({
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
  });

  it('fails closed for stale utilities, unrelated CLIs and ambiguous process identities', () => {
    const createTracker = () => new WindowsOwnedProcessTracker({
      utilityPid: 100,
      utilityExecutablePath: 'C:\\project\\electron.exe',
      cliExecutablePath: 'C:\\project\\codex.exe',
      observationStartedAt: 1000,
    });
    const staleUtility = createTracker();
    staleUtility.observe([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 999 },
      { pid: 102, parentPid: 100, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ]);
    expect(Object.values(staleUtility.evidenceAssertions()).some(Boolean)).toBe(false);

    const unrelatedCli = createTracker();
    unrelatedCli.observe([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 102, parentPid: 77, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ]);
    expect(unrelatedCli.evidenceAssertions()).toMatchObject({
      utilityIdentityBound: true,
      cliIdentityBound: false,
      observedParentRelationshipBound: false,
      ownershipFrozenForSession: false,
    });

    const duplicatePid = createTracker();
    duplicatePid.observe([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 101, parentPid: 100, executablePath: 'C:\\project\\helper.exe', startedAt: 1001 },
      { pid: 101, parentPid: 77, executablePath: 'C:\\other\\helper.exe', startedAt: 1001 },
      { pid: 102, parentPid: 101, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ]);
    expect(duplicatePid.evidenceAssertions()).toMatchObject({
      utilityIdentityBound: true,
      cliIdentityBound: false,
      observedParentRelationshipBound: false,
    });
  });

  it('never replaces a frozen ownership identity after PID reuse', () => {
    const tracker = new WindowsOwnedProcessTracker({
      utilityPid: 100,
      utilityExecutablePath: 'C:\\project\\electron.exe',
      cliExecutablePath: 'C:\\project\\codex.exe',
      observationStartedAt: 1000,
    });
    tracker.observe([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 102, parentPid: 100, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ]);
    tracker.observe([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 2000 },
      { pid: 102, parentPid: 100, executablePath: 'C:\\project\\codex.exe', startedAt: 2002 },
    ]);

    expect(tracker.evidenceAssertions().ownershipFrozenForSession).toBe(true);
    expect(tracker.residualAssertions([
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 2000 },
      { pid: 102, parentPid: 100, executablePath: 'C:\\project\\codex.exe', startedAt: 2002 },
    ])).toEqual({
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
  });

  it('checks owned utility identity immediately before force and caches the post-exit residual scan', async () => {
    const ownedSnapshots: WindowsProcessSnapshot[] = [
      { pid: 100, parentPid: 1, executablePath: 'C:\\project\\electron.exe', startedAt: 1000 },
      { pid: 102, parentPid: 100, executablePath: 'C:\\project\\codex.exe', startedAt: 1002 },
    ];
    let snapshots = ownedSnapshots;
    let readCount = 0;
    const guard = new WindowsOwnedProcessGuard({
      utilityExecutablePath: 'C:\\project\\electron.exe',
      cliExecutablePath: 'C:\\project\\codex.exe',
      observationStartedAt: 1000,
      observationAttempts: 1,
      observationIntervalMs: 0,
      residualDelayMs: 0,
      readSnapshots: () => {
        readCount += 1;
        return snapshots;
      },
    });
    guard.bindUtility(100);
    expect(guard.isUtilityOwnedAndRunning()).toBe(true);
    snapshots = [
      { ...ownedSnapshots[0]!, startedAt: 2000 },
      { ...ownedSnapshots[1]!, startedAt: 2002 },
    ];

    await expect(guard.scanResiduals()).resolves.toEqual({
      ownershipObserved: true,
      residualScanCompleted: true,
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
    const readsAfterFirstScan = readCount;
    await guard.scanResiduals();
    expect(readCount).toBe(readsAfterFirstScan);
    expect(guard.isUtilityOwnedAndRunning()).toBe(false);
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
    expect(source).toContain('new WindowsOwnedProcessGuard');
    expect(source).not.toContain('findProcessByPidAndPath');
    expect(source).not.toContain('BrowserWindow({ show: true');
    expect(source).not.toMatch(/Get-Process.*ProcessName|Stop-Process.*codex/i);
  });

  it('records the R4a ownership repair as static-only evidence without process values', () => {
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r4a-process-ownership.json',
    ), 'utf8')) as {
      source: string;
      classification: string;
      identityComponents: string[];
      assertions: Record<string, boolean>;
      limitations: string[];
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('owned_process_attribution_hardened');
    expect(evidence.identityComponents).toEqual([
      'pid',
      'startedAt',
      'executablePath',
      'parentPid',
      'observedParentChain',
    ]);
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(evidence.limitations).toContain(
      'Fresh Windows lifecycle recertification remains required before the final conditional-Go verdict can be reissued.',
    );
    expect(JSON.stringify(evidence)).not.toMatch(/[A-Z]:\\\\|"(?:pid|path|startedAt|parentPid)"\s*:/i);
  });
});
