import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.10 documentation', () => {
  it('records D065 and the blocked natural-entry boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );

    expect(context).toContain('D065 established the Task 12.10');
    expect(context).toContain('obsolete `codex_sdk_gate_required` product claim is removed');
    expect(decisions).toContain('## D065: Sample Preview Is A Visible Blocked Publication Gate');
    expect(admission).toContain('### Task 12.10: Sample Preview Blocked Entry');
    expect(admission).toContain('Status: complete as a natural-path blocked shell.');
    expect(admission).toContain(
      'exact active blocker codes `prompt_template_instance_unavailable` and `sample_preview_runtime_not_admitted`',
    );
    expect(admission).toContain('belongs to Block 17 production Job/prompt admission');
    expect(admission).toContain('No sample Job, fixture execution, Prompt body, SDK call, provider call, AI output, persistence, IPC, or preload method');
  });
});
