import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveAppRoute } from '../../src/renderer/app/AppRouter';
import { ProductNavigation } from '../../src/renderer/components/ProductNavigation';
import { OriginalShelfRoute } from '../../src/renderer/routes/OriginalShelfRoute';
import type { LibrarySessionSummary } from '../../src/shared/contracts';
import type { LibraryId } from '../../src/shared/domain';

const library: LibrarySessionSummary = {
  sessionId: '00000000-0000-4000-8000-000000000012',
  library: {
    id: 'library-block-12' as LibraryId,
    name: 'Block 12 Library',
    rootPath: 'C:\\Libraries\\Block12',
    schemaVersion: 7,
    appVersion: '0.1.0-test',
  },
};

describe('Block 12 Task 12.12 Original shelf placeholder route', () => {
  it('exposes an independent natural product navigation entry', () => {
    const markup = renderToStaticMarkup(<ProductNavigation activeRoute="originals" />);

    expect(resolveAppRoute('#/originals')).toBe('originals');
    expect(markup).toContain('href="#/originals"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Original shelf');
  });

  it('renders only an honest placeholder with native project creation disabled', () => {
    const markup = renderToStaticMarkup(<OriginalShelfRoute library={library} />);

    expect(markup).toContain('Original shelf');
    expect(markup).toContain('Block 12 Library');
    expect(markup).toContain('V1 placeholder only');
    expect(markup).toContain('Create original project');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-describedby="original-project-create-disabled-reason"');
    expect(markup).toContain('Original project creation is outside the V1 admitted scope.');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('<textarea');
  });

  it('does not render Technique Library data, controls, or invented original instances', () => {
    const markup = renderToStaticMarkup(<OriginalShelfRoute library={library} />);

    expect(markup).not.toContain('TechniqueEntry');
    expect(markup).not.toContain('SourceSnapshot');
    expect(markup).not.toContain('Adopt confirmed candidate');
    expect(markup).not.toContain('Edit technique');
    expect(markup).not.toContain('original-book-1');
    expect(markup).not.toContain('original-project-1');
  });

  it('keeps creation and privileged operations outside the route API and source boundary', () => {
    const source = readFileSync('src/renderer/routes/OriginalShelfRoute.tsx', 'utf8');

    expect(source).toContain('readonly library: LibrarySessionSummary');
    expect(source).not.toMatch(/readonly onCreate|readonly onAction|readonly projects/);
    expect(source).not.toMatch(
      /onClick=|window\.writestorm|preload|ipc|better-sqlite3|node:fs|node:child_process|Codex|@openai\//i,
    );
  });
});
