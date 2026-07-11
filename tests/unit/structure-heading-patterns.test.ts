import { describe, expect, it } from 'vitest';
import { createStructureHeadingMatchView } from '../../src/main/structure/detection/heading-patterns';
import { LINE_SCANNER_FIXTURES } from '../fixtures/structure/line-scanner-fixtures';

describe('structure heading patterns', () => {
  it('uses NFKC only for matching while retaining the original heading text', () => {
    const rawHeadingText = LINE_SCANNER_FIXTURES.fullWidthMarkdownHeading;

    expect(createStructureHeadingMatchView(rawHeadingText)).toBe('# Chapter 1 : 開始');
    expect(rawHeadingText).toBe('＃　Ｃｈａｐｔｅｒ　１　：　開始');
  });
});
