import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolveLibraryRelativePath } from '../library/path-guard';
import { decodeSourceTextBytes, type SourceTextEncoding } from '../source-text/source-text-encoding';
import type { SourceTextService } from '../source-text/source-text-service';
import type { BookService } from '../books/book-service';
import type {
  BreakdownBookId,
  SourceTextId,
  StructureSourceSnapshot,
} from '../../shared/domain';

export type StructureSourceSnapshotErrorReason =
  | 'book_not_found'
  | 'source_missing'
  | 'source_encoding_invalid'
  | 'source_read_failed'
  | 'source_decode_failed'
  | 'source_hash_mismatch';

export class StructureSourceSnapshotError extends Error {
  constructor(
    readonly reason: StructureSourceSnapshotErrorReason,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'StructureSourceSnapshotError';
  }
}

export type LoadedStructureSourceSnapshot = {
  readonly bookTitle: string;
  readonly sourceText: string;
  readonly snapshot: StructureSourceSnapshot;
};

export async function loadCurrentStructureSourceSnapshot(
  services: {
    readonly books: BookService;
    readonly sourceTexts: SourceTextService;
  },
  bookId: BreakdownBookId,
): Promise<LoadedStructureSourceSnapshot> {
  const book = services.books.get(bookId);
  if (!book) {
    throw new StructureSourceSnapshotError('book_not_found', 'Book was not found in the current library.');
  }
  const current = services.sourceTexts.getCurrentSourceFile(bookId);
  if (!current) {
    throw new StructureSourceSnapshotError('source_missing', 'Book does not have a current imported source.');
  }

  const row = current.source;

  if (!isSourceTextEncoding(row.encoding)) {
    throw new StructureSourceSnapshotError(
      'source_encoding_invalid',
      `Imported source encoding ${row.encoding} is not supported.`,
    );
  }

  let bytes: Buffer;
  try {
    const sourcePath = resolveLibraryRelativePath(current.libraryRootPath, row.relativePath);
    bytes = await readFile(sourcePath);
  } catch (error) {
    throw new StructureSourceSnapshotError(
      'source_read_failed',
      'Current imported source could not be read from the library.',
      { cause: error },
    );
  }

  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (contentHash !== row.contentHash) {
    throw new StructureSourceSnapshotError(
      'source_hash_mismatch',
      'Current imported source no longer matches its recorded content hash.',
    );
  }

  const decoded = decodeSourceTextBytes(bytes, { encodingOverride: row.encoding });
  if (!decoded.ok) {
    throw new StructureSourceSnapshotError(
      'source_decode_failed',
      'Current imported source could not be decoded with its recorded encoding.',
    );
  }

  return {
    bookTitle: book.title,
    sourceText: decoded.text,
    snapshot: {
      sourceTextId: row.id as SourceTextId,
      sourceTextEdition: row.sourceTextEdition,
      contentHash: row.contentHash,
      decodedTextLength: decoded.text.length,
      offsetUnit: 'utf16_code_unit',
    },
  };
}

function isSourceTextEncoding(value: string): value is SourceTextEncoding {
  return value === 'utf-8' || value === 'gb18030';
}
