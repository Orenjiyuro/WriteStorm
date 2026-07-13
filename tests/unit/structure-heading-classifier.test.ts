import { describe, expect, it } from 'vitest';
import { classifyStructureHeading } from '../../src/main/structure/detection/structure-heading-classifier';

describe('structure heading classifier', () => {
  it('classifies full-width Markdown Chinese and English headings while retaining their raw titles', () => {
    expect(classifyStructureHeading('＃　Ｃｈａｐｔｅｒ　１　：　開始', false)).toEqual({
      kind: 'chapter',
      title: 'Ｃｈａｐｔｅｒ　１　：　開始',
      number: 1,
      baseScore: 0.95,
    });
    expect(classifyStructureHeading('第１話　始まり', true)).toEqual({
      kind: 'chapter',
      title: '第１話　始まり',
      number: 1,
      baseScore: 0.95,
    });
  });
});
