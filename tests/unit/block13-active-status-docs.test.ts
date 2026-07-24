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
    expect(status).toContain('| 13.5 | REVALIDATION REQUIRED |');
    expect(status).toContain('| 13.6 | PASS for boundary |');
    expect(status).toContain('| 13.7 | PASS for contract |');
    expect(status).toContain('| 13.8 | PASS for pure in-memory boundary |');
    expect(status).toContain('| 13.9 | PASS for lifecycle/cleanup boundary |');
    expect(status).toContain('| 13.10 | PASS for diagnostic contract boundary |');
    expect(status).toContain('| 13.11 | REVALIDATION REQUIRED |');
    expect(status).toContain(
      '| 13.12 | IMPLEMENTED; RUNTIME BLOCKED BY STALE COMPATIBILITY |',
    );
  });

  it('preserves historical decisions and appends the remediation decision', () => {
    expect(decisions).toContain('## D099: Windows Packaged Codex Attempts Do Not Require Global Git');
    expect(decisions).toContain('## D100: Task 13.4–13.5 Review Remediation Is Freshness-Bound');
    expect(decisions).toContain('## D101: The V1 AI Execution Port Is One Sealed Application Protocol');
    expect(decisions).toContain('## D104: Task 13.6 Auth Observation Is Fail-Closed and Ephemeral');
    expect(decisions).toContain('## D105: Task 13.7 Structured Output Is Strict Before Execution');
    expect(decisions).toContain('## D106: Task 13.8 Has One Bounded In-Memory Attempt State Machine');
    expect(decisions).toContain('## D107: Task 13.9 Lifecycle Cleanup Is Single-Flight and Fail-Closed');
    expect(decisions).toContain(
      '## D108: Task 13.9 Review Remediation Seals Raw, Auth and Cleanup Bypasses',
    );
    expect(decisions).toContain(
      '## D109: Auth Authority and Window Lifecycle Admission Are Composition-Owned',
    );
    expect(decisions).toContain(
      '## D110: AI Diagnostics Are Authoritative, Bounded and Cost-Neutral',
    );
    expect(decisions).toContain(
      '## D111: Product Packaged Runtime Certification Is Explicit, Fixed and Platform-Limited',
    );
    expect(decisions).toContain(
      '## D112: Current Windows Packaged Runtime Is Recertified Without Global Git',
    );
    expect(decisions).toContain(
      '## D113: Settings Connection Check Is Explicit, Three-Layered and Ephemeral',
    );
    expect(decisions).toContain(
      '## D114: Gate Projection and Runtime Cleanup Boundaries Fail Closed from One Authority',
    );
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

  it('records single-flight lifecycle cleanup without promoting a real SDK execution', () => {
    expect(status).toContain('exactly one attempt/generation owner');
    expect(status).toContain('every retry is an explicit call');
    expect(status).toContain('forced or unverified overrides');
    expect(status).toContain('no SDK client or turn');
    expect(status).toContain('Task 13.11 admits only its separate fixed certification path');
  });

  it('records the seven review remediations as active fail-closed boundaries', () => {
    expect(status).toContain('counts raw bytes and frames before parsing');
    expect(status).toContain('reject coercion, defaults, catches, transforms and overwrite checks');
    expect(status).toContain('composition-owned Codex authority');
    expect(status).toContain('TypeScript AST gate scans all production Main imports');
    expect(status).toContain('privately constructs its controller');
    expect(status).toContain('`waitForIdle` waits for actual safe settlement');
    expect(status).toContain('`unverified` cleanup remains quarantined');
    expect(status).toContain('non-zero/signal exits remain unverified');
    expect(status).toContain('Window close pauses AI admission');
    expect(status).toContain('Active or quarantined participants cannot unregister');
    expect(status).toContain('timeout scheduler throws');
  });

  it('does not promote the current state to broader readiness', () => {
    expect(status).not.toMatch(/\bFull Go\b|\bCross-platform Go\b|\bAI ready\b|\brelease ready\b/);
    expect(status).toContain('macOS remains deferred');
  });

  it('records Task 13.10 without inventing evidence, usage or release readiness', () => {
    expect(status).toContain('`AI_AUTH_ERROR`, `AI_RATE_LIMITED`, `AI_SCHEMA_INVALID`');
    expect(status).toContain('unknown runtime accepts only `runtime_unknown`');
    expect(status).toContain('exposes no auth, rate or network producer');
    expect(status).toContain('No total, cost estimate, budget or preflight confirmation is derived');
    expect(status).toContain('capped at 256 frozen records');
    expect(status).toContain('does not write a file, log to console, upload telemetry or expose IPC');
    expect(status).toContain('clean-machine');
    expect(status).toContain('SDK/CLI licenses/notices');
  });

  it('records the explicit Task 13.12 channel without promoting stale runtime evidence', () => {
    expect(status).toContain('`ai:check-connection` accepts only `{}`');
    expect(status).toContain('never invokes it on startup, route render, Library open or navigation');
    expect(status).toContain('rejected concurrent, paused or quarantined admission preserves it');
    expect(status).toContain('No new SDK/auth/network probe ran in Task 13.12');
    expect(status).toContain('Task 13.12 makes both packaged records stale again');
    expect(status).toContain('config/block13-ai-gate-v1.json');
  });
});
