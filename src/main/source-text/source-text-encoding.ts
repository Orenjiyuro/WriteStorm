import { TextDecoder } from 'node:util';

export const SOURCE_TEXT_MANUAL_ENCODINGS = ['gb18030'] as const;

export type SourceTextEncoding = 'utf-8' | 'gb18030';

export type SourceTextDecodeSuccess = {
  readonly ok: true;
  readonly encoding: SourceTextEncoding;
  readonly text: string;
  readonly hadBom: boolean;
};

export type SourceTextDecodeFailure = {
  readonly ok: false;
  readonly reason: 'encoding_required';
  readonly message: string;
  readonly supportedEncodings: typeof SOURCE_TEXT_MANUAL_ENCODINGS;
};

export type SourceTextDecodeResult =
  | SourceTextDecodeSuccess
  | SourceTextDecodeFailure;

export type DecodeSourceTextBytesOptions = {
  readonly encodingOverride?: SourceTextEncoding;
};

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

export function decodeSourceTextBytes(
  bytes: Uint8Array,
  options: DecodeSourceTextBytesOptions = {},
): SourceTextDecodeResult {
  const encoding = options.encodingOverride ?? 'utf-8';

  try {
    const text = decodeBytes(bytes, encoding);

    return {
      ok: true,
      encoding,
      text: stripLeadingBom(text),
      hadBom: hasUtf8Bom(bytes),
    };
  } catch {
    return {
      ok: false,
      reason: 'encoding_required',
      message: options.encodingOverride
        ? `Source file could not be decoded with ${encoding}. Choose another encoding to continue.`
        : 'Source file encoding could not be confirmed as UTF-8. Choose an encoding to continue.',
      supportedEncodings: SOURCE_TEXT_MANUAL_ENCODINGS,
    };
  }
}

function decodeBytes(bytes: Uint8Array, encoding: SourceTextEncoding): string {
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= UTF8_BOM.length &&
    bytes[0] === UTF8_BOM[0] &&
    bytes[1] === UTF8_BOM[1] &&
    bytes[2] === UTF8_BOM[2];
}

function stripLeadingBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }

  return text;
}
