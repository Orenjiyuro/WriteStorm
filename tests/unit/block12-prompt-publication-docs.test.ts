import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 12 Task 12.11 documentation', () => {
  it('records D066 and the non-executing publication boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const admission = readFileSync(
      'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
      'utf8',
    );
    const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

    expect(context).toContain('D066 completes Task 12.11');
    expect(decisions).toContain(
      '## D066: Prompt Publication Controls Are A Non-Executing State Machine Shell',
    );
    expect(decisions).toContain(
      '## D078: Publish Is Monotonic Across Version And Publication History',
    );
    expect(admission).toContain('### Task 12.11: Publication Controls State Machine Shell');
    expect(admission).toContain('Status: complete as a natural-path constrained state-machine shell.');
    expect(decisions).toContain('validated `PromptTemplateRegistryAggregate`');
    expect(decisions).toContain('records the immutable publication fact before repointing');
    expect(decisions).toContain(
      'cannot record a `publishedAt` instant earlier than the draft `createdAt` instant',
    );
    expect(admission).toContain('Rollback is an operation that repoints the current published version');
    expect(admission).toContain('historically published target version');
    expect(decisions).toContain('smaller `templateVersion`');
    expect(admission).toContain('`rollback_target_not_earlier`');
    expect(context).toContain('successful rollback clears its selection');
    for (const document of [context, decisions, admission, status]) {
      expect(document).toContain('D078');
      expect(document).toContain('strictly larger `templateVersion`');
    }
    expect(admission).toContain('`draft_version_not_newer`');
    expect(admission).toContain('Disabling retains the current published pointer');
    expect(admission).toContain('No migration, table, repository, service, IPC, preload method, template instance, or Book snapshot mutation');
  });
});
