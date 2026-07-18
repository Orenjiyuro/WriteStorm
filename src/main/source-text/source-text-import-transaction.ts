import type { SqliteDatabase } from '../db/sqlite';
import type { BookSummary, ImportSourceTypeBinding, JobSummary } from '../../shared/contracts';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  SourceTextId,
} from '../../shared/domain';
import type { SourceTextImportMetadata } from './source-text-metadata';
import { JobService } from '../jobs/job-service';
import { mapJobRecordToSummary } from '../jobs/job-summary-mapper';
import { TypeLibraryBookBindingMutationPort } from '../type-library/type-library-service';
import { BookRepository } from '../books/book-repository';

export type ImportBookWithSourceTextInput = {
  readonly libraryId: LibraryId;
  readonly bookId: BreakdownBookId;
  readonly title: string;
  readonly sourceText: SourceTextImportMetadata;
  readonly typeBinding?: ImportSourceTypeBinding;
  readonly job?: {
    readonly id: JobId;
    readonly sourceTextId: SourceTextId;
    readonly updatedAt: string;
  };
  readonly updatedAt: string;
};

export type ImportBookWithSourceTextResult = {
  readonly book: BookSummary;
  readonly sourceText: SourceTextImportMetadata['dto'];
  readonly job?: JobSummary;
};

export type ImportBookWithSourceTextResultWithJob = Omit<
  ImportBookWithSourceTextResult,
  'job'
> & { readonly job: JobSummary };

export function importBookWithSourceText(
  database: SqliteDatabase,
  input: ImportBookWithSourceTextInput & { readonly job: NonNullable<ImportBookWithSourceTextInput['job']> },
): ImportBookWithSourceTextResultWithJob;

export function importBookWithSourceText(
  database: SqliteDatabase,
  input: ImportBookWithSourceTextInput,
): ImportBookWithSourceTextResult;

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
      SET current_source_text_id = ?, updated_at = ?
      WHERE id = ?
    `).run(input.sourceText.dto.id, input.updatedAt, input.bookId);

    if (input.typeBinding) {
      new TypeLibraryBookBindingMutationPort().updateInTransaction(database, {
        bookId: input.bookId,
        expectedRevision: 0,
        ...input.typeBinding,
      }, input.updatedAt);
    }

    if (input.job) {
      const jobs = new JobService({ database });
      const payload = { sourceTextId: input.job.sourceTextId };
      if (!jobs.get(input.job.id)) {
        jobs.createQueued({
          id: input.job.id,
          bookId: null,
          kind: 'source_import',
          totalUnits: 1,
          payloadSchemaVersion: 1,
          payload,
          createdAt: input.job.updatedAt,
          updatedAt: input.job.updatedAt,
        });
        jobs.transition(input.job.id, 'running', input.job.updatedAt);
      }
      return jobs.completeWithCheckpoint(input.job.id, {
        bookId: input.bookId,
        completedUnits: 1,
        totalUnits: 1,
        updatedAt: input.job.updatedAt,
        checkpoint: {
          id: `${input.job.id}:1`,
          kind: 'source_import_completed',
          payloadSchemaVersion: 1,
          payload,
          createdAt: input.job.updatedAt,
        },
      }).job;
    }
    return undefined;
  });

  const completedJob = writeImport();
  const persistedBook = new BookRepository().get(database, input.bookId);
  if (!persistedBook) throw new Error('Imported Book could not be read after commit.');

  return {
    book: {
      id: persistedBook.id,
      libraryId: input.libraryId,
      title: persistedBook.title,
      sourceTextId: persistedBook.sourceTextId,
      sourceTextEdition: persistedBook.sourceTextEdition,
      structureEdition: persistedBook.structureEdition,
      mainTypeDisplayName: persistedBook.mainTypeDisplayName,
      contentFocusDisplayNames: [...persistedBook.contentFocusDisplayNames],
      updatedAt: persistedBook.updatedAt,
    },
    sourceText: input.sourceText.dto,
    ...(completedJob ? { job: mapJobRecordToSummary(completedJob) } : {}),
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
