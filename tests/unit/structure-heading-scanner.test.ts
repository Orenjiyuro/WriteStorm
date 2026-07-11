import { describe, expect, it } from 'vitest';
import { scanStructureHeadings } from '../../src/main/structure/detection/structure-heading-scanner';

describe('structure heading scanner', () => {
  it('returns visible ATX and Setext heading spans but excludes fenced content and underline lines', () => {
    const sourceText = [
      'Chapter 1: Visible',
      '======',
      '```markdown',
      'Chapter 2: Hidden',
      '```',
      '# Chapter 3: Visible',
    ].join('\n');

    expect(scanStructureHeadings(sourceText)).toEqual([
      expect.objectContaining({
        title: 'Chapter 1: Visible',
        startOffset: 0,
        headingEndOffset: 'Chapter 1: Visible'.length,
        baseScore: 0.95,
      }),
      expect.objectContaining({
        title: 'Chapter 3: Visible',
        startOffset: sourceText.indexOf('# Chapter 3'),
        headingEndOffset: sourceText.length,
        baseScore: 0.95,
      }),
    ]);
  });
});
