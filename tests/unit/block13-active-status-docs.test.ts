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
    expect(status).toContain('| 13.6 | NOT STARTED |');
  });

  it('preserves historical decisions and appends the remediation decision', () => {
    expect(decisions).toContain('## D099: Windows Packaged Codex Attempts Do Not Require Global Git');
    expect(decisions).toContain('## D100: Task 13.4–13.5 Review Remediation Is Freshness-Bound');
    expect(decisions).toContain('26d548e03dfbe71e1f62081998e9942a2dfaa94c');
  });

  it('does not promote the current state to broader readiness', () => {
    expect(status).not.toMatch(/\bFull Go\b|\bCross-platform Go\b|\bAI ready\b|\brelease ready\b/);
    expect(status).toContain('macOS remains deferred');
  });
});
