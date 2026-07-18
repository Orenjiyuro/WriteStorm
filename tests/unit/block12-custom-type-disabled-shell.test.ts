import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.7 governance', () => {
  it('records the disabled-shell completion without admitting custom-type flows', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );

    expect(context).toContain('D062 completes Task 12.7');
    expect(decisions).toContain('## D062: Custom Type Entry Remains An Honest Disabled Shell');
    expect(admission).toContain('Task 12.7 is complete as a disabled shell.');
    expect(admission).toContain('does not create, copy, edit, archive, publish, activate, or rebase');
    expect(admission).toContain('No custom-type migration, table, seed, repository, service, IPC, or preload method');
  });
});
