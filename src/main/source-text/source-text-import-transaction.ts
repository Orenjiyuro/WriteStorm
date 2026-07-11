import type { SqliteDatabase } from '../db/sqlite';
import type { BookSummary, JobSummary } from '../../shared/contracts';
import type {
  BreakdownBookId,
  LibraryId,
  SourceTextId,
} from '../../shared/domain';
import type { SourceTextImportMetadata } from './source-text-metadata';

export type ImportBookWithSourceTextInput = {
  readonly libraryId: LibraryId;
  readonly bookId: BreakdownBookId;
  readonly title: string;
  readonly sourceText: SourceTextImportMetadata;
  readonly job?: {
    readonly sourceTextId: SourceTextId;
    readonly summary: JobSummary;
  };
  readonly updatedAt: string;
};

export type ImportBookWithSourceTextResult = {
  readonly book: BookSummary;
  readonly sourceText: SourceTextImportMetadata['dto'];
  readonly job?: JobSummary;
};

export function importBookWithSourceText(
  database: SqliteDatabase,
  input: ImportBookWithSourceTextInput,
): ImportBookWithSourceTextResult {
  assertMetadataMatchesBook(input);

  const writeImport = database.transaction(() => {
    database.prepare(`
      INSERT INTO books (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(input.bookId, input.title, input.updatedAt, input.updatedAt);

    database.prepare(`
      INSERT INTO source_texts (
        id,
        book_id,
        format,
        content_hash,
        encoding,
        source_edition,
        relative_path,
        imported_at,
        original_file_name,
        size_bytes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.sourceText.row.id,
      input.sourceText.row.book_id,
      input.sourceText.row.format,
      input.sourceText.row.content_hash,
      input.sourceText.row.encoding,
      input.sourceText.row.source_edition,
      input.sourceText.row.relative_path,
      input.sourceText.row.imported_at,
      input.sourceText.row.original_file_name,
      input.sourceText.row.size_bytes,
    );

    database.prepare(`
      UPDATE books
      SET source_text_id = ?, updated_at = ?
      WHERE id = ?
    `).run(input.sourceText.dto.id, input.updatedAt, input.bookId);

    if (input.job) {
      database.prepare(`
        INSERT INTO jobs (
          id,
          book_id,
          type,
          state,
          progress,
          payload_json,
          error_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'source_import', 'completed', 1, ?, NULL, ?, ?)
      `).run(
        input.job.summary.id,
        input.job.summary.bookId,
        JSON.stringify({ sourceTextId: input.job.sourceTextId }),
        input.job.summary.updatedAt,
        input.job.summary.updatedAt,
      );
    }
  });

  writeImport();

  return {
    book: {
      id: input.bookId,
      libraryId: input.libraryId,
      title: input.title,
      sourceTextId: input.sourceText.dto.id as SourceTextId,
      sourceTextEdition: input.sourceText.dto.sourceTextEdition,
      structureEdition: null,
      updatedAt: input.updatedAt,
    },
    sourceText: input.sourceText.dto,
    ...(input.job ? { job: input.job.summary } : {}),
  };
}

function assertMetadataMatchesBook(input: ImportBookWithSourceTextInput): void {
  if (input.sourceText.dto.bookId !== input.bookId || input.sourceText.row.book_id !== input.bookId) {
    throw new Error('Source text metadata book id must match the imported book id.');
  }

  if (input.sourceText.row.id !== input.sourceText.dto.id) {
    throw new Error('Source text metadata row id must match the DTO id.');
  }
}
