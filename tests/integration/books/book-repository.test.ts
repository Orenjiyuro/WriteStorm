import { describe, expect, it } from 'vitest';
import { BookRepository } from '../../../src/main/books/book-repository';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import {
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../src/main/db/sqlite';
import { TypeLibraryBookBindingMutationPort } from '../../../src/main/type-library/type-library-service';
import type {
  BreakdownBookId,
  TypeDefinitionId,
  TypeDefinitionVersionId,
} from '../../../src/shared/domain';

describe('BookRepository list classification reads', () => {
  it('uses a constant three queries for Books and classification display fields', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, APP_MIGRATIONS);
      database.exec(`
        INSERT INTO books (id, title, created_at, updated_at) VALUES
          ('book-a', 'Alpha', '2026-07-18T00:00:00.000Z', '2026-07-18T03:00:00.000Z'),
          ('book-b', 'Beta', '2026-07-18T00:00:00.000Z', '2026-07-18T02:00:00.000Z'),
          ('book-c', 'Gamma', '2026-07-18T00:00:00.000Z', '2026-07-18T01:00:00.000Z');
      `);
      const mutationPort = new TypeLibraryBookBindingMutationPort();
      mutationPort.updateInTransaction(database, {
        bookId: 'book-a' as BreakdownBookId,
        expectedRevision: 0,
        typeLibraryVersion: 1,
        mainType: reference('builtin_main_001'),
        contentFocuses: [
          reference('builtin_focus_001'),
          reference('builtin_focus_005'),
        ],
      }, '2026-07-18T03:00:00.000Z');
      mutationPort.updateInTransaction(database, {
        bookId: 'book-b' as BreakdownBookId,
        expectedRevision: 0,
        typeLibraryVersion: 1,
        mainType: null,
        contentFocuses: [reference('builtin_focus_003')],
      }, '2026-07-18T02:00:00.000Z');

      let prepareCount = 0;
      const countingDatabase = {
        prepare(sql: string) {
          prepareCount += 1;
          return database.prepare(sql);
        },
      } as unknown as SqliteDatabase;

      const rows = new BookRepository().list(countingDatabase);

      expect(prepareCount).toBe(3);
      expect(rows.map((row) => ({
        id: row.id,
        mainTypeDisplayName: row.mainTypeDisplayName,
        contentFocusDisplayNames: row.contentFocusDisplayNames,
      }))).toEqual([
        {
          id: 'book-a',
          mainTypeDisplayName: '日轻校园',
          contentFocusDisplayNames: ['恋爱炒股', '群像'],
        },
        {
          id: 'book-b',
          mainTypeDisplayName: null,
          contentFocusDisplayNames: ['能力规则'],
        },
        {
          id: 'book-c',
          mainTypeDisplayName: null,
          contentFocusDisplayNames: [],
        },
      ]);
    } finally {
      database.close();
    }
  });
});

function reference(stableKey: string) {
  return {
    typeDefinitionId: stableKey as TypeDefinitionId,
    typeDefinitionVersionId: `${stableKey}_v1` as TypeDefinitionVersionId,
  };
}
