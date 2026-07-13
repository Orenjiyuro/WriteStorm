export type StructureSourceLine = {
  readonly rawText: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly nextOffset: number;
  readonly lineEnding: '' | '\n' | '\r' | '\r\n';
};

export function scanStructureSourceLines(sourceText: string): StructureSourceLine[] {
  const lines: StructureSourceLine[] = [];
  let startOffset = 0;

  while (startOffset < sourceText.length) {
    const lineBreakOffset = findLineBreakOffset(sourceText, startOffset);

    if (lineBreakOffset === -1) {
      lines.push({
        rawText: sourceText.slice(startOffset),
        startOffset,
        endOffset: sourceText.length,
        nextOffset: sourceText.length,
        lineEnding: '',
      });
      break;
    }

    const lineEnding = readLineEnding(sourceText, lineBreakOffset);
    const nextOffset = lineBreakOffset + lineEnding.length;
    lines.push({
      rawText: sourceText.slice(startOffset, lineBreakOffset),
      startOffset,
      endOffset: lineBreakOffset,
      nextOffset,
      lineEnding,
    });
    startOffset = nextOffset;
  }

  return lines;
}

function findLineBreakOffset(sourceText: string, startOffset: number): number {
  for (let offset = startOffset; offset < sourceText.length; offset += 1) {
    const codeUnit = sourceText.charCodeAt(offset);

    if (codeUnit === 0x0a || codeUnit === 0x0d) {
      return offset;
    }
  }

  return -1;
}

function readLineEnding(
  sourceText: string,
  lineBreakOffset: number,
): StructureSourceLine['lineEnding'] {
  if (sourceText.charCodeAt(lineBreakOffset) === 0x0d &&
    sourceText.charCodeAt(lineBreakOffset + 1) === 0x0a) {
    return '\r\n';
  }

  return sourceText.charCodeAt(lineBreakOffset) === 0x0d ? '\r' : '\n';
}
