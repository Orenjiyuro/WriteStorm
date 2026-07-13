import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryService } from '../../../src/main/library/library-service';
import { SourceTextService } from '../../../src/main/source-text/source-text-service';
import type { BreakdownBookId, LibraryId, SourceTextId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const libraryId = 'source-text-service-library' as LibraryId;

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('SourceTextService metadata ownership', () => {
  it('builds the canonical path and next monotonic edition without mutating prior editions', () => {
    const library = createLibrary();
    try {
      seedBookAndEditions(library);
      const service = new SourceTextService({ libraryService: library });

      expect(service.prepareImportMetadata({
        sourceTextId: 'source-3' as SourceTextId,
        bookId: 'book-1' as BreakdownBookId,
        originalFileName: '..\\Third.md',
        format: 'md',
        sizeBytes: 30,
        encoding: 'utf-8',
        contentHash: `sha256:${'3'.repeat(64)}`,
        importedAt: '2026-07-13T01:00:00.000Z',
      })).toMatchObject({
        dto: {
          id: 'source-3',
          bookId: 'book-1',
          fileName: 'Third.md',
          sourceTextEdition: 3,
        },
        row: {
          source_edition: 3,
          relative_path: 'source/source-3/Third.md',
        },
      });
      expect(storedEditions(library)).toEqual([
        { id: 'source-1', source_edition: 1, relative_path: 'source/source-1/first.md' },
        { id: 'source-2', source_edition: 2, relative_path: 'source/source-2/second.md' },
      ]);
    } finally {
      library.closeCurrent();
    }
  });

  it('rejects invalid size and non-SHA-256 content hashes', () => {
    const library = createLibrary();
    try {
      seedBook(library);
      const service = new SourceTextService({ libraryService: library });
      const valid = {
        sourceTextId: 'source-new' as SourceTextId,
        bookId: 'book-1' as BreakdownBookId,
        originalFileName: 'source.md',
        format: 'md' as const,
        sizeBytes: 1,
        encoding: 'utf-8',
        contentHash: `sha256:${'a'.repeat(64)}`,
        importedAt: '2026-07-13T01:00:00.000Z',
      };
      expect(() => service.prepareImportMetadata({ ...valid, sizeBytes: 0 })).toThrow(/positive/i);
      expect(() => service.prepareImportMetadata({ ...valid, contentHash: 'sha256:not-a-hash' }))
        .toThrow(/sha-256/i);
    } finally {
      library.closeCurrent();
    }
  });

  it('maps persisted rows and finds duplicate content hashes', () => {
    const library = createLibrary();
    try {
      seedBookAndEditions(library);
      const service = new SourceTextService({ libraryService: library });
      expect(service.get('source-2' as SourceTextId)).toMatchObject({
        id: 'source-2',
        bookId: 'book-1',
        fileName: 'second.md',
        sourceTextEdition: 2,
      });
      expect(service.findByContentHash(`sha256:${'2'.repeat(64)}`)).toMatchObject({ id: 'source-2' });
      expect(service.findByContentHash(`sha256:${'f'.repeat(64)}`)).toBeNull();
    } finally {
      library.closeCurrent();
    }
  });
});

function createLibrary(): LibraryService {
  const library = new LibraryService({
    appVersion: '0.1.0-test',
    createLibraryId: () => libraryId,
  });
  library.create({ rootPath: libraryRootPath(), name: 'SourceText Service' });
  return library;
}

function seedBook(library: LibraryService): void {
  library.getUnitOfWork().write((session) => session.database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run('book-1', 'Book', '2026-07-13T00:00:00.000Z', '2026-07-13T00:00:00.000Z'));
}

function seedBookAndEditions(library: LibraryService): void {
  seedBook(library);
  library.getUnitOfWork().write((session) => session.database.exec(`
    INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash,
      encoding, source_edition, relative_path, imported_at
    ) VALUES
      ('source-1', 'book-1', 'first.md', 10, 'md', 'sha256:${'1'.repeat(64)}',
        'utf-8', 1, 'source/source-1/first.md', '2026-07-13T00:00:00.000Z'),
      ('source-2', 'book-1', 'second.md', 20, 'md', 'sha256:${'2'.repeat(64)}',
        'utf-8', 2, 'source/source-2/second.md', '2026-07-13T00:30:00.000Z');
  `));
}

function storedEditions(library: LibraryService): unknown[] {
  return library.getUnitOfWork().read((session) => session.database.prepare(`
    SELECT id, source_edition, relative_path FROM source_texts ORDER BY source_edition
  `).all());
}

function libraryRootPath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-source-text-service-'));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'library');
}
