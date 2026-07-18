import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.8 documentation', () => {
  it('records D063 and the metadata-only registry boundary', () => {
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
    const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

    expect(context).toContain('D063 completes Task 12.8');
    expect(decisions).toContain('## D063: PromptTemplate Registry Is A Metadata-Only Domain Shell');
    expect(decisions).toContain(
      '## D077: Prompt Aggregate Proves Provenance Ownership And Rollback Direction',
    );
    expect(admission).toContain('### Task 12.8: PromptTemplate Registry Domain Shell');
    expect(admission).toContain('Status: complete as a metadata-only domain shell.');
    expect(admission).toContain('No PromptTemplate table, seed, repository, service, IPC, preload, renderer entry, sample execution, publication transition, or AI runtime');
    expect(decisions).toContain(
      'Publication chronology compares parsed instants rather than ISO source-string order',
    );
    expect(context).toContain('`publishedAt` must not predate `createdAt`');
    expect(admission).toContain('equal instants are allowed');
    expect(continuousPlan).toContain('mixed-offset publication chronology');
    for (const document of [context, decisions, admission]) {
      expect(document).toContain('Task 12.11R2');
      expect(document).toContain('new version identity');
      expect(document).toContain('must not predate');
      expect(document).toContain('equal instants are allowed');
    }
    expect(status).toContain('Task 12.11R2 is complete');
    expect(status).not.toContain('Prompt draft identity and chronology remediation remains open');
    for (const document of [context, decisions, admission, status]) {
      expect(document).toContain('D077');
      expect(document).toContain('provenance');
    }
  });
});
