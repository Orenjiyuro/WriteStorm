import type { SourceTextFormat } from '../../shared/contracts';
import type { BreakdownBookId, SourceTextId } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type PersistedSourceText = {
  readonly id: SourceTextId;
  readonly bookId: BreakdownBookId;
  readonly fileName: string;
  readonly format: SourceTextFormat;
  readonly sizeBytes: number;
  readonly encoding: string;
  readonly contentHash: string;
  readonly sourceTextEdition: number;
  readonly relativePath: string;
  readonly importedAt: string;
};

export class SourceTextRepository {
  get(database: SqliteDatabase, sourceTextId: SourceTextId): PersistedSourceText | null {
    const row = database.prepare(`${SOURCE_TEXT_SELECT} WHERE id = ?`).get(sourceTextId);
    return row ? mapRow(row as SourceTextRow) : null;
  }

  findByContentHash(database: SqliteDatabase, contentHash: string): PersistedSourceText | null {
    const row = database.prepare(`${SOURCE_TEXT_SELECT} WHERE content_hash = ?`).get(contentHash);
    return row ? mapRow(row as SourceTextRow) : null;
  }

  getCurrentForBook(database: SqliteDatabase, bookId: BreakdownBookId): PersistedSourceText | null {
    const row = database.prepare(`
      ${SOURCE_TEXT_SELECT}
      JOIN books ON books.current_source_text_id = source_texts.id
        AND books.id = source_texts.book_id
      WHERE books.id = ?
    `).get(bookId) as SourceTextRow | undefined;
    return row ? mapRow(row) : null;
  }

  list(database: SqliteDatabase): PersistedSourceText[] {
    return (database.prepare(`${SOURCE_TEXT_SELECT} ORDER BY book_id, source_edition`).all() as SourceTextRow[])
      .map(mapRow);
  }

  nextEdition(database: SqliteDatabase, bookId: BreakdownBookId): number {
    const current = database.prepare(`
      SELECT MAX(source_edition) FROM source_texts WHERE book_id = ?
    `).pluck().get(bookId);
    return (typeof current === 'number' ? current : 0) + 1;
  }
}

type SourceTextRow = {
  readonly id: string;
  readonly bookId: string;
  readonly fileName: string;
  readonly format: SourceTextFormat;
  readonly sizeBytes: number;
  readonly encoding: string;
  readonly contentHash: string;
  readonly sourceTextEdition: number;
  readonly relativePath: string;
  readonly importedAt: string;
};

const SOURCE_TEXT_SELECT = `
  SELECT
    source_texts.id,
    source_texts.book_id AS bookId,
    source_texts.original_file_name AS fileName,
    source_texts.format,
    source_texts.size_bytes AS sizeBytes,
    source_texts.encoding,
    source_texts.content_hash AS contentHash,
    source_texts.source_edition AS sourceTextEdition,
    source_texts.relative_path AS relativePath,
    source_texts.imported_at AS importedAt
  FROM source_texts
`;

function mapRow(row: SourceTextRow): PersistedSourceText {
  return {
    ...row,
    id: row.id as SourceTextId,
    bookId: row.bookId as BreakdownBookId,
  };
}
