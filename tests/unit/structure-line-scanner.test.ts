import { describe, expect, it } from 'vitest';
import { scanStructureSourceLines } from '../../src/main/structure/detection/line-scanner';
import { LINE_SCANNER_FIXTURES } from '../fixtures/structure/line-scanner-fixtures';

describe('structure line scanner', () => {
  it('preserves raw text, CRLF/LF delimiters, and UTF-16 code-unit spans', () => {
    const sourceText = LINE_SCANNER_FIXTURES.decodedMixedNewlines;
    const lines = scanStructureSourceLines(sourceText);

    expect(lines.map((line) => ({
      rawText: line.rawText,
      lineEnding: line.lineEnding,
    }))).toEqual([
      { rawText: '第１章　始まり', lineEnding: '\r\n' },
      { rawText: '# 第二章：🌕月光', lineEnding: '\n' },
      { rawText: '## Chapter 3 - English', lineEnding: '\r\n' },
      { rawText: '```markdown', lineEnding: '\n' },
      { rawText: '# faux heading inside a fence', lineEnding: '\r\n' },
      { rawText: '```', lineEnding: '\n' },
      { rawText: 'プロローグ', lineEnding: '' },
    ]);
    expect(lines.map((line) => sourceText.slice(line.startOffset, line.endOffset)))
      .toEqual(lines.map((line) => line.rawText));
    expect(lines.map((line) => sourceText.slice(line.endOffset, line.nextOffset)))
      .toEqual(lines.map((line) => line.lineEnding));
    expect(lines[1]?.endOffset - lines[1]?.startOffset)
      .toBe('# 第二章：🌕月光'.length);
    expect(lines.at(-1)?.nextOffset).toBe(sourceText.length);
  });

  it('does not remove a BOM or classify fenced code before source decoding and title detection', () => {
    const [line] = scanStructureSourceLines(LINE_SCANNER_FIXTURES.utf8BomPrefixed);

    expect(line).toMatchObject({
      rawText: '\uFEFF第１章　始まり',
      startOffset: 0,
      endOffset: '\uFEFF第１章　始まり'.length,
      lineEnding: '\r\n',
    });
  });
});
