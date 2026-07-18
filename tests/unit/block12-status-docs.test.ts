import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const statusPath = 'docs/engineering/V1-BLOCK-12-STATUS.md';

describe('Block 12 durable engineering status', () => {
  it('creates the authoritative Block 12 status and reconciles every master task', () => {
    expect(existsSync(statusPath)).toBe(true);
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('Block 12 is complete within the recorded V1 shell and TypeLibrary boundary.');
    for (let task = 1; task <= 15; task += 1) {
      expect(status).toContain(`| 12.${task} |`);
    }
    expect(status).toContain('12.1 repository/service target remains blocked/deferred');
  });

  it('keeps CONTEXT, DECISIONS, admission, and status mutually consistent', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );
    const status = readFileSync(statusPath, 'utf8');

    for (const document of [context, decisions, admission, status]) {
      expect(document).toContain('D070');
      expect(document).toContain('Task 12.15');
      expect(document).toContain('local_only');
      expect(document).toContain('manual_log_export_not_admitted');
      expect(document).toContain('Technique production tables');
    }
    expect(context).toContain('V1-BLOCK-12-STATUS.md');
    expect(decisions).toContain('## D070: Local Observability Is Local-Only And Non-Executing');
  });

  it('records final natural-path and certification evidence without widening scope', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('Technique Library empty state');
    expect(status).toContain('Adopt confirmed candidate');
    expect(status).toContain('Read-only · no write-back');
    expect(status).toContain('Original shelf');
    expect(status).toContain('Local observability');
    expect(status).toContain('npm run check');
    expect(status).toContain('packaged Electron E2E');
    expect(status).toContain('No real AI');
    expect(status).toContain('No real log read, clear, or export execution');
  });
});
