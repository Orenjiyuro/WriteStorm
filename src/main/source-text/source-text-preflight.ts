import {
  accessSync,
  closeSync,
  constants,
  fstatSync,
  openSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import {
  readSourceTextBytesFromDescriptor,
  type SourceTextBytesReadResult,
} from './source-text-bytes';

export const MAX_IMPORT_SOURCE_SIZE_BYTES = 20 * 1024 * 1024;

export type SourceTextPreflightFormat = 'txt' | 'md';

export type SourceTextPreflightFailureReason =
  | 'invalid_extension'
  | 'file_too_large'
  | 'empty_file'
  | 'not_readable';

export type SourceTextPreflightSuccess = {
  readonly ok: true;
  readonly filePath: string;
  readonly originalFileName: string;
  readonly format: SourceTextPreflightFormat;
  readonly sizeBytes: number;
  readonly bytes?: Buffer;
};

export type SourceTextPreflightFailure = {
  readonly ok: false;
  readonly reason: SourceTextPreflightFailureReason;
  readonly message: string;
  readonly details?: {
    readonly maxSizeBytes?: number;
    readonly sizeBytes?: number;
  };
};

export type SourceTextPreflightResult =
  | SourceTextPreflightSuccess
  | SourceTextPreflightFailure;

export type SourceTextPreflightFileSystem = {
  readonly accessSync: (filePath: string) => void;
  readonly statSync: (filePath: string) => {
    readonly isFile: () => boolean;
    readonly size: number;
  };
};

export type SourceTextPreflightOptions = {
  readonly fileSystem?: SourceTextPreflightFileSystem;
  readonly maxSizeBytes?: number;
};

const defaultFileSystem: SourceTextPreflightFileSystem = {
  accessSync: (filePath) => accessSync(filePath, constants.R_OK),
  statSync,
};

export function preflightSourceTextFile(
  filePath: string,
  options: SourceTextPreflightOptions = {},
): SourceTextPreflightResult {
  const format = sourceTextFormatFromPath(filePath);

  if (!format) {
    return {
      ok: false,
      reason: 'invalid_extension',
      message: 'Only .txt and .md source files can be imported.',
    };
  }

  const maxSizeBytes = options.maxSizeBytes ?? MAX_IMPORT_SOURCE_SIZE_BYTES;

  if (!options.fileSystem) {
    return preflightFromFileDescriptor(filePath, format, maxSizeBytes);
  }

  const fileSystem = options.fileSystem;

  let stats: ReturnType<SourceTextPreflightFileSystem['statSync']>;
  try {
    fileSystem.accessSync(filePath);
    stats = fileSystem.statSync(filePath);
  } catch {
    return notReadableFailure();
  }

  if (!stats.isFile()) {
    return notReadableFailure();
  }

  if (stats.size > maxSizeBytes) {
    return {
      ok: false,
      reason: 'file_too_large',
      message: 'Source file exceeds the 20 MiB import limit.',
      details: {
        maxSizeBytes,
        sizeBytes: stats.size,
      },
    };
  }

  if (stats.size === 0) {
    return {
      ok: false,
      reason: 'empty_file',
      message: 'Source file is empty.',
    };
  }

  return {
    ok: true,
    filePath,
    originalFileName: path.basename(filePath),
    format,
    sizeBytes: stats.size,
  };
}

function preflightFromFileDescriptor(
  filePath: string,
  format: SourceTextPreflightFormat,
  maxSizeBytes: number,
): SourceTextPreflightResult {
  let fileDescriptor: number | undefined;

  try {
    fileDescriptor = openSync(filePath, 'r');
    const stats = fstatSync(fileDescriptor);

    if (!stats.isFile()) {
      return notReadableFailure();
    }

    if (stats.size > maxSizeBytes) {
      return {
        ok: false,
        reason: 'file_too_large',
        message: 'Source file exceeds the 20 MiB import limit.',
        details: {
          maxSizeBytes,
          sizeBytes: stats.size,
        },
      };
    }

    if (stats.size === 0) {
      return {
        ok: false,
        reason: 'empty_file',
        message: 'Source file is empty.',
      };
    }

    const bytesResult = readSourceTextBytesFromDescriptor(fileDescriptor, { maxSizeBytes });
    if (!bytesResult.ok) {
      return sourceBytesFailure(bytesResult);
    }

    return {
      ok: true,
      filePath,
      originalFileName: path.basename(filePath),
      format,
      sizeBytes: bytesResult.bytes.byteLength,
      bytes: bytesResult.bytes,
    };
  } catch {
    return notReadableFailure();
  } finally {
    if (fileDescriptor !== undefined) {
      closeSync(fileDescriptor);
    }
  }
}

function sourceBytesFailure(result: Exclude<SourceTextBytesReadResult, { readonly ok: true }>): SourceTextPreflightFailure {
  return {
    ok: false,
    reason: result.reason,
    message: result.message,
    details: {
      ...(result.maxSizeBytes === undefined ? {} : { maxSizeBytes: result.maxSizeBytes }),
      ...(result.sizeBytes === undefined ? {} : { sizeBytes: result.sizeBytes }),
    },
  };
}

function sourceTextFormatFromPath(filePath: string): SourceTextPreflightFormat | null {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.txt') {
    return 'txt';
  }

  if (extension === '.md') {
    return 'md';
  }

  return null;
}

function notReadableFailure(): SourceTextPreflightFailure {
  return {
    ok: false,
    reason: 'not_readable',
    message: 'Source file cannot be read.',
  };
}
