import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsRoute } from '../../src/renderer/routes/SettingsRoute';

describe('Block 12 Task 12.13 Settings and AI unavailable shell', () => {
  it('shows the three-layer unknown state without probing runtime during render', () => {
    const markup = renderToStaticMarkup(<SettingsRoute />);

    expect(markup).toContain('AI &amp; connectors');
    expect(markup).toContain('Integration gate');
    expect(markup).toContain('Windows feasibility');
    expect(markup).toContain('Platform boundary');
    expect(markup).toContain('SDK compatibility');
    expect(markup).toContain('Runtime authentication');
    expect(markup).toContain('Not observed');
    expect(markup).toContain(
      'AI actions remain disabled. This check reports gate, compatibility, and current runtime authentication separately.',
    );
  });

  it('shows four disabled maintenance entry placeholders with specific ownership reasons', () => {
    const markup = renderToStaticMarkup(<SettingsRoute />);

    for (const label of [
      'Manage templates',
      'Inspect schemas',
      'Repair library',
      'Run health check',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Production template management is not admitted.');
    expect(markup).toContain('Schema inspection tooling is not admitted.');
    expect(markup).toContain('Library repair remains owned by Block 18.');
    expect(markup).toContain('Library health execution remains owned by Block 18.');
    expect(markup.match(/data-settings-placeholder=/g)).toHaveLength(4);
  });

  it('keeps every placeholder outside action and privileged API boundaries', () => {
    const source = readFileSync(
      'src/renderer/features/settings/SettingsUnavailableShell.tsx',
      'utf8',
    );

    expect(source).not.toMatch(/window\.writestorm|preload|\bipc\b|better-sqlite3/);
    expect(source).not.toMatch(/node:fs|node:child_process|CodexClient|@openai\//);
    expect(source.match(/onClick=/g)).toHaveLength(1);
    expect(source).toContain('controller.current?.check()');
  });
});
