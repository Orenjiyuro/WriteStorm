import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CODEX_FEASIBILITY_SESSION_TIMEOUT_MS,
  resolveCodexFeasibilityTurnDeadlineMs,
  settleCodexTurnWithinDeadline,
} from '../../src/main/codex-feasibility/turn-deadline';

describe('Block 6A R8a SDK turn deadline boundary', () => {
  afterEach(() => vi.useRealTimers());

  it('uses a short isolated-auth deadline and a longer current-auth deadline', () => {
    expect(resolveCodexFeasibilityTurnDeadlineMs('isolated-empty')).toBe(15_000);
    expect(resolveCodexFeasibilityTurnDeadlineMs('current')).toBe(90_000);
    expect(CODEX_FEASIBILITY_SESSION_TIMEOUT_MS).toBe(110_000);
    expect(CODEX_FEASIBILITY_SESSION_TIMEOUT_MS).toBeGreaterThan(
      resolveCodexFeasibilityTurnDeadlineMs('current'),
    );
  });

  it('aborts and settles an SDK turn before the outer session timeout', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const turn = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => {
        const error = new Error('fixture detail must not be classified');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
    const settlement = settleCodexTurnWithinDeadline(
      controller,
      turn,
      resolveCodexFeasibilityTurnDeadlineMs('isolated-empty'),
    );
    const rejection = expect(settlement).rejects.toMatchObject({ name: 'AbortError' });

    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    expect(controller.signal.aborted).toBe(true);
  });

  it('clears its deadline when the SDK turn settles first', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    await expect(settleCodexTurnWithinDeadline(
      controller,
      Promise.resolve('completed'),
      15_000,
    )).resolves.toBe('completed');

    await vi.advanceTimersByTimeAsync(15_000);
    expect(controller.signal.aborted).toBe(false);
  });

  it('applies the internal deadline in utility turns and the outer timeout in both producers', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const utilitySource = readFileSync(path.join(
      rootDir,
      'src/main/codex-feasibility/utility-entry.ts',
    ), 'utf8');
    const capabilitySource = readFileSync(path.join(
      rootDir,
      'src/main/codex-feasibility/probe-main.ts',
    ), 'utf8');
    const outputSchemaSource = readFileSync(path.join(
      rootDir,
      'src/main/codex-feasibility/output-schema-probe-main.ts',
    ), 'utf8');

    expect(utilitySource.match(/settleCodexTurnWithinDeadline\(/g)).toHaveLength(2);
    expect(capabilitySource).toContain('CODEX_FEASIBILITY_SESSION_TIMEOUT_MS');
    expect(outputSchemaSource).toContain('CODEX_FEASIBILITY_SESSION_TIMEOUT_MS');
    expect(capabilitySource).not.toContain('45_000');
    expect(outputSchemaSource).not.toContain('60_000');
  });

  it('records the remediation as static-only and invalidates the prior runtime attempt', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r8a-turn-deadline.json',
    ), 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, {
        value: boolean;
        source: string;
        evidenceId: string;
        classification: string;
      }>;
      limitations: string[];
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('sdk_turn_and_session_deadlines_separated');
    for (const assertion of Object.values(evidence.assertions)) {
      expect(assertion.value).toBe(true);
      expect(assertion.source).toBe('static_manifest');
      expect(assertion.evidenceId).toBe('block6a-remediation-r8a-turn-deadline-001');
      expect(assertion.classification).toMatch(
        /^(?:turn_deadline_boundary_frozen|recertification_required)$/,
      );
    }
    expect(evidence.limitations).toContain(
      'The 74ec65f R8a timeout records remain historical failed-attempt evidence and cannot certify this changed runtime boundary.',
    );
    expect(JSON.stringify(evidence)).not.toMatch(
      /"(?:prompt|stdout|stderr|pid|environmentValue|credential|executablePath)"\s*:/i,
    );
  });
});
