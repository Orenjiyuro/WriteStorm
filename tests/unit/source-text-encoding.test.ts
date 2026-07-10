import { describe, expect, it } from 'vitest';
import {
  decodeSourceTextBytes,
  SOURCE_TEXT_MANUAL_ENCODINGS,
} from '../../src/main/source-text/source-text-encoding';

describe('source text import encoding', () => {
  it('automatically decodes UTF-8 and UTF-8 BOM source bytes', () => {
    expect(decodeSourceTextBytes(Buffer.from('Chapter 1\nこんにちは', 'utf8'))).toEqual({
      ok: true,
      encoding: 'utf-8',
      text: 'Chapter 1\nこんにちは',
      hadBom: false,
    });
    expect(decodeSourceTextBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x20, 0x54, 0x69, 0x74, 0x6c, 0x65]))).toEqual({
      ok: true,
      encoding: 'utf-8',
      text: '# Title',
      hadBom: true,
    });
  });

  it('does not silently auto-detect GB18030 bytes without a manual override', () => {
    const gb18030Bytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

    expect(decodeSourceTextBytes(gb18030Bytes)).toEqual({
      ok: false,
      reason: 'encoding_required',
      message: 'Source file encoding could not be confirmed as UTF-8. Choose an encoding to continue.',
      supportedEncodings: SOURCE_TEXT_MANUAL_ENCODINGS,
    });
  });

  it('decodes GB18030 only through the manual retry override path', () => {
    const gb18030Bytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

    expect(decodeSourceTextBytes(gb18030Bytes, {
      encodingOverride: 'gb18030',
    })).toEqual({
      ok: true,
      encoding: 'gb18030',
      text: '中文',
      hadBom: false,
    });
  });

  it('returns an actionable encoding choice state when a manual override cannot decode', () => {
    expect(decodeSourceTextBytes(Buffer.from([0xff, 0xff]), {
      encodingOverride: 'utf-8',
    })).toEqual({
      ok: false,
      reason: 'encoding_required',
      message: 'Source file could not be decoded with utf-8. Choose another encoding to continue.',
      supportedEncodings: SOURCE_TEXT_MANUAL_ENCODINGS,
    });
  });
});
