import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromptPublicationControlsShell } from '../../src/renderer/features/prompt-template/PromptPublicationControlsShell';
import {
  PROMPT_PUBLICATION_ACTIONS,
  PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
  evaluatePromptPublicationPermission,
} from '../../src/shared/domain';

describe('Block 12 Task 12.11 Prompt publication controls', () => {
  it('shows all three unavailable operations at the natural Settings entry', () => {
    const markup = renderToStaticMarkup(<PromptPublicationControlsShell />);

    expect(markup).toContain('Publication controls');
    expect(markup).toContain('Publish template');
    expect(markup).toContain('Roll back published version');
    expect(markup).toContain('Disable template');
    expect(markup.match(/disabled=""/g)).toHaveLength(3);
    expect(markup).toContain('sample_preview_not_passed');
    expect(markup).toContain('prompt_template_persistence_not_admitted');
    expect(markup).toContain('Published version');
    expect(markup).toContain('Unavailable');

    for (const action of PROMPT_PUBLICATION_ACTIONS) {
      for (const code of evaluatePromptPublicationPermission(
        PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
        action,
      ).blockerCodes) {
        expect(markup).toContain(code);
      }
    }
  });

  it('keeps the controls component free of action and privileged APIs', () => {
    const source = readFileSync(
      'src/renderer/features/prompt-template/PromptPublicationControlsShell.tsx',
      'utf8',
    );

    expect(source).not.toMatch(
      /onClick=|window\.writestorm|from ['"](?:node:)?fs['"]|\bipc\b|\bsqlite\b|\bsecret\b|\btoken\b|Codex|@openai/,
    );
    expect(source).not.toContain('rolled_back');
  });
});
