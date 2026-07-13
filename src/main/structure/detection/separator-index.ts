import type { StructureStoryRangeBoundaryEvidence } from '../../../shared/domain';
import { createMarkdownSyntaxIndex } from './markdown-syntax-index';

export type StructureSeparatorIndex = {
  readonly findWithin: (startOffset: number, endOffset: number) => StructureStoryRangeBoundaryEvidence[];
};

export function createStructureSeparatorIndex(sourceText: string): StructureSeparatorIndex {
  const separators = createMarkdownSyntaxIndex(sourceText).horizontalRules
    .map((span) => ({
      kind: 'explicit_separator' as const,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
    }));

  return {
    findWithin(startOffset, endOffset) {
      const firstIndex = lowerBound(separators, startOffset);
      const evidence: StructureStoryRangeBoundaryEvidence[] = [];

      for (let index = firstIndex; index < separators.length; index += 1) {
        const separator = separators[index];

        if (separator.startOffset >= endOffset) {
          break;
        }

        evidence.push(separator);
      }

      return evidence;
    },
  };
}

function lowerBound(
  separators: readonly StructureStoryRangeBoundaryEvidence[],
  startOffset: number,
): number {
  let lower = 0;
  let upper = separators.length;

  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);

    if (separators[middle].startOffset < startOffset) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return lower;
}
