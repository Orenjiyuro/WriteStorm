import type { StructureNodeKind } from '../../../shared/domain/status';
import {
  classifyStructureHeading,
  type ClassifiedStructureHeading,
} from './structure-heading-classifier';
import { createMarkdownSyntaxIndex } from './markdown-syntax-index';

export type ScannedStructureHeading = ClassifiedStructureHeading & {
  readonly kind: Extract<StructureNodeKind, 'volume' | 'chapter'>;
  readonly startOffset: number;
  readonly headingEndOffset: number;
  readonly rawHeadingText: string;
};

export function scanStructureHeadings(sourceText: string): ScannedStructureHeading[] {
  const markdownSyntax = createMarkdownSyntaxIndex(sourceText);
  const headings: ScannedStructureHeading[] = [];
  const { lines } = markdownSyntax;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (markdownSyntax.isCodeLine(line.startOffset) || markdownSyntax.isSetextUnderline(line.startOffset)) {
      continue;
    }

    const nextLine = lines[lineIndex + 1];
    const isSetext = nextLine !== undefined && markdownSyntax.isSetextUnderline(nextLine.startOffset);
    const classified = classifyStructureHeading(line.rawText, isSetext);

    if (!classified) {
      continue;
    }

    headings.push({
      ...classified,
      startOffset: line.startOffset,
      headingEndOffset: line.endOffset,
      rawHeadingText: line.rawText,
    });

    if (isSetext) {
      lineIndex += 1;
    }
  }

  return headings;
}
