import type { StructureNodeKind } from '../../../shared/domain/status';
import { createStructureHeadingMatchView } from './heading-patterns';
import { parseStructureHeadingNumber } from './structure-heading-number-parser';

export type ClassifiedStructureHeading = {
  readonly kind: Extract<StructureNodeKind, 'volume' | 'chapter'>;
  readonly title: string;
  readonly number: number | null;
  readonly baseScore: number;
};

export function classifyStructureHeading(
  rawLine: string,
  isSetext: boolean,
): ClassifiedStructureHeading | null {
  const { rawTitle, matchTitle, isMarkdown } = readHeadingContents(rawLine, isSetext);
  const chineseOrJapanese = matchTitle.match(
    /^第\s*([0-9]+|[〇零一二三四五六七八九十百千]+)\s*(卷|篇|部|章|节|話)\s*(.*)$/u,
  );

  if (chineseOrJapanese) {
    const kind = ['卷', '篇', '部'].includes(chineseOrJapanese[2]) ? 'volume' : 'chapter';
    return {
      kind,
      title: rawTitle,
      number: parseStructureHeadingNumber(chineseOrJapanese[1]),
      baseScore: isMarkdown ? 0.95 : 0.9,
    };
  }

  const english = matchTitle.match(
    /^(chapter|ch\.?|part|book|volume)\s+([0-9]+|[ivxlcdm]+)(?:\b|[.:：\-\s]).*$/iu,
  );

  if (!english) {
    return null;
  }

  const kind = ['part', 'book', 'volume'].includes(english[1].toLowerCase())
    ? 'volume'
    : 'chapter';
  return {
    kind,
    title: rawTitle,
    number: parseStructureHeadingNumber(english[2]),
    baseScore: isMarkdown ? 0.95 : 0.9,
  };
}

function readHeadingContents(rawLine: string, isSetext: boolean): {
  readonly rawTitle: string;
  readonly matchTitle: string;
  readonly isMarkdown: boolean;
} {
  const trimmed = rawLine.trim();
  const atx = trimmed.match(/^(?:#|＃){1,6}\s+(.+?)\s*(?:#|＃)*\s*$/u);
  const rawTitle = atx?.[1].trim() ?? trimmed;

  return {
    rawTitle,
    matchTitle: createStructureHeadingMatchView(rawTitle).trim(),
    isMarkdown: atx !== null || isSetext,
  };
}
