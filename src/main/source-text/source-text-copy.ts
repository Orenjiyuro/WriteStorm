import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { SourceTextId } from '../../shared/domain';
import { resolveLibraryRelativePath } from '../library/path-guard';
import { buildCanonicalSourceTextRelativePath } from './source-text-metadata';

export type SourceTextCopyFailureReason =
  | 'target_conflict'
  | 'copy_failed';

export type SourceTextCopySuccess = {
  readonly ok: true;
  readonly relativePath: string;
  readonly targetPath: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
};

export type SourceTextCopyFailure = {
  readonly ok: false;
  readonly reason: SourceTextCopyFailureReason;
  readonly message: string;
  readonly relativePath?: string;
};

export type SourceTextCopyResult =
  | SourceTextCopySuccess
  | SourceTextCopyFailure;

export type SourceTextCopyFileSystem = {
  readonly readFileSync: (sourcePath: string) => Buffer;
  readonly mkdirSync: (targetPath: string, options: { readonly recursive: true }) => void;
  readonly writeFileSync: (targetPath: string, data: Buffer, options: { readonly flag: 'wx' }) => void;
  readonly linkSync: (oldPath: string, newPath: string) => void;
  readonly rmSync: (targetPath: string, options: { readonly force: true }) => void;
  readonly existsSync: (targetPath: string) => boolean;
};

export type CopySourceTextToLibrarySourceInput = {
  readonly libraryRootPath: string;
  readonly sourcePath: string;
  readonly sourceBytes?: Buffer;
  readonly sourceTextId: SourceTextId;
  readonly originalFileName: string;
  readonly createTempFileName?: () => string;
  readonly fileSystem?: SourceTextCopyFileSystem;
};

const defaultFileSystem: SourceTextCopyFileSystem = {
  readFileSync,
  mkdirSync,
  writeFileSync: (targetPath, data, options) => writeFileSync(targetPath, data, options),
  linkSync,
  rmSync,
  existsSync,
};

export function copySourceTextToLibrarySource(
  input: CopySourceTextToLibrarySourceInput,
): SourceTextCopyResult {
  const fileSystem = input.fileSystem ?? defaultFileSystem;
  const safeFileName = safeOriginalFileName(input.originalFileName);
  const relativePath = buildCanonicalSourceTextRelativePath(input.sourceTextId, safeFileName);
  const targetPath = resolveLibraryRelativePath(input.libraryRootPath, relativePath);
  const targetDirectory = path.dirname(targetPath);
  const tempPath = path.join(targetDirectory, input.createTempFileName?.() ?? `.writestorm-copy-${randomUUID()}.tmp`);

  if (fileSystem.existsSync(targetPath)) {
    return {
      ok: false,
      reason: 'target_conflict',
      message: 'Copied source target already exists.',
      relativePath,
    };
  }

  try {
    const bytes = input.sourceBytes ?? fileSystem.readFileSync(input.sourcePath);

    fileSystem.mkdirSync(targetDirectory, { recursive: true });
    fileSystem.writeFileSync(tempPath, bytes, { flag: 'wx' });
    fileSystem.linkSync(tempPath, targetPath);
    cleanupTempFile(fileSystem, tempPath);

    return {
      ok: true,
      relativePath,
      targetPath,
      sizeBytes: bytes.byteLength,
      contentHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    };
  } catch (error) {
    fileSystem.rmSync(tempPath, { force: true });

    if (isFileAlreadyExistsError(error)) {
      return {
        ok: false,
        reason: 'target_conflict',
        message: 'Copied source target already exists.',
        relativePath,
      };
    }

    return {
      ok: false,
      reason: 'copy_failed',
      message: 'Source file could not be copied into the library.',
    };
  }
}

function cleanupTempFile(fileSystem: SourceTextCopyFileSystem, tempPath: string): void {
  try {
    fileSystem.rmSync(tempPath, { force: true });
  } catch {
    // The final copied source is already linked into place; a stale staging file
    // should not turn a successful non-overwriting copy into a failed import.
  }
}

function isFileAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

function safeOriginalFileName(originalFileName: string): string {
  const fileName = path.basename(originalFileName).trim();

  return fileName.length > 0 ? fileName : 'source.txt';
}
