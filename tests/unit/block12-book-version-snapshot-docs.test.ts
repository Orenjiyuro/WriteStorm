import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.9 documentation', () => {
  it('records D064 and the contract-only snapshot boundary', () => {
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

    expect(context).toContain('D064 completes Task 12.9');
    expect(decisions).toContain('## D064: Book Version Snapshot Is Immutable And Module-Complete');
    expect(admission).toContain('### Task 12.9: Book Version Snapshot DTO');
    expect(admission).toContain('Status: complete as a contract and test-fixture boundary.');
    expect(admission).toContain('No analysis-configuration migration, table, repository, service, IPC, preload, renderer read path, or production snapshot producer');
    expect(decisions).toContain('parsed instant rather than ISO source-string order');
    expect(context).toContain('Mixed UTC offsets are compared as instants');
    expect(admission).toContain('equal instants are rejected');
    expect(continuousPlan).toContain('mixed-offset chronological ordering');
  });

  it('records deterministic impact derivation instead of caller declarations', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

    for (const document of [context, decisions, status]) {
      expect(document).toContain('D076');
      expect(document).toContain('analysis_configuration_snapshot_diff_v1');
      expect(document).toContain('deriveAnalysisConfigurationImpact');
      expect(document).toContain('caller-declared affected modules');
    }
  });
});
