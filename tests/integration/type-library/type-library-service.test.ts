import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  createLibraryUnitOfWork,
  type InternalLibrarySession,
} from '../../../src/main/library/library-unit-of-work';
import {
  TypeLibraryBookBindingMutationPort,
  TypeLibraryService,
  TypeLibraryServiceError,
  type UpdateBookTypeBindingCommand,
} from '../../../src/main/type-library/type-library-service';
import type {
  BreakdownBookId,
  LibraryId,
  TypeDefinitionId,
  TypeDefinitionVersionId,
} from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];
const tempDirectories: string[] = [];
const NOW = '2026-07-17T10:00:00.000Z';
const BOOK_ID = 'book-type-library' as BreakdownBookId;

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('TypeLibraryService Book binding CAS', () => {
  it('creates revision 1 for a focus-only first write', () => {
    const fixture = serviceFixture();

    const result = fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: null,
      contentFocuses: [reference('builtin_focus_001')],
    }));

    expect(result).toEqual({
      bookId: BOOK_ID,
      typeLibraryVersion: 1,
      revision: 1,
      mainType: null,
      contentFocuses: [{ priority: 1, ...reference('builtin_focus_001') }],
      updatedAt: NOW,
    });
    expect(fixture.service.getBookBinding(BOOK_ID)).toEqual(result);
  });

  it('atomically replaces ordered focuses and retains an empty binding through later revisions', () => {
    const fixture = serviceFixture();
    fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: reference('builtin_main_001'),
      contentFocuses: [reference('builtin_focus_001'), reference('builtin_focus_002')],
    }));

    const replaced = fixture.service.updateBookBinding(command({
      expectedRevision: 1,
      mainType: reference('builtin_main_002'),
      contentFocuses: [reference('builtin_focus_003'), reference('builtin_focus_001')],
    }));
    expect(replaced).toMatchObject({
      revision: 2,
      mainType: reference('builtin_main_002'),
      contentFocuses: [
        { priority: 1, ...reference('builtin_focus_003') },
        { priority: 2, ...reference('builtin_focus_001') },
      ],
    });

    const cleared = fixture.service.updateBookBinding(command({
      expectedRevision: 2,
      mainType: null,
      contentFocuses: [],
    }));
    expect(cleared).toMatchObject({ revision: 3, mainType: null, contentFocuses: [] });
    expect(fixture.database.prepare(
      'SELECT revision FROM book_type_bindings WHERE book_id = ?',
    ).pluck().get(BOOK_ID)).toBe(3);
  });

  it('returns revision_conflict without changing the aggregate for stale or repeated first writes', () => {
    const fixture = serviceFixture();
    const initial = fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: reference('builtin_main_001'),
    }));

    for (const expectedRevision of [0, 4]) {
      expectServiceError(
        () => fixture.service.updateBookBinding(command({
          expectedRevision,
          mainType: reference('builtin_main_002'),
        })),
        'revision_conflict',
      );
    }
    expect(fixture.service.getBookBinding(BOOK_ID)).toEqual(initial);
  });

  it('maps invalid selections to stable service errors', () => {
    const fixture = serviceFixture();
    const cases: Array<{
      readonly input: UpdateBookTypeBindingCommand;
      readonly reason: TypeLibraryServiceError['reason'];
    }> = [
      { input: command({ bookId: 'missing' as BreakdownBookId }), reason: 'book_not_found' },
      { input: command({ typeLibraryVersion: 99 }), reason: 'type_library_version_unavailable' },
      { input: command({ mainType: reference('builtin_focus_001') }), reason: 'type_kind_mismatch' },
      { input: command({ mainType: reference('missing') }), reason: 'type_definition_version_unavailable' },
      {
        input: command({
          contentFocuses: [reference('builtin_focus_001'), reference('builtin_focus_001')],
        }),
        reason: 'duplicate_content_focus',
      },
      {
        input: command({
          contentFocuses: [
            reference('builtin_focus_001'),
            reference('builtin_focus_002'),
            reference('builtin_focus_003'),
            reference('builtin_focus_004'),
          ],
        }),
        reason: 'too_many_content_focuses',
      },
    ];

    for (const { input, reason } of cases) {
      expectServiceError(() => fixture.service.updateBookBinding(input), reason);
    }
    expect(fixture.service.getBookBinding(BOOK_ID)?.revision).toBe(0);
  });

  it('rejects a new binding to an archived definition while keeping it historically readable', () => {
    const fixture = serviceFixture();
    const existing = fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: reference('builtin_main_001'),
    }));
    fixture.database.prepare(`
      UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z'
      WHERE id = 'builtin_main_001'
    `).run();

    expect(fixture.service.getBookBinding(BOOK_ID)).toEqual(existing);
    expect(fixture.service.getBookBindingDetail(BOOK_ID)).toMatchObject({
      binding: existing,
      pinnedOptions: [{
        typeDefinitionVersionId: 'builtin_main_001_v1',
        availability: 'archived',
      }],
    });
    expect(fixture.service.listReleaseOptions(1).options.some(({ typeDefinitionId }) =>
      typeDefinitionId === 'builtin_main_001')).toBe(false);
    const removed = fixture.service.updateBookBinding(command({
      expectedRevision: 1,
      mainType: null,
    }));
    expectServiceError(
      () => fixture.service.updateBookBinding(command({
        expectedRevision: 2,
        mainType: reference('builtin_main_001'),
      })),
      'type_definition_version_unavailable',
    );
    expect(fixture.service.getBookBinding(BOOK_ID)).toEqual(removed);
  });

  it('allows an archived reference only when it remains in its original pinned slot', () => {
    const fixture = serviceFixture();
    fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: reference('builtin_main_001'),
      contentFocuses: [reference('builtin_focus_001')],
    }));
    fixture.database.prepare(`
      UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z'
      WHERE id IN ('builtin_main_001', 'builtin_focus_001')
    `).run();

    expect(() => fixture.service.updateBookBinding(command({
      expectedRevision: 1,
      mainType: reference('builtin_main_001'),
      contentFocuses: [reference('builtin_focus_001'), reference('builtin_focus_002')],
    }))).not.toThrow();
    expectServiceError(
      () => fixture.service.updateBookBinding(command({
        expectedRevision: 2,
        mainType: reference('builtin_main_001'),
        contentFocuses: [reference('builtin_focus_002'), reference('builtin_focus_001')],
      })),
      'type_definition_version_unavailable',
    );
  });

  it('fails closed instead of normalizing a corrupted persisted focus order', () => {
    const fixture = serviceFixture();
    fixture.database.prepare(`
      INSERT INTO book_type_bindings VALUES (?, 1, NULL, NULL, 1, ?)
    `).run(BOOK_ID, NOW);
    fixture.database.prepare(`
      INSERT INTO book_content_focus_bindings VALUES (?, 2, ?, ?)
    `).run(BOOK_ID, 'builtin_focus_001', 'builtin_focus_001_v1');

    expectServiceError(
      () => fixture.service.updateBookBinding(command({ expectedRevision: 1 })),
      'invalid_persisted_book_type_binding',
    );
    expect(fixture.database.prepare(
      'SELECT priority FROM book_content_focus_bindings WHERE book_id = ?',
    ).pluck().get(BOOK_ID)).toBe(2);
  });

  it('rolls back parent revision and focus replacement if a child insert fails', () => {
    const fixture = serviceFixture();
    const initial = fixture.service.updateBookBinding(command({
      expectedRevision: 0,
      mainType: reference('builtin_main_001'),
      contentFocuses: [reference('builtin_focus_001')],
    }));
    fixture.database.exec(`
      CREATE TRIGGER reject_second_focus
      BEFORE INSERT ON book_content_focus_bindings
      WHEN NEW.priority = 2
      BEGIN
        SELECT RAISE(ABORT, 'test child failure');
      END;
    `);

    expect(() => fixture.service.updateBookBinding(command({
      expectedRevision: 1,
      mainType: reference('builtin_main_002'),
      contentFocuses: [reference('builtin_focus_002'), reference('builtin_focus_003')],
    }))).toThrow('test child failure');
    expect(fixture.service.getBookBinding(BOOK_ID)).toEqual(initial);
  });

  it('provides a transaction port that participates in an outer import rollback', () => {
    const database = migratedDatabase();
    const port = new TypeLibraryBookBindingMutationPort();
    const importedBookId = 'imported-book' as BreakdownBookId;
    const importTransaction = database.transaction(() => {
      insertBook(database, importedBookId);
      port.updateInTransaction(database, command({
        bookId: importedBookId,
        expectedRevision: 0,
        mainType: reference('builtin_main_001'),
      }), NOW);
      throw new Error('cancel import');
    });

    expect(importTransaction).toThrow('cancel import');
    expect(database.prepare('SELECT COUNT(*) FROM books WHERE id = ?').pluck().get(importedBookId)).toBe(0);
    expect(database.prepare(
      'SELECT COUNT(*) FROM book_type_bindings WHERE book_id = ?',
    ).pluck().get(importedBookId)).toBe(0);
  });

  it('requires an open Library for service reads and writes', () => {
    const fixture = serviceFixture();
    fixture.setCurrent(null);

    expectServiceError(() => fixture.service.listReleaseOptions(), 'no_current_library');
    expectServiceError(() => fixture.service.getBookBinding(BOOK_ID), 'no_current_library');
    expectServiceError(
      () => fixture.service.updateBookBinding(command()),
      'no_current_library',
    );
  });
});

function serviceFixture(): {
  readonly database: SqliteDatabase;
  readonly service: TypeLibraryService;
  readonly setCurrent: (session: InternalLibrarySession | null) => void;
} {
  const database = migratedDatabase();
  insertBook(database, BOOK_ID);
  let current: InternalLibrarySession | null = {
    sessionId: 'type-library-session',
    library: {
      id: 'library-1' as LibraryId,
      name: 'Library',
      rootPath: 'C:/library',
      schemaVersion: 7,
      appVersion: '0.1.0',
    },
    rootPath: 'C:/library',
    manifestPath: 'C:/library/library.json',
    databasePath: 'C:/library/writestorm.sqlite',
    database,
  };
  const unitOfWork = createLibraryUnitOfWork(() => current);
  const libraryService = {
    getCurrent: () => current,
    getUnitOfWork: () => unitOfWork,
  };
  return {
    database,
    service: new TypeLibraryService({ libraryService, now: () => NOW }),
    setCurrent: (session) => { current = session; },
  };
}

function migratedDatabase(): SqliteDatabase {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-type-library-service-'));
  tempDirectories.push(tempDirectory);
  const database = openSqliteDatabase(path.join(tempDirectory, 'writestorm.sqlite'));
  databases.push(database);
  runMigrations(database, APP_MIGRATIONS);
  return database;
}

function insertBook(database: SqliteDatabase, bookId: BreakdownBookId): void {
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(bookId, bookId, NOW, NOW);
}

function reference(stableKey: string): {
  readonly typeDefinitionId: TypeDefinitionId;
  readonly typeDefinitionVersionId: TypeDefinitionVersionId;
} {
  return {
    typeDefinitionId: stableKey as TypeDefinitionId,
    typeDefinitionVersionId: `${stableKey}_v1` as TypeDefinitionVersionId,
  };
}

function command(
  overrides: Partial<UpdateBookTypeBindingCommand> = {},
): UpdateBookTypeBindingCommand {
  return {
    bookId: BOOK_ID,
    expectedRevision: 0,
    typeLibraryVersion: 1,
    mainType: null,
    contentFocuses: [],
    ...overrides,
  };
}

function expectServiceError(
  operation: () => unknown,
  reason: TypeLibraryServiceError['reason'],
): void {
  expect(operation).toThrowError(expect.objectContaining({
    name: 'TypeLibraryServiceError',
    reason,
  }));
}
