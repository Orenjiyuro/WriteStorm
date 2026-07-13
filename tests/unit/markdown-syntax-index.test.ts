import { describe, expect, it } from 'vitest';
import { createMarkdownSyntaxIndex } from '../../src/main/structure/detection/markdown-syntax-index';

describe('Markdown syntax index', () => {
  it('distinguishes Setext underline spans from real horizontal rules and records blank-line clusters', () => {
    const sourceText = [
      '第１話 始まり',
      '------',
      '',
      '',
      '---',
      '',
      '第２話 続き',
    ].join('\n');
    const index = createMarkdownSyntaxIndex(sourceText);

    expect(index.setextUnderlines).toEqual([{
      startOffset: sourceText.indexOf('------'),
      endOffset: sourceText.indexOf('------') + 6,
    }]);
    expect(index.horizontalRules).toEqual([{
      startOffset: sourceText.indexOf('\n---\n') + 1,
      endOffset: sourceText.indexOf('\n---\n') + 4,
    }]);
    expect(index.blankLineClusters).toEqual([{
      startOffset: sourceText.indexOf('\n\n\n') + 1,
      endOffset: sourceText.lastIndexOf('---'),
    }]);
  });

  it('does not classify syntax inside fenced code as a Setext underline or horizontal rule', () => {
    const sourceText = ['```md', 'Hidden title', '---', '```', '***'].join('\n');
    const index = createMarkdownSyntaxIndex(sourceText);

    expect(index.setextUnderlines).toEqual([]);
    expect(index.horizontalRules).toEqual([{
      startOffset: sourceText.lastIndexOf('***'),
      endOffset: sourceText.length,
    }]);
  });
});
