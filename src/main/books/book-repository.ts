import type { BreakdownBookId, SourceTextId } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type PersistedBookRow = {
  readonly id: BreakdownBookId;
  readonly title: string;
  readonly sourceTextId: SourceTextId | null;
  readonly sourceTextEdition: number | null;
  readonly updatedAt: string;
};

export class BookRepository {
  list(database: SqliteDatabase): PersistedBookRow[] {
    return (database.prepare(
      `${BOOK_SELECT} ORDER BY books.updated_at DESC, books.id ASC`,
    ).all() as PersistedBookRow[]).map(normalizeRow);
  }

  get(database: SqliteDatabase, bookId: BreakdownBookId): PersistedBookRow | null {
    const row = database.prepare(`${BOOK_SELECT} WHERE books.id = ?`).get(bookId) as PersistedBookRow | undefined;
    return row ? normalizeRow(row) : null;
  }
}

const BOOK_SELECT = `
  SELECT
    books.id AS id,
    books.title AS title,
    source_texts.id AS sourceTextId,
    source_texts.source_edition AS sourceTextEdition,
    books.updated_at AS updatedAt
  FROM books
  LEFT JOIN source_texts
    ON source_texts.id = books.current_source_text_id
    AND source_texts.book_id = books.id
`;

function normalizeRow(row: PersistedBookRow): PersistedBookRow {
  return {
    ...row,
    id: row.id as BreakdownBookId,
    sourceTextId: row.sourceTextId as SourceTextId | null,
  };
}
