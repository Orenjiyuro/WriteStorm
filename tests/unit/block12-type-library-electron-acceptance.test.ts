import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const specPath = 'tests/e2e/type-library-natural-path.spec.ts';
const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
const continuousPlan = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-CONTINUOUS-PLAN.md',
  'utf8',
);
const emptyStateSpec = readFileSync('tests/e2e/empty-state.spec.ts', 'utf8');
const appRouterHarness = readFileSync(
  'tests/e2e/fixtures/app-router-session-harness.tsx',
  'utf8',
);

describe('Block 12 TypeLibrary Electron acceptance governance', () => {
  it('records D061 only after a real natural-entry packaged Electron spec exists', () => {
    expect(existsSync(specPath)).toBe(true);
    const spec = readFileSync(specPath, 'utf8');

    expect(decisions).toContain('D061: TypeLibrary Electron Acceptance Completes Task 12.6D.5');
    expect(context).toContain('D061 completes Task 12.6D.5');
    expect(continuousPlan).toContain('Task 12.6D.5 is complete');
    expect(spec).toContain("name: 'Import source', exact: true");
    expect(spec).toContain("getByRole('button', { name: 'Save classification' })");
    expect(spec).toContain('missing_main_type');
    expect(spec).toContain('methodology_not_ready');
    expect(spec).toContain('focus-only');
    expect(spec).not.toMatch(/\b(?:INSERT|DELETE)\b/i);
    expect(spec).not.toMatch(
      /UPDATE\s+(?:books|book_type_bindings|book_content_focus_bindings)\b/i,
    );
    expect(spec).toContain('UPDATE type_definitions SET archived_at = ? WHERE id = ?');
  });

  it('keeps packaged preload and AppRouter harness coverage aligned with TypeLibrary', () => {
    expect(emptyStateSpec).toContain("typeLibrary: Object.keys(window.writestorm.typeLibrary)");
    expect(emptyStateSpec).toContain("typeLibrary: ['listOptions', 'getBookBinding', 'updateBookBinding']");
    expect(appRouterHarness).toContain('const api: WritestormApi = {');
    expect(appRouterHarness).toContain('typeLibrary: {');
    expect(appRouterHarness).not.toContain('as unknown as WritestormApi');
  });

  it('removes completed persistence and natural-path work from authoritative Open Inputs', () => {
    expect(admissionOpenInputs()).not.toContain('first-write/update CAS service');
    expect(admissionOpenInputs()).not.toContain('IPC/preload, renderer');
    expect(admissionOpenInputs()).toContain('Block 14 methodology content');
    expect(admissionOpenInputs()).toContain('Block 17 runtime validation');
  });
});

function admissionOpenInputs(): string {
  const admission = readFileSync(
    'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
    'utf8',
  );
  const section = admission.slice(admission.indexOf('## Open Inputs'));
  return section.slice(0, section.indexOf('\n\nThese remaining'));
}
