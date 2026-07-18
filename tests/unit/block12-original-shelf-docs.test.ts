import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.12 documentation', () => {
  it('records D067 and the independent placeholder boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );

    expect(context).toContain('D067 completes Task 12.12');
    expect(decisions).toContain('## D067: Original Shelf Remains An Independent Placeholder');
    expect(admission).toContain('### Task 12.12: Original Shelf Independent Placeholder');
    expect(admission).toContain('Status: complete as a natural-path non-creating placeholder.');
    expect(admission).toContain(
      'No OriginalBook, original-project table, repository, service, IPC, preload method, or creation handler',
    );
    expect(admission).toContain(
      'The Original shelf does not render Technique Library entries, candidates, SourceSnapshots, or adoption/editing controls.',
    );
  });
});
