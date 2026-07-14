import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('V1 foundation decisions', () => {
  it('keeps canonical current-state documentation ahead of historical checkpoint wording', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');

    expect(context).toContain('Current-state contradiction scans');
    expect(context).toContain('persisted Book shelf reads');
    expect(context).toContain('txt/md import and metadata. Completed');
    expect(context).toContain('Block 8A detection, persistence, Job lifecycle');
    expect(context).not.toContain('book shelf content remains empty');
    expect(context).not.toContain('structure detection and module generation remain blocked');
    expect(context).not.toContain('Implement txt/md import and metadata. Not started');
    expect(context).not.toContain('Implement structure/story range shells. Not started');
  });

  it('records schema reset, table admission and immutable migration policy', () => {
    const adr = readFileSync(
      'docs/adr/0001-pre-release-schema-reset-and-table-admission.md',
      'utf8',
    );

    expect(adr).toContain('pre-release schema reset');
    expect(adr).toContain('production table admission');
    expect(adr).toContain('source/{sourceTextId}/{originalFileName}');
    expect(adr).toContain('published migrations are immutable');
  });

  it('records the Block 8 preservation manifest for Task 19', () => {
    const adr = readFileSync(
      'docs/adr/0001-pre-release-schema-reset-and-table-admission.md',
      'utf8',
    );

    expect(adr).toContain('Block 8 preservation manifest');
    expect(adr).toContain('src/main/structure/detection/structure-detector.ts');
    expect(adr).toContain('tests/fixtures/structure/structure-detection-fixtures.ts');
    expect(adr).toMatch(/SHA-256/i);
  });

  it('requires both clean HEAD and preserved-snapshot checkpoint verification', () => {
    const adr = readFileSync(
      'docs/adr/0001-pre-release-schema-reset-and-table-admission.md',
      'utf8',
    );

    expect(adr).toContain('HEAD-only clean archive');
    expect(adr).toContain('HEAD + preserved snapshot');
    expect(adr).toContain('cannot prove that the commit is self-contained');
  });
});
