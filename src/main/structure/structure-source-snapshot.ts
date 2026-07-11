import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { LibraryContext } from '../library/library-service';
import { resolveLibraryRelativePath } from '../library/path-guard';
import { decodeSourceTextBytes, type SourceTextEncoding } from '../source-text/source-text-encoding';
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

type CurrentSourceRow = {
  book_title: string;
  source_text_id: string | null;
  source_edition: number | null;
  content_hash: string | null;
  encoding: string | null;
  relative_path: string | null;
};

export async function loadCurrentStructureSourceSnapshot(
  context: LibraryContext,
  bookId: BreakdownBookId,
): Promise<LoadedStructureSourceSnapshot> {
  const row = context.database.prepare(`
    SELECT
      book.title AS book_title,
      book.source_text_id,
      source.source_edition,
      source.content_hash,
      source.encoding,
      source.relative_path
    FROM books book
    LEFT JOIN source_texts source ON source.id = book.source_text_id
    WHERE book.id = ?
  `).get(bookId) as CurrentSourceRow | undefined;

  if (!row) {
    throw new StructureSourceSnapshotError('book_not_found', 'Book was not found in the current library.');
  }

  if (row.source_text_id === null ||
    row.source_edition === null ||
    row.content_hash === null ||
    row.encoding === null ||
    row.relative_path === null) {
    throw new StructureSourceSnapshotError('source_missing', 'Book does not have a current imported source.');
  }

  if (!isSourceTextEncoding(row.encoding)) {
    throw new StructureSourceSnapshotError(
      'source_encoding_invalid',
      `Imported source encoding ${row.encoding} is not supported.`,
    );
  }

  let bytes: Buffer;
  try {
    const sourcePath = resolveLibraryRelativePath(context.rootPath, row.relative_path);
    bytes = await readFile(sourcePath);
  } catch (error) {
    throw new StructureSourceSnapshotError(
      'source_read_failed',
      'Current imported source could not be read from the library.',
      { cause: error },
    );
  }

  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (contentHash !== row.content_hash) {
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
    bookTitle: row.book_title,
    sourceText: decoded.text,
    snapshot: {
      sourceTextId: row.source_text_id as SourceTextId,
      sourceTextEdition: row.source_edition,
      contentHash: row.content_hash,
      decodedTextLength: decoded.text.length,
      offsetUnit: 'utf16_code_unit',
    },
  };
}

function isSourceTextEncoding(value: string): value is SourceTextEncoding {
  return value === 'utf-8' || value === 'gb18030';
}
