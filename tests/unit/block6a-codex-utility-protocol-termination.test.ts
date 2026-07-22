import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CodexUtilityProtocolTerminationSupervisor } from '../../src/main/codex-feasibility/utility-protocol-termination';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A malformed utility protocol termination', () => {
  it('waits for active SDK cancellation and settlement before scheduling exit', async () => {
    let settleCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => {
      settleCancellation = resolve;
    });
    const events: string[] = [];
    const supervisor = new CodexUtilityProtocolTerminationSupervisor({
      cancelActiveSdkProbe: async () => {
        events.push('cancel');
        await cancellation;
        events.push('settled');
      },
      scheduleExit: (code) => events.push(`exit:${code}`),
    });

    expect(supervisor.beginMalformedRequestTermination()).toBe(true);
    expect(supervisor.isTerminating()).toBe(true);
    expect(events).toEqual(['cancel']);

    settleCancellation();
    await supervisor.waitUntilExitScheduled();

    expect(events).toEqual(['cancel', 'settled', 'exit:28']);
  });

  it('is single-flight across repeated malformed messages', async () => {
    const cancelActiveSdkProbe = vi.fn(async () => undefined);
    const scheduleExit = vi.fn();
    const supervisor = new CodexUtilityProtocolTerminationSupervisor({
      cancelActiveSdkProbe,
      scheduleExit,
    });

    expect(supervisor.beginMalformedRequestTermination()).toBe(true);
    expect(supervisor.beginMalformedRequestTermination()).toBe(false);
    await supervisor.waitUntilExitScheduled();

    expect(cancelActiveSdkProbe).toHaveBeenCalledTimes(1);
    expect(scheduleExit).toHaveBeenCalledTimes(1);
    expect(scheduleExit).toHaveBeenCalledWith(28);
  });

  it('fails closed after a cancellation error without exposing the error', async () => {
    const scheduleExit = vi.fn();
    const supervisor = new CodexUtilityProtocolTerminationSupervisor({
      cancelActiveSdkProbe: async () => {
        throw new Error('sensitive SDK failure');
      },
      scheduleExit,
    });

    expect(supervisor.beginMalformedRequestTermination()).toBe(true);
    await supervisor.waitUntilExitScheduled();

    expect(scheduleExit).toHaveBeenCalledOnce();
    expect(scheduleExit).toHaveBeenCalledWith(28);
  });

  it('routes malformed utility messages through the supervisor instead of direct exit', () => {
    const utilityEntry = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
      'utf8',
    );

    expect(utilityEntry).toContain('protocolTermination.beginMalformedRequestTermination()');
    expect(utilityEntry).toContain('if (protocolTermination.isTerminating()) return;');
    expect(utilityEntry).not.toMatch(
      /if \(!isCodexFeasibilityRequest\(request\)\) \{\s*process\.exit\(28\)/,
    );
  });
});
