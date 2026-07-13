import { scanStructureSourceLines, type StructureSourceLine } from './line-scanner';

export type MarkdownSyntaxSpan = {
  readonly startOffset: number;
  readonly endOffset: number;
};

export type MarkdownSyntaxIndex = {
  readonly lines: readonly StructureSourceLine[];
  readonly setextUnderlines: readonly MarkdownSyntaxSpan[];
  readonly horizontalRules: readonly MarkdownSyntaxSpan[];
  readonly blankLineClusters: readonly MarkdownSyntaxSpan[];
  readonly isCodeLine: (startOffset: number) => boolean;
  readonly isSetextUnderline: (startOffset: number) => boolean;
};

type MarkdownFence = {
  readonly marker: '`' | '~';
  readonly length: number;
};

export function createMarkdownSyntaxIndex(sourceText: string): MarkdownSyntaxIndex {
  const lines = scanStructureSourceLines(sourceText);
  const codeLineStarts = findCodeLineStarts(lines);
  const setextUnderlines = findSetextUnderlines(lines, codeLineStarts);
  const setextUnderlineStarts = new Set(setextUnderlines.map((span) => span.startOffset));

  return {
    lines,
    setextUnderlines,
    horizontalRules: lines
      .filter((line) =>
        !codeLineStarts.has(line.startOffset) &&
        !setextUnderlineStarts.has(line.startOffset) &&
        isHorizontalRule(line.rawText),
      )
      .map(toSpan),
    blankLineClusters: findBlankLineClusters(lines, codeLineStarts),
    isCodeLine: (startOffset) => codeLineStarts.has(startOffset),
    isSetextUnderline: (startOffset) => setextUnderlineStarts.has(startOffset),
  };
}

function findCodeLineStarts(lines: readonly StructureSourceLine[]): Set<number> {
  const codeLineStarts = new Set<number>();
  let activeFence: MarkdownFence | null = null;

  for (const line of lines) {
    const fence = readMarkdownFence(line.rawText);

    if (activeFence) {
      codeLineStarts.add(line.startOffset);
      if (fence && fence.marker === activeFence.marker && fence.length >= activeFence.length &&
        hasOnlyFenceWhitespace(line.rawText, fence)) {
        activeFence = null;
      }
      continue;
    }

    if (fence) {
      codeLineStarts.add(line.startOffset);
      activeFence = fence;
    }
  }

  return codeLineStarts;
}

function findSetextUnderlines(
  lines: readonly StructureSourceLine[],
  codeLineStarts: ReadonlySet<number>,
): MarkdownSyntaxSpan[] {
  const spans: MarkdownSyntaxSpan[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];

    if (codeLineStarts.has(previous.startOffset) || codeLineStarts.has(current.startOffset)) {
      continue;
    }

    if (previous.rawText.trim().length > 0 && isSetextUnderline(current.rawText)) {
      spans.push(toSpan(current));
    }
  }

  return spans;
}

function findBlankLineClusters(
  lines: readonly StructureSourceLine[],
  codeLineStarts: ReadonlySet<number>,
): MarkdownSyntaxSpan[] {
  const clusters: MarkdownSyntaxSpan[] = [];
  let clusterStart: StructureSourceLine | null = null;
  let clusterEnd: StructureSourceLine | null = null;

  for (const line of lines) {
    const isBlankVisibleLine = !codeLineStarts.has(line.startOffset) && line.rawText.trim().length === 0;

    if (isBlankVisibleLine) {
      clusterStart ??= line;
      clusterEnd = line;
      continue;
    }

    if (clusterStart && clusterEnd && clusterEnd !== clusterStart) {
      clusters.push({ startOffset: clusterStart.startOffset, endOffset: clusterEnd.nextOffset });
    }

    clusterStart = null;
    clusterEnd = null;
  }

  if (clusterStart && clusterEnd && clusterEnd !== clusterStart) {
    clusters.push({ startOffset: clusterStart.startOffset, endOffset: clusterEnd.nextOffset });
  }

  return clusters;
}

function toSpan(line: StructureSourceLine): MarkdownSyntaxSpan {
  return { startOffset: line.startOffset, endOffset: line.endOffset };
}

function isSetextUnderline(rawLine: string): boolean {
  return /^\s*(?:={3,}|-{3,})\s*$/.test(rawLine);
}

function isHorizontalRule(rawLine: string): boolean {
  return /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(rawLine);
}

function readMarkdownFence(rawLine: string): MarkdownFence | null {
  const match = rawLine.match(/^\s*(`{3,}|~{3,})/);

  return match
    ? { marker: match[1][0] as MarkdownFence['marker'], length: match[1].length }
    : null;
}

function hasOnlyFenceWhitespace(rawLine: string, fence: MarkdownFence): boolean {
  return rawLine.trimStart().slice(fence.length).trim().length === 0;
}
