import { describe, expect, it } from 'vitest';
import type { StructureNodeId, StructureSetNodeDto } from '../../src/shared/domain';
import { buildStructureNodes } from '../../src/main/structure/detection/structure-tree-builder';

describe('structure tree builder', () => {
  it('assigns volume parents, node coverage and continuity confidence from scanned headings', () => {
    const root = bookRoot('Example', 42);
    const nodes = buildStructureNodes({
      root,
      sourceTextLength: 42,
      idFactory: deterministicIdFactory(),
      headings: [
        heading('volume', 'Part 1', 1, 0, 6),
        heading('chapter', 'Chapter 1', 1, 7, 16),
        heading('chapter', 'Chapter 1 again', 1, 17, 32),
      ],
    });

    expect(nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      startOffset: node.startOffset,
      endOffset: node.endOffset,
      confidence: node.confidence,
    }))).toEqual([
      { id: 'root', parentId: null, startOffset: 0, endOffset: 42, confidence: root.confidence },
      expect.objectContaining({ id: 'volume:1', parentId: 'root', startOffset: 0, endOffset: 42 }),
      expect.objectContaining({ id: 'chapter:2', parentId: 'volume:1', startOffset: 7, endOffset: 17 }),
      expect.objectContaining({
        id: 'chapter:3',
        parentId: 'volume:1',
        startOffset: 17,
        endOffset: 42,
        confidence: { score: 0.4, level: 'low', lowConfidenceResolution: 'unresolved' },
      }),
    ]);
  });
});

function heading(
  kind: 'volume' | 'chapter',
  title: string,
  number: number,
  startOffset: number,
  headingEndOffset: number,
) {
  return { kind, title, number, baseScore: 0.9, startOffset, headingEndOffset, rawHeadingText: title };
}

function bookRoot(title: string, endOffset: number): StructureSetNodeDto {
  return {
    id: 'root' as StructureNodeId,
    originId: null,
    kind: 'book',
    title,
    parentId: null,
    order: 0,
    startOffset: 0,
    endOffset,
    heading: null,
    confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
  };
}

function deterministicIdFactory() {
  let index = 0;

  return {
    createStructureNodeId: (kind: 'book' | 'volume' | 'chapter') =>
      `${kind}:${++index}` as StructureNodeId,
    createStorySegmentRangeId: () => 'unused' as never,
  };
}
