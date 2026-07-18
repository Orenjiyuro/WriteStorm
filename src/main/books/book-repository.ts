import type { BreakdownBookId, SourceTextId } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type PersistedBookRow = {
  readonly id: BreakdownBookId;
  readonly title: string;
  readonly sourceTextId: SourceTextId | null;
  readonly sourceTextEdition: number | null;
  readonly structureEdition: number | null;
  readonly mainTypeDisplayName: string | null;
  readonly contentFocusDisplayNames: readonly string[];
  readonly updatedAt: string;
};

type BasePersistedBookRow = Omit<
  PersistedBookRow,
  'mainTypeDisplayName' | 'contentFocusDisplayNames'
>;

type ClassificationDisplayRow = {
  readonly bookId: BreakdownBookId;
  readonly displayName: string;
};

export class BookRepository {
  list(database: SqliteDatabase): PersistedBookRow[] {
    const rows = database.prepare(
      `${BOOK_SELECT} ORDER BY books.updated_at DESC, books.id ASC`,
    ).all() as BasePersistedBookRow[];
    const mainTypeDisplayNames = new Map(
      (database.prepare(`
        SELECT binding.book_id AS bookId, version.display_name AS displayName
        FROM book_type_bindings AS binding
        INNER JOIN type_definition_versions AS version
          ON version.id = binding.main_type_definition_version_id
          AND version.type_definition_id = binding.main_type_definition_id
        WHERE binding.main_type_definition_id IS NOT NULL
      `).all() as ClassificationDisplayRow[])
        .map((row) => [row.bookId, row.displayName] as const),
    );
    const contentFocusDisplayNames = new Map<BreakdownBookId, string[]>();
    const contentFocusRows = database.prepare(`
      SELECT focus.book_id AS bookId, version.display_name AS displayName
      FROM book_content_focus_bindings AS focus
      INNER JOIN type_definition_versions AS version
        ON version.id = focus.type_definition_version_id
        AND version.type_definition_id = focus.type_definition_id
      ORDER BY focus.book_id ASC, focus.priority ASC
    `).all() as ClassificationDisplayRow[];
    for (const focus of contentFocusRows) {
      const displayNames = contentFocusDisplayNames.get(focus.bookId) ?? [];
      displayNames.push(focus.displayName);
      contentFocusDisplayNames.set(focus.bookId, displayNames);
    }

    return rows.map((row) => normalizeRow(
      row,
      mainTypeDisplayNames.get(row.id) ?? null,
      contentFocusDisplayNames.get(row.id) ?? [],
    ));
  }

  get(database: SqliteDatabase, bookId: BreakdownBookId): PersistedBookRow | null {
    const row = database.prepare(`${BOOK_SELECT} WHERE books.id = ?`).get(bookId) as
      BasePersistedBookRow | undefined;
    return row ? normalizeSingleRow(database, row) : null;
  }
}

const BOOK_SELECT = `
  SELECT
    books.id AS id,
    books.title AS title,
    source_texts.id AS sourceTextId,
    source_texts.source_edition AS sourceTextEdition,
    books.structure_edition AS structureEdition,
    books.updated_at AS updatedAt
  FROM books
  LEFT JOIN source_texts
    ON source_texts.id = books.current_source_text_id
    AND source_texts.book_id = books.id
`;

function normalizeSingleRow(
  database: SqliteDatabase,
  row: BasePersistedBookRow,
): PersistedBookRow {
  const mainTypeDisplayName = database.prepare(`
    SELECT version.display_name
    FROM book_type_bindings AS binding
    INNER JOIN type_definition_versions AS version
      ON version.id = binding.main_type_definition_version_id
      AND version.type_definition_id = binding.main_type_definition_id
    WHERE binding.book_id = ?
  `).pluck().get(row.id);
  const contentFocusDisplayNames = database.prepare(`
    SELECT version.display_name
    FROM book_content_focus_bindings AS focus
    INNER JOIN type_definition_versions AS version
      ON version.id = focus.type_definition_version_id
      AND version.type_definition_id = focus.type_definition_id
    WHERE focus.book_id = ?
    ORDER BY focus.priority ASC
  `).pluck().all(row.id);
  return normalizeRow(
    row,
    typeof mainTypeDisplayName === 'string' ? mainTypeDisplayName : null,
    contentFocusDisplayNames.filter(
      (value): value is string => typeof value === 'string',
    ),
  );
}

function normalizeRow(
  row: BasePersistedBookRow,
  mainTypeDisplayName: string | null,
  contentFocusDisplayNames: readonly string[],
): PersistedBookRow {
  return {
    ...row,
    id: row.id as BreakdownBookId,
    sourceTextId: row.sourceTextId as SourceTextId | null,
    mainTypeDisplayName,
    contentFocusDisplayNames,
  };
}
