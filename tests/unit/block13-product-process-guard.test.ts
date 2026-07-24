import { describe, expect, it, vi } from 'vitest';
import { CodexWindowsProcessGuard } from '../../src/main/ai/providers/codex/codex-windows-process-guard';

describe('Block 13.11 Windows product process ownership guard', () => {
  it('binds PID, creation time, executable and parent relationship before residual proof', async () => {
    let snapshots = [
      {
        pid: 10,
        parentPid: 1,
        executablePath: 'C:\\Product\\writestorm.exe',
        startedAt: 1_001,
      },
      {
        pid: 11,
        parentPid: 10,
        executablePath: 'C:\\Product\\resources\\codex.exe',
        startedAt: 1_002,
      },
    ];
    const guard = new CodexWindowsProcessGuard({
      utilityExecutablePath: 'C:\\Product\\writestorm.exe',
      cliExecutablePath: 'C:\\Product\\resources\\codex.exe',
      observationStartedAt: 1_000,
      readSnapshots: () => snapshots,
      observeAttempts: 1,
      observeIntervalMs: 0,
      residualDelayMs: 0,
    });

    guard.bindUtility(10);
    expect(guard.hasObservedOwnership()).toBe(true);
    expect(guard.isUtilityOwnedAndRunning()).toBe(true);
    snapshots = [];

    await expect(guard.scanResiduals()).resolves.toEqual({
      residualScanCompleted: true,
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
  });

  it('fails closed when the CLI is not an observed descendant', async () => {
    const guard = new CodexWindowsProcessGuard({
      utilityExecutablePath: 'C:\\Product\\writestorm.exe',
      cliExecutablePath: 'C:\\Product\\resources\\codex.exe',
      observationStartedAt: 1_000,
      readSnapshots: () => [{
        pid: 10,
        parentPid: 1,
        executablePath: 'C:\\Product\\writestorm.exe',
        startedAt: 1_001,
      }],
      observeAttempts: 1,
      observeIntervalMs: 0,
      residualDelayMs: 0,
    });
    guard.bindUtility(10);

    expect(guard.hasObservedOwnership()).toBe(false);
    await expect(guard.scanResiduals()).resolves.toEqual({
      residualScanCompleted: false,
      utilityResidualAbsent: false,
      cliResidualAbsent: false,
    });
  });

  it('retries the utility identity snapshot after the spawn event race', async () => {
    const complete = [
      {
        pid: 10,
        parentPid: 1,
        executablePath: 'C:\\Product\\writestorm.exe',
        startedAt: 1_001,
      },
      {
        pid: 11,
        parentPid: 10,
        executablePath: 'C:\\Product\\resources\\codex.exe',
        startedAt: 1_002,
      },
    ];
    let reads = 0;
    const guard = new CodexWindowsProcessGuard({
      utilityExecutablePath: 'C:\\Product\\writestorm.exe',
      cliExecutablePath: 'C:\\Product\\resources\\codex.exe',
      observationStartedAt: 1_000,
      readSnapshots: () => {
        reads += 1;
        return reads === 1 ? [] : complete;
      },
      observeAttempts: 2,
      observeIntervalMs: 0,
      residualDelayMs: 0,
    });

    guard.bindUtility(10);
    await vi.waitFor(() => {
      expect(guard.hasObservedOwnership()).toBe(true);
    });
  });
});
