import { describe, expect, it } from 'vitest';
import {
  buildSourceTextImportMetadata,
  type SourceTextImportMetadataInput,
} from '../../src/main/source-text/source-text-metadata';
import type {
  BreakdownBookId,
  SourceTextId,
} from '../../src/shared/domain';

const input = {
  sourceTextId: 'source-1' as SourceTextId,
  bookId: 'book-1' as BreakdownBookId,
  originalFileName: 'Example.md',
  format: 'md',
  sizeBytes: 120,
  encoding: 'utf-8',
  contentHash: 'sha256:abc123',
  relativePath: 'source/source-1/Example.md',
  importedAt: '2026-07-09T00:00:00.000Z',
} satisfies SourceTextImportMetadataInput;

describe('source text import metadata', () => {
  it('builds the shared metadata DTO and source_texts insert row from import artifacts', () => {
    expect(buildSourceTextImportMetadata(input)).toEqual({
      dto: {
        id: 'source-1',
        bookId: 'book-1',
        fileName: 'Example.md',
        format: 'md',
        sizeBytes: 120,
        encoding: 'utf-8',
        contentHash: 'sha256:abc123',
        sourceTextEdition: 1,
        importedAt: '2026-07-09T00:00:00.000Z',
      },
      row: {
        id: 'source-1',
        book_id: 'book-1',
        format: 'md',
        content_hash: 'sha256:abc123',
        encoding: 'utf-8',
        source_edition: 1,
        relative_path: 'source/source-1/Example.md',
        imported_at: '2026-07-09T00:00:00.000Z',
        original_file_name: 'Example.md',
        size_bytes: 120,
      },
    });
  });

  it('preserves explicit positive source text editions for future re-import metadata', () => {
    expect(buildSourceTextImportMetadata({
      ...input,
      sourceTextEdition: 2,
    }).dto.sourceTextEdition).toBe(2);
    expect(buildSourceTextImportMetadata({
      ...input,
      sourceTextEdition: 2,
    }).row.source_edition).toBe(2);
  });

  it('rejects invalid metadata before SQLite trigger errors', () => {
    expect(() => buildSourceTextImportMetadata({
      ...input,
      originalFileName: '',
    })).toThrow(/original file name/i);
    expect(() => buildSourceTextImportMetadata({
      ...input,
      sizeBytes: 0,
    })).toThrow(/size bytes/i);
    expect(() => buildSourceTextImportMetadata({
      ...input,
      sourceTextEdition: 0,
    })).toThrow(/source text edition/i);
  });
});
