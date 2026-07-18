import type { SchemaSemanticBoundary } from '../schema-semantic-witness';

const now = '2026-07-17T00:00:00.000Z';
const book = `INSERT INTO books (id, title, created_at, updated_at) VALUES ('book', 'Book', '${now}', '${now}')`;
const mainDefinition = `INSERT INTO type_definitions VALUES ('main', 'main_type', 'built_in', 'main', NULL)`;
const mainVersion = `INSERT INTO type_definition_versions VALUES ('main-v1', 'main', 1, 'Main', 'Main', '${now}')`;
const focusDefinition = `INSERT INTO type_definitions VALUES ('focus', 'content_focus', 'built_in', 'focus', NULL)`;
const focusVersion = `INSERT INTO type_definition_versions VALUES ('focus-v1', 'focus', 1, 'Focus', 'Focus', '${now}')`;
const releaseOne = `INSERT INTO type_library_versions VALUES (1, 2, '${now}')`;
const releaseTwo = `INSERT INTO type_library_versions VALUES (2, 2, '${now}')`;
const mainEntryOne = `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`;
const focusEntryOne = `INSERT INTO type_library_version_entries VALUES (1, 'focus', 'focus-v1', 'content_focus', 0)`;
const emptyBinding = `INSERT INTO book_type_bindings VALUES ('book', 1, NULL, NULL, 1, '${now}')`;

function boundary(
  id: string,
  kind: SchemaSemanticBoundary['kind'],
  accept: SchemaSemanticBoundary['accept'],
  reject: SchemaSemanticBoundary['reject'],
): SchemaSemanticBoundary {
  return { id: `007.type_library_binding.${id}`, migrationId: 7, kind, accept, reject };
}

export const TYPE_LIBRARY_BOOK_BINDINGS_SEMANTIC_BOUNDARIES = [
  boundary(
    'main_pair',
    'check',
    { setupSql: `${book}; ${releaseOne}`, sql: emptyBinding },
    {
      setupSql: `${book}; ${mainDefinition}; ${mainVersion}; ${releaseOne}; ${mainEntryOne}`,
      sql: `INSERT INTO book_type_bindings VALUES ('book', 1, 'main', NULL, 1, '${now}')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'focus_priority',
    'check',
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${focusEntryOne}; ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
    },
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${focusEntryOne}; ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 0, 'focus', 'focus-v1')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'initial_revision',
    'trigger',
    { setupSql: `${book}; ${releaseOne}`, sql: emptyBinding },
    {
      setupSql: `${book}; ${releaseOne}`,
      sql: `INSERT INTO book_type_bindings VALUES ('book', 1, NULL, NULL, 2, '${now}')`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'revision_increment',
    'trigger',
    { setupSql: `${book}; ${releaseOne}; ${emptyBinding}`, sql: `UPDATE book_type_bindings SET revision = 2 WHERE book_id = 'book'` },
    {
      setupSql: `${book}; ${releaseOne}; ${emptyBinding}`,
      sql: `UPDATE book_type_bindings SET revision = 3 WHERE book_id = 'book'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'no_direct_delete',
    'trigger',
    {
      setupSql: `${book}; ${releaseOne}; ${emptyBinding}`,
      sql: `DELETE FROM books WHERE id = 'book'`,
    },
    {
      setupSql: `${book}; ${releaseOne}; ${emptyBinding}`,
      sql: `DELETE FROM book_type_bindings WHERE book_id = 'book'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'main_kind',
    'trigger',
    {
      setupSql: `${book}; ${mainDefinition}; ${mainVersion}; ${releaseOne}; ${mainEntryOne}`,
      sql: `INSERT INTO book_type_bindings VALUES ('book', 1, 'main', 'main-v1', 1, '${now}')`,
    },
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${focusEntryOne}`,
      sql: `INSERT INTO book_type_bindings VALUES ('book', 1, 'focus', 'focus-v1', 1, '${now}')`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'focus_kind',
    'trigger',
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${focusEntryOne}; ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
    },
    {
      setupSql: `${book}; ${mainDefinition}; ${mainVersion}; ${releaseOne}; ${mainEntryOne}; ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'main', 'main-v1')`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'focus_release',
    'trigger',
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${focusEntryOne}; ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
    },
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${releaseTwo}; INSERT INTO type_library_version_entries VALUES (2, 'focus', 'focus-v1', 'content_focus', 0); ${emptyBinding}`,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'parent_release_preserves_focuses',
    'trigger',
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${releaseTwo}; ${focusEntryOne}; INSERT INTO type_library_version_entries VALUES (2, 'focus', 'focus-v1', 'content_focus', 0); ${emptyBinding}; INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
      sql: `UPDATE book_type_bindings SET type_library_version = 2, revision = 2 WHERE book_id = 'book'`,
    },
    {
      setupSql: `${book}; ${focusDefinition}; ${focusVersion}; ${releaseOne}; ${releaseTwo}; ${focusEntryOne}; ${emptyBinding}; INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1')`,
      sql: `UPDATE book_type_bindings SET type_library_version = 2, revision = 2 WHERE book_id = 'book'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
] as const satisfies readonly SchemaSemanticBoundary[];
