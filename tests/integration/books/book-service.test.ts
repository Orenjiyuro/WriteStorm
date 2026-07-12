import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BookService, BookServiceError } from '../../../src/main/books/book-service';
import { LibraryService } from '../../../src/main/library/library-service';
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
          structureEdition: null,
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
