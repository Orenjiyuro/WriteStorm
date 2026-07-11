export function createStructureHeadingMatchView(rawHeadingText: string): string {
  return rawHeadingText.normalize('NFKC');
}
