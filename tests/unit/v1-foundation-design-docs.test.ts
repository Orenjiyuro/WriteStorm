import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('V1 foundation decisions', () => {
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
});
