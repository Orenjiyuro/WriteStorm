import type { StructureStoryRangeBoundaryEvidence } from '../../../shared/domain';
import { createStructureHeadingMatchView } from './heading-patterns';
import { createMarkdownSyntaxIndex } from './markdown-syntax-index';

export type StoryBoundarySignal = StructureStoryRangeBoundaryEvidence & {
  readonly kind:
    | 'explicit_separator'
    | 'blank_line_cluster'
    | 'markdown_subheading'
    | 'transition_hint';
};

export type StoryBoundarySignalIndex = {
  readonly hardSignals: readonly StoryBoundarySignal[];
  readonly transitionHints: readonly StoryBoundarySignal[];
};

export function createStoryBoundarySignalIndex(
  sourceText: string,
  chapterStartOffsets: ReadonlySet<number>,
): StoryBoundarySignalIndex {
  const markdown = createMarkdownSyntaxIndex(sourceText);
  const hardSignals: StoryBoundarySignal[] = [
    ...markdown.horizontalRules.map((span) => ({ kind: 'explicit_separator' as const, ...span })),
    ...markdown.blankLineClusters.map((span) => ({ kind: 'blank_line_cluster' as const, ...span })),
  ];
  const transitionHints: StoryBoundarySignal[] = [];

  for (let lineIndex = 0; lineIndex < markdown.lines.length; lineIndex += 1) {
    const line = markdown.lines[lineIndex];

    if (markdown.isCodeLine(line.startOffset) || markdown.isSetextUnderline(line.startOffset)) {
      continue;
    }

    if (!chapterStartOffsets.has(line.startOffset) && isMarkdownSubheading(markdown, lineIndex)) {
      hardSignals.push({
        kind: 'markdown_subheading',
        startOffset: line.startOffset,
        endOffset: line.endOffset,
      });
    }

    const leadingWhitespaceLength = line.rawText.length - line.rawText.trimStart().length;
    const visibleText = line.rawText.trimStart();

    if (isParagraphLeadingTransitionHint(visibleText)) {
      transitionHints.push({
        kind: 'transition_hint',
        startOffset: line.startOffset + leadingWhitespaceLength,
        endOffset: line.endOffset,
      });
    }
  }

  return {
    hardSignals: hardSignals.sort(compareSignals),
    transitionHints: transitionHints.sort(compareSignals),
  };
}

function isMarkdownSubheading(
  markdown: ReturnType<typeof createMarkdownSyntaxIndex>,
  lineIndex: number,
): boolean {
  const line = markdown.lines[lineIndex];
  const matchView = createStructureHeadingMatchView(line.rawText.trim());

  if (/^#{1,6}\s+\S/u.test(matchView)) {
    return true;
  }

  const nextLine = markdown.lines[lineIndex + 1];
  return nextLine !== undefined && markdown.isSetextUnderline(nextLine.startOffset);
}

function isParagraphLeadingTransitionHint(text: string): boolean {
  return /^(?:然而|但是|与此同时|后来|此时|一方で|しかし|その後)(?:[，、。！？\s]|$)/u.test(text) ||
    /^(?:however|meanwhile|later|that night|on the other hand)(?:[\s,.:;!?-]|$)/i.test(text);
}

function compareSignals(left: StoryBoundarySignal, right: StoryBoundarySignal): number {
  return left.startOffset - right.startOffset || signalPriority(left) - signalPriority(right);
}

export function signalPriority(signal: StoryBoundarySignal): number {
  if (signal.kind === 'explicit_separator') {
    return 0;
  }

  if (signal.kind === 'markdown_subheading') {
    return 1;
  }

  if (signal.kind === 'blank_line_cluster') {
    return 2;
  }

  return 3;
}
