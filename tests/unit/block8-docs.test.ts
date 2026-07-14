import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const statusPath = path.resolve('docs/engineering/V1-BLOCK-8A-STATUS.md');
const contextPath = path.resolve('docs/engineering/CONTEXT.md');

describe('Block 8A status record', () => {
  it('locks master status, internal numbering, and authorization boundaries', () => {
    const status = readFileSync(statusPath, 'utf8');

    for (const task of ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.9', '8.10', '8.12', '8.13', '8.18']) {
      expect(status).toContain(`| ${task} |`);
    }
    for (const slice of ['8A-0', '8A-R1 through 8A-R6', '8A-7', '8A-8', '8A-9', '8A-10']) {
      expect(status).toContain(slice);
    }
    expect(status).toContain('8A-10 | Worker telemetry');
    expect(status).toContain('Task 8.13');
    expect(status).toContain('Master Task 8.10 means Validation');
    expect(status).toContain('Block 8B Review and freeze');
    expect(status).toContain('Block 8C Invalidation hook');
    expect(status).not.toContain('Block 8 is complete');
  });

  it('records feasibility and packaged-performance evidence without overstating it', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('6A/Codex SDK feasibility remains unexecuted and unrecorded');
    expect(status).not.toMatch(/6A[^\n]{0,80}\bGo\b/);
    expect(status).toContain('observation-only advisories');
    expect(status).toContain('macOS packaged performance evidence has not been recorded');
    expect(status).toContain('Task 8.9 candidate persistence and stage-separation foundation is complete');
    expect(status).toContain('draft/frozen repository and service transactions remain 8B work');
  });

  it('makes CONTEXT route readers to the durable 8A status and preserves unfinished boundaries', () => {
    const context = readFileSync(contextPath, 'utf8');

    expect(context).toContain('Current Block 8A gate facts:');
    expect(context).toContain('V1-BLOCK-8A-STATUS.md');
    expect(context).toContain('internal 8A-10 maps to master Task 8.13');
    expect(context).toContain('master Task 8.10 is validation');
    expect(context).toContain('6A feasibility remains unexecuted and unrecorded');
    expect(context).toContain('8B and 8C remain unimplemented');
    expect(context).not.toContain('Block 8 is complete');
  });
});
