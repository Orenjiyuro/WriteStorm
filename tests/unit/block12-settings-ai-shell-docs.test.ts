import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.13 documentation', () => {
  it('records D068 and the non-executing Settings capability boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );
    const continuousPlan = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-CONTINUOUS-PLAN.md',
      'utf8',
    );

    expect(context).toContain('D068 completes Task 12.13');
    expect(decisions).toContain('## D068: Settings Exposes Truthful AI And Maintenance Placeholders');
    expect(admission).toContain('### Task 12.13: Settings And AI Unavailable Shell');
    expect(admission).toContain('Status: complete as a natural-path non-executing capability shell.');
    expect(admission).toContain(
      'Task 12.15 now owns the `local_only` policy and disabled recent-error, cleanup, and manual-export shell.',
    );
    expect(admission).toContain('Task 12.15 is complete as a natural `local_only` observability shell');
    expect(admission).toContain(
      'No SDK probe, connector discovery, health scan, repair, schema inspection, log read, log write, or template mutation',
    );
    expect(`${context}\n${decisions}\n${admission}\n${continuousPlan}`)
      .not.toContain('Task 12.13 later extends');
  });

  it('records Settings as an application-level route independent of Library lifecycle', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

    for (const document of [context, decisions, status]) {
      expect(document).toContain('D073');
      expect(document).toContain('application-level Settings');
      expect(document).toContain('before a Library is opened');
      expect(document).toContain('Breakdown-only queries');
    }
    expect(`${context}\n${decisions}`).not.toContain(
      'After opening a Library, the user enters Settings',
    );
  });
});
