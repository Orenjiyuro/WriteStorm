import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const context = readFileSync(path.join(rootDir, 'docs/engineering/CONTEXT.md'), 'utf8');
const status = readFileSync(
  path.join(rootDir, 'docs/engineering/V1-BLOCK-13-STATUS.md'),
  'utf8',
);
const decisions = readFileSync(path.join(rootDir, 'docs/engineering/DECISIONS.md'), 'utf8');
const verdict =
  'Conditional Go — Windows feasibility verified; macOS packaged runtime deferred-by-user.';

describe('Block 13 active status authority', () => {
  it('records the exact platform-limited verdict and current task boundary', () => {
    expect(context).toContain(verdict);
    expect(status).toContain(verdict);
    expect(status).toContain('| 13.5 | PASS for Windows |');
    expect(status).toContain('| 13.6 | PASS for boundary |');
    expect(status).toContain('| 13.7 | PASS for contract |');
    expect(status).toContain('| 13.8 | PASS for pure in-memory boundary |');
    expect(status).toContain('| 13.9 | NOT STARTED |');
  });

  it('preserves historical decisions and appends the remediation decision', () => {
    expect(decisions).toContain('## D099: Windows Packaged Codex Attempts Do Not Require Global Git');
    expect(decisions).toContain('## D100: Task 13.4–13.5 Review Remediation Is Freshness-Bound');
    expect(decisions).toContain('## D101: The V1 AI Execution Port Is One Sealed Application Protocol');
    expect(decisions).toContain('## D104: Task 13.6 Auth Observation Is Fail-Closed and Ephemeral');
    expect(decisions).toContain('## D105: Task 13.7 Structured Output Is Strict Before Execution');
    expect(decisions).toContain('## D106: Task 13.8 Has One Bounded In-Memory Attempt State Machine');
    expect(decisions).toContain('26d548e03dfbe71e1f62081998e9942a2dfaa94c');
  });

  it('freezes the auth mapping without claiming unverified states', () => {
    expect(status).toContain('`login_required → auth_required`');
    expect(status).toContain('`auth_failed → unknown`');
    expect(status).toContain('`unverified → unknown`');
    expect(status).toContain('`auth_expired` and `permission_denied` remain unverified');
    expect(status).toContain('application observation remains `unknown`');
  });

  it('records strict structured output without promoting runtime execution', () => {
    expect(status).toContain('`invalid_json`, `invalid_shape`, `missing_field`, `extra_field`');
    expect(status).toContain('`output_too_large`');
    expect(status).toContain('structured-output capability remains `false`');
    expect(status).toContain('missing/extra cases are local deterministic witnesses');
  });

  it('records bounded in-memory candidates without claiming persistence or resume', () => {
    expect(status).toContain('2,621,440 bytes per projected/raw provider event');
    expect(status).toContain('4,096 events');
    expect(status).toContain('candidates are not durable checkpoints');
    expect(status).toContain('no result is resumable');
    expect(status).toContain('capabilities remain `false`');
  });

  it('does not promote the current state to broader readiness', () => {
    expect(status).not.toMatch(/\bFull Go\b|\bCross-platform Go\b|\bAI ready\b|\brelease ready\b/);
    expect(status).toContain('macOS remains deferred');
  });
});
