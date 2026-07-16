import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 10 durable engineering status', () => {
  it('records the Task 10.1 Job vocabulary and capability boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.1');
      expect(document).toContain('analysis_module_shell_creation');
      expect(document).toContain('analysis_module_instance_analysis');
      expect(document).toContain('contract_only');
      expect(document).toContain('analysis_module_instance_batch');
      expect(document).toContain('runtime owner');
      expect(document).toContain('totalUnits');
    }
    expect(decisions).toContain('D033: Job Vocabulary And Capability Policy');
  });
});
