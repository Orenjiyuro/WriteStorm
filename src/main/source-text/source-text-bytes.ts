import { closeSync, openSync, readSync } from 'node:fs';

export type SourceTextBytesReadResult =
  | {
    readonly ok: true;
    readonly bytes: Buffer;
  }
  | {
    readonly ok: false;
    readonly reason: 'file_too_large' | 'empty_file' | 'not_readable';
    readonly message: string;
    readonly sizeBytes?: number;
    readonly maxSizeBytes?: number;
  };

export function readSourceTextBytes(
  filePath: string,
  options: { readonly maxSizeBytes: number },
): SourceTextBytesReadResult {
  const maxSizeBytes = options.maxSizeBytes;
  let fileDescriptor: number | undefined;

  try {
    fileDescriptor = openSync(filePath, 'r');
    return readSourceTextBytesFromDescriptor(fileDescriptor, { maxSizeBytes });
  } catch {
    return {
      ok: false,
      reason: 'not_readable',
      message: 'Source file cannot be read.',
    };
  } finally {
    if (fileDescriptor !== undefined) {
      closeSync(fileDescriptor);
    }
  }
}

export function readSourceTextBytesFromDescriptor(
  fileDescriptor: number,
  options: { readonly maxSizeBytes: number },
): SourceTextBytesReadResult {
  const maxSizeBytes = options.maxSizeBytes;
  const buffer = Buffer.alloc(maxSizeBytes + 1);
  let offset = 0;

  while (offset < buffer.length) {
    const bytesRead = readSync(fileDescriptor, buffer, offset, buffer.length - offset, null);

    if (bytesRead === 0) {
      break;
    }

    offset += bytesRead;
  }

  if (offset > maxSizeBytes) {
    return {
      ok: false,
      reason: 'file_too_large',
      message: 'Source file exceeds the 20 MiB import limit.',
      sizeBytes: offset,
      maxSizeBytes,
    };
  }

  if (offset === 0) {
    return {
      ok: false,
      reason: 'empty_file',
      message: 'Source file is empty.',
    };
  }

  return {
    ok: true,
    bytes: buffer.subarray(0, offset),
  };
}
