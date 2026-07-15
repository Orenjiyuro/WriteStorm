import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BookService, BookServiceError } from '../../../src/main/books/book-service';
import { LibraryService } from '../../../src/main/library/library-service';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import type { BreakdownBookId, LibraryId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const libraryId = 'book-service-library' as LibraryId;

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('BookService persisted reads', () => {
  it('lists persisted books after reopen with stable ordering and current source editions', async () => {
    const rootPath = libraryRootPath();
    const creator = libraryService();
    creator.create({ rootPath, name: 'Book Service Library' });
    seedBooks(creator);
    creator.closeCurrent();

    const opener = libraryService();
    try {
      await opener.open({ rootPath });
      const service = new BookService({ libraryService: opener });
      expect(service.list()).toEqual([
        {
          id: 'book-a',
          libraryId,
          title: 'Alpha',
          sourceTextId: 'source-a-2',
          sourceTextEdition: 2,
          structureEdition: 2,
          updatedAt: '2026-07-12T03:00:00.000Z',
        },
        {
          id: 'book-b',
          libraryId,
          title: 'Beta',
          sourceTextId: null,
          sourceTextEdition: null,
          structureEdition: null,
          updatedAt: '2026-07-12T03:00:00.000Z',
        },
      ]);
      expect(service.get('book-a' as BreakdownBookId)).toMatchObject({
        id: 'book-a',
        sourceTextEdition: 2,
        structureEdition: 2,
      });
      expect(service.get('missing' as BreakdownBookId)).toBeNull();
    } finally {
      opener.closeCurrent();
    }
  });

  it('requires a current library session', () => {
    const service = new BookService({ libraryService: libraryService() });
    expect(() => service.list()).toThrowError(new BookServiceError('no_current_library'));
  });

  it('rejects a Book pointer to a SourceText owned by another Book', () => {
    const rootPath = libraryRootPath();
    const service = libraryService();
    try {
      service.create({ rootPath, name: 'Ownership Library' });
      seedOwnershipBooks(service);
      expect(() => service.getUnitOfWork().write((session) => {
        session.database.prepare(`
          UPDATE books SET current_source_text_id = 'source-b' WHERE id = 'book-a'
        `).run();
      })).toThrow(/foreign key constraint failed/i);
    } finally {
      service.closeCurrent();
    }
  });

  it('does not expose a cross-Book SourceText from a corrupted database', async () => {
    const rootPath = libraryRootPath();
    const creator = libraryService();
    creator.create({ rootPath, name: 'Corruption Library' });
    seedOwnershipBooks(creator);
    creator.closeCurrent();

    const database = openSqliteDatabase(path.join(rootPath, 'writestorm.sqlite'));
    try {
      database.pragma('foreign_keys = OFF');
      database.prepare(`
        UPDATE books SET current_source_text_id = 'source-b' WHERE id = 'book-a'
      `).run();
    } finally {
      database.close();
    }

    const opener = libraryService();
    try {
      await opener.open({ rootPath });
      const book = new BookService({ libraryService: opener }).get('book-a' as BreakdownBookId);
      expect(book).toMatchObject({
        sourceTextId: null,
        sourceTextEdition: null,
      });
    } finally {
      opener.closeCurrent();
    }
  });

  it('keeps current-source deletion semantics while enforcing ownership', () => {
    const service = libraryService();
    try {
      service.create({ rootPath: libraryRootPath(), name: 'Deletion Library' });
      seedOwnershipBooks(service);
      service.getUnitOfWork().write((session) => {
        session.database.exec(`
          UPDATE books SET current_source_text_id = 'source-a' WHERE id = 'book-a';
          DELETE FROM source_texts WHERE id = 'source-a';
        `);
      });
      expect(service.getUnitOfWork().read((session) => session.database.prepare(`
        SELECT current_source_text_id FROM books WHERE id = 'book-a'
      `).pluck().get())).toBeNull();
    } finally {
      service.closeCurrent();
    }
  });
});

function seedBooks(service: LibraryService): void {
  service.getUnitOfWork().write((session) => {
    session.database.exec(`
      INSERT INTO books (id, title, created_at, updated_at)
      VALUES
        ('book-b', 'Beta', '2026-07-12T01:00:00.000Z', '2026-07-12T03:00:00.000Z'),
        ('book-a', 'Alpha', '2026-07-12T01:00:00.000Z', '2026-07-12T03:00:00.000Z');

      INSERT INTO source_texts (
        id, book_id, format, content_hash, encoding, source_edition,
        relative_path, imported_at, original_file_name, size_bytes
      ) VALUES
        ('source-a-1', 'book-a', 'md', 'sha256:a1', 'utf-8', 1,
          'source/source-a-1/a.md', '2026-07-12T01:00:00.000Z', 'a.md', 1),
        ('source-a-2', 'book-a', 'md', 'sha256:a2', 'utf-8', 2,
          'source/source-a-2/a.md', '2026-07-12T02:00:00.000Z', 'a.md', 1);

      UPDATE books SET current_source_text_id = 'source-a-2' WHERE id = 'book-a';
      UPDATE books SET structure_edition = 2 WHERE id = 'book-a';
    `);
  });
}

function seedOwnershipBooks(service: LibraryService): void {
  service.getUnitOfWork().write((session) => {
    session.database.exec(`
      INSERT INTO books (id, title, created_at, updated_at) VALUES
        ('book-a', 'Alpha', '2026-07-12T01:00:00.000Z', '2026-07-12T01:00:00.000Z'),
        ('book-b', 'Beta', '2026-07-12T01:00:00.000Z', '2026-07-12T01:00:00.000Z');

      INSERT INTO source_texts (
        id, book_id, format, content_hash, encoding, source_edition,
        relative_path, imported_at, original_file_name, size_bytes
      ) VALUES
        ('source-a', 'book-a', 'md', 'sha256:ownership-a', 'utf-8', 1,
          'source/source-a/a.md', '2026-07-12T01:00:00.000Z', 'a.md', 1),
        ('source-b', 'book-b', 'md', 'sha256:ownership-b', 'utf-8', 1,
          'source/source-b/b.md', '2026-07-12T01:00:00.000Z', 'b.md', 1);
    `);
  });
}

function libraryService(): LibraryService {
  return new LibraryService({
    appVersion: '0.1.0-test',
    createLibraryId: () => libraryId,
  });
}

function libraryRootPath(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-book-service-'));
  tempDirs.push(directory);
  return path.join(directory, 'library');
}
