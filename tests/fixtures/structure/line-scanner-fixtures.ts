export const LINE_SCANNER_FIXTURES = {
  decodedMixedNewlines: [
    '第１章　始まり\r\n',
    '# 第二章：🌕月光\n',
    '## Chapter 3 - English\r\n',
    '```markdown\n',
    '# faux heading inside a fence\r\n',
    '```\n',
    'プロローグ',
  ].join(''),
  utf8BomPrefixed: '\uFEFF第１章　始まり\r\n',
  fullWidthMarkdownHeading: '＃　Ｃｈａｐｔｅｒ　１　：　開始',
} as const;
