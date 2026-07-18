import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.6R1 documentation', () => {
  it('records retained selection for ordinary retry and token ownership for encoding retry', () => {
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

    expect(context).toContain('Task 12.6R1 closes the import-retry classification gap');
    expect(decisions).toContain('D060 remediation in Task 12.6R1');
    expect(decisions).toContain('`choose_file`, `choose_smaller_file`, and `retry_import`');
    expect(admission).toContain('### Task 12.6R1: Import Retry Classification Retention');
    expect(continuousPlan).toContain('Task 12.6R1 preserves the retained user selection');
    for (const document of [context, decisions, admission, continuousPlan]) {
      expect(document).toContain('encoding retry');
      expect(document).toContain('pending token');
      expect(document).not.toContain('retry silently drops classification');
    }
  });
});
