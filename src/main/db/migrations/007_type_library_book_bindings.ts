import type { Migration } from '../migration-runner';
import { TYPE_LIBRARY_BOOK_BINDINGS_SEMANTIC_BOUNDARIES } from './007_type_library_book_bindings_boundaries';

export const TYPE_LIBRARY_BOOK_BINDINGS_MIGRATION = {
  id: 7,
  name: 'type_library_book_bindings',
  up(database) {
    database.exec(`
      CREATE TABLE book_type_bindings (
        book_id TEXT PRIMARY KEY,
        type_library_version INTEGER NOT NULL,
        main_type_definition_id TEXT,
        main_type_definition_version_id TEXT,
        revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision > 0),
        updated_at TEXT NOT NULL CHECK (typeof(updated_at) = 'text' AND length(trim(updated_at)) > 0),
        CHECK (
          (main_type_definition_id IS NULL AND main_type_definition_version_id IS NULL)
          OR (main_type_definition_id IS NOT NULL AND main_type_definition_version_id IS NOT NULL)
        ),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (type_library_version) REFERENCES type_library_versions(version) ON DELETE RESTRICT,
        FOREIGN KEY (type_library_version, main_type_definition_id)
          REFERENCES type_library_version_entries(type_library_version, type_definition_id) ON DELETE RESTRICT,
        FOREIGN KEY (type_library_version, main_type_definition_version_id)
          REFERENCES type_library_version_entries(type_library_version, type_definition_version_id) ON DELETE RESTRICT,
        FOREIGN KEY (main_type_definition_id, main_type_definition_version_id)
          REFERENCES type_definition_versions(type_definition_id, id) ON DELETE RESTRICT
      );

      CREATE TABLE book_content_focus_bindings (
        book_id TEXT NOT NULL,
        priority INTEGER NOT NULL CHECK (typeof(priority) = 'integer' AND priority BETWEEN 1 AND 3),
        type_definition_id TEXT NOT NULL,
        type_definition_version_id TEXT NOT NULL,
        PRIMARY KEY (book_id, priority),
        UNIQUE (book_id, type_definition_id),
        UNIQUE (book_id, type_definition_version_id),
        FOREIGN KEY (book_id) REFERENCES book_type_bindings(book_id) ON DELETE CASCADE,
        FOREIGN KEY (type_definition_id, type_definition_version_id)
          REFERENCES type_definition_versions(type_definition_id, id) ON DELETE RESTRICT
      );

      CREATE TRIGGER book_type_bindings_initial_revision
      BEFORE INSERT ON book_type_bindings
      WHEN NEW.revision <> 1
      BEGIN
        SELECT RAISE(ABORT, 'first Book type binding revision must be 1');
      END;

      CREATE TRIGGER book_type_bindings_revision_increment
      BEFORE UPDATE ON book_type_bindings
      WHEN NEW.book_id <> OLD.book_id OR NEW.revision <> OLD.revision + 1
      BEGIN
        SELECT RAISE(ABORT, 'Book type binding revision must increment exactly once');
      END;

      CREATE TRIGGER book_type_bindings_no_direct_delete
      BEFORE DELETE ON book_type_bindings
      WHEN EXISTS (SELECT 1 FROM books WHERE id = OLD.book_id)
      BEGIN
        SELECT RAISE(ABORT, 'Book type bindings cannot return to revision 0');
      END;

      CREATE TRIGGER book_type_bindings_main_insert
      BEFORE INSERT ON book_type_bindings
      WHEN NEW.main_type_definition_id IS NOT NULL
        AND NEW.main_type_definition_version_id IS NOT NULL
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM type_library_version_entries
          WHERE type_library_version = NEW.type_library_version
            AND type_definition_id = NEW.main_type_definition_id
            AND type_definition_version_id = NEW.main_type_definition_version_id
            AND kind = 'main_type'
        ) THEN RAISE(ABORT, 'selected MainType is not in the pinned release') END;
      END;

      CREATE TRIGGER book_type_bindings_main_update
      BEFORE UPDATE ON book_type_bindings
      WHEN NEW.main_type_definition_id IS NOT NULL
        AND NEW.main_type_definition_version_id IS NOT NULL
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM type_library_version_entries
          WHERE type_library_version = NEW.type_library_version
            AND type_definition_id = NEW.main_type_definition_id
            AND type_definition_version_id = NEW.main_type_definition_version_id
            AND kind = 'main_type'
        ) THEN RAISE(ABORT, 'selected MainType is not in the pinned release') END;
      END;

      CREATE TRIGGER book_type_bindings_focuses_update
      BEFORE UPDATE OF type_library_version ON book_type_bindings
      BEGIN
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM book_content_focus_bindings AS focus
          WHERE focus.book_id = OLD.book_id
            AND NOT EXISTS (
              SELECT 1 FROM type_library_version_entries AS entry
              WHERE entry.type_library_version = NEW.type_library_version
                AND entry.type_definition_id = focus.type_definition_id
                AND entry.type_definition_version_id = focus.type_definition_version_id
                AND entry.kind = 'content_focus'
            )
        ) THEN RAISE(ABORT, 'existing ContentFocus is not in the new pinned release') END;
      END;

      CREATE TRIGGER book_content_focus_bindings_insert
      BEFORE INSERT ON book_content_focus_bindings
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1
          FROM book_type_bindings AS binding
          JOIN type_library_version_entries AS entry
            ON entry.type_library_version = binding.type_library_version
          WHERE binding.book_id = NEW.book_id
            AND entry.type_definition_id = NEW.type_definition_id
            AND entry.type_definition_version_id = NEW.type_definition_version_id
            AND entry.kind = 'content_focus'
        ) THEN RAISE(ABORT, 'selected ContentFocus is not in the pinned release') END;
      END;

      CREATE TRIGGER book_content_focus_bindings_update
      BEFORE UPDATE ON book_content_focus_bindings
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1
          FROM book_type_bindings AS binding
          JOIN type_library_version_entries AS entry
            ON entry.type_library_version = binding.type_library_version
          WHERE binding.book_id = NEW.book_id
            AND entry.type_definition_id = NEW.type_definition_id
            AND entry.type_definition_version_id = NEW.type_definition_version_id
            AND entry.kind = 'content_focus'
        ) THEN RAISE(ABORT, 'selected ContentFocus is not in the pinned release') END;
      END;
    `);
  },
  semanticWitnesses: [
    {
      id: '007.type_library_binding.focus_unique_per_book',
      migrationId: 7,
      setupSql: `
        INSERT INTO books (id, title, created_at, updated_at) VALUES ('book', 'Book', '2026-07-17', '2026-07-17');
        INSERT INTO type_definitions VALUES ('focus', 'content_focus', 'built_in', 'focus', NULL);
        INSERT INTO type_definition_versions VALUES ('focus-v1', 'focus', 1, 'Focus', 'Focus', '2026-07-17');
        INSERT INTO type_library_versions VALUES (1, 1, '2026-07-17');
        INSERT INTO type_library_version_entries VALUES (1, 'focus', 'focus-v1', 'content_focus', 0);
        INSERT INTO book_type_bindings VALUES ('book', 1, NULL, NULL, 1, '2026-07-17');
        INSERT INTO book_content_focus_bindings VALUES ('book', 1, 'focus', 'focus-v1');
      `,
      sql: `INSERT INTO book_content_focus_bindings VALUES ('book', 2, 'focus', 'focus-v1')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
    {
      id: '007.type_library_binding.book_delete_cascade',
      migrationId: 7,
      setupSql: `
        INSERT INTO books (id, title, created_at, updated_at) VALUES ('book', 'Book', '2026-07-17', '2026-07-17');
        INSERT INTO type_library_versions VALUES (1, 1, '2026-07-17');
        INSERT INTO book_type_bindings VALUES ('book', 1, NULL, NULL, 1, '2026-07-17');
      `,
      sql: `DELETE FROM books WHERE id = 'book'`,
      expected: { outcome: 'accept' },
    },
  ],
  semanticBoundaries: TYPE_LIBRARY_BOOK_BINDINGS_SEMANTIC_BOUNDARIES,
} as const satisfies Migration;
