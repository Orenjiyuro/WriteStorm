import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 11 durable engineering status', () => {
  const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
  const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
  const status = readFileSync('docs/engineering/V1-BLOCK-11-STATUS.md', 'utf8');

  it('marks Block 11 complete in the authoritative context', () => {
    expect(context).toContain('Block 11 is complete at commit `ddde1a1`');
    expect(context).toContain('V1-BLOCK-11-STATUS.md');
    expect(context).toContain('Tasks 11.1–11.8');
    expect(context).not.toContain('Implement export blocked state. Not started.');
  });

  it('records the truthful target, owner, and preview contract', () => {
    for (const document of [context, decisions, status]) {
      expect(document).toContain('export_execution_not_admitted');
      expect(document).toContain('markdown_package');
      expect(document).toContain('machine_package');
      expect(document).toContain('expected `7`');
      expect(document).toContain('actual `0`');
      expect(document).toContain('actual `7`');
      expect(document).toContain('same Book');
      expect(document).toContain('owner');
    }
    expect(decisions).toContain('D042: Export Blocked Status Contract And Owner Boundary');
  });

  it('records the read-only IPC and natural non-Job entry', () => {
    for (const document of [context, decisions, status]) {
      expect(document).toContain('exports:get-status');
      expect(document).toContain('Breakdown shelf');
      expect(document).toContain('Jobs & recovery');
      expect(document).toContain('not a Job');
      expect(document).toContain('arbitrary path');
      expect(document).toContain('Markdown/JSON');
    }
    expect(decisions).toContain('D043: Read-Only Export Status Path And Natural Entry');
  });

  it('records Tasks 11.1 through 11.8 and the final certification', () => {
    for (let task = 1; task <= 8; task += 1) {
      expect(status).toContain(`11.${task}`);
    }
    expect(status).toContain('527 tests');
    expect(status).toContain('256 tests');
    expect(status).toContain('13/13 packaged Electron E2E tests');
    expect(status).toContain('ddde1a1');
    expect(status).toContain('total_changes()');
    expect(status).toContain("kind = 'export'");
    expect(status).toContain('Secondary-display placement');
    expect(decisions).toContain('D044: Block 11 No-Write Gate And Completion Boundary');
  });

  it('keeps excluded and future capabilities explicitly unauthorized', () => {
    for (const excluded of [
      'real export',
      'directory selector',
      'Export Job',
      'Codex SDK',
      'AI content',
      'evidence extraction',
      'future owner table',
      'Block 12',
    ]) {
      expect(status).toContain(excluded);
    }
    expect(status).toContain('No migration 006');
    expect(status).toContain('schema version remains 5');
  });
});
