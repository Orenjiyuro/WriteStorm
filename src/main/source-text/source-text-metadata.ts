import path from 'node:path';
import type { SourceTextFormat, SourceTextMetadata } from '../../shared/contracts';
import type { BreakdownBookId, SourceTextId } from '../../shared/domain';

export type SourceTextsInsertRow = {
  readonly id: string;
  readonly book_id: string;
  readonly format: SourceTextFormat;
  readonly content_hash: string;
  readonly encoding: string;
  readonly source_edition: number;
  readonly relative_path: string;
  readonly imported_at: string;
  readonly original_file_name: string;
  readonly size_bytes: number;
};

export type SourceTextImportMetadataInput = {
  readonly sourceTextId: SourceTextId;
  readonly bookId: BreakdownBookId;
  readonly originalFileName: string;
  readonly format: SourceTextFormat;
  readonly sizeBytes: number;
  readonly encoding: string;
  readonly contentHash: string;
  readonly relativePath: string;
  readonly importedAt: string;
  readonly sourceTextEdition?: number;
};

export type SourceTextImportMetadata = {
  readonly dto: SourceTextMetadata;
  readonly row: SourceTextsInsertRow;
};

export function buildSourceTextImportMetadata(
  input: SourceTextImportMetadataInput,
): SourceTextImportMetadata {
  const fileName = normalizeOriginalFileName(input.originalFileName);
  const sourceTextEdition = input.sourceTextEdition ?? 1;

  assertPositiveInteger(input.sizeBytes, 'Source text size bytes');
  assertPositiveInteger(sourceTextEdition, 'Source text edition');
  assertNonEmpty(input.encoding, 'Source text encoding');
  assertNonEmpty(input.contentHash, 'Source text content hash');
  assertNonEmpty(input.relativePath, 'Source text relative path');
  assertNonEmpty(input.importedAt, 'Source text import time');

  const dto: SourceTextMetadata = {
    id: input.sourceTextId,
    bookId: input.bookId,
    fileName,
    format: input.format,
    sizeBytes: input.sizeBytes,
    encoding: input.encoding,
    contentHash: input.contentHash,
    sourceTextEdition,
    importedAt: input.importedAt,
  };

  return {
    dto,
    row: {
      id: input.sourceTextId,
      book_id: input.bookId,
      format: input.format,
      content_hash: input.contentHash,
      encoding: input.encoding,
      source_edition: sourceTextEdition,
      relative_path: input.relativePath,
      imported_at: input.importedAt,
      original_file_name: fileName,
      size_bytes: input.sizeBytes,
    },
  };
}

function normalizeOriginalFileName(originalFileName: string): string {
  const fileName = path.basename(originalFileName).trim();

  if (!fileName) {
    throw new Error('Source text original file name is required.');
  }

  return fileName;
}

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}
