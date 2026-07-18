import type {
  BookClassificationTarget,
  BookTypeBindingDetail,
  BookTypeBindingRead,
  BreakdownBookId,
  ContentFocusVersionReference,
  TypeDefinitionKind,
  TypeDefinitionVersionReference,
  TypeLibraryReleaseOptions,
} from '../../shared/domain';
import {
  bookClassificationTargetSchema,
  bookTypeBindingDetailSchema,
  bookTypeBindingReadSchema,
  typeLibraryReleaseOptionsSchema,
} from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type TypeLibraryRepositoryErrorReason =
  | 'type_library_version_unavailable'
  | 'revision_conflict'
  | 'invalid_persisted_book_type_binding';

export class TypeLibraryRepositoryError extends Error {
  constructor(
    readonly reason: TypeLibraryRepositoryErrorReason,
    readonly recordId: string,
  ) {
    super(`${reason}: ${recordId}`);
    this.name = 'TypeLibraryRepositoryError';
  }
}

type ReleaseHeaderRow = {
  readonly version: unknown;
  readonly entryCount: unknown;
};

type BookBindingRow = {
  readonly bookId: unknown;
  readonly typeLibraryVersion: unknown;
  readonly mainTypeDefinitionId: unknown;
  readonly mainTypeDefinitionVersionId: unknown;
  readonly revision: unknown;
  readonly updatedAt: unknown;
};

type PinnedOptionRow = {
  readonly typeDefinitionId: unknown;
  readonly typeDefinitionVersionId: unknown;
  readonly kind: unknown;
  readonly origin: unknown;
  readonly stableKey: unknown;
  readonly displayName: unknown;
  readonly selectionDescription: unknown;
  readonly archivedAt: unknown;
};

export type TypeDefinitionVersionState = {
  readonly kind: TypeDefinitionKind;
  readonly archived: boolean;
};

export type ReplaceBookTypeBindingInput = {
  readonly bookId: BreakdownBookId;
  readonly expectedRevision: number;
  readonly typeLibraryVersion: number;
  readonly mainType: TypeDefinitionVersionReference | null;
  readonly contentFocuses: readonly Omit<ContentFocusVersionReference, 'priority'>[];
  readonly updatedAt: string;
};

export class TypeLibraryRepository {
  listReleaseOptions(database: SqliteDatabase, version?: number): TypeLibraryReleaseOptions {
    const header = (version === undefined
      ? database.prepare(`
          SELECT version, entry_count AS entryCount
          FROM type_library_versions ORDER BY version DESC LIMIT 1
        `).get()
      : database.prepare(`
          SELECT version, entry_count AS entryCount
          FROM type_library_versions WHERE version = ?
        `).get(version)) as ReleaseHeaderRow | undefined;

    if (!header || typeof header.version !== 'number' || typeof header.entryCount !== 'number') {
      throw new TypeLibraryRepositoryError(
        'type_library_version_unavailable',
        String(version ?? 'latest'),
      );
    }

    const membershipCount = database.prepare(`
      SELECT COUNT(*) FROM type_library_version_entries WHERE type_library_version = ?
    `).pluck().get(header.version);
    if (membershipCount !== header.entryCount) {
      throw new TypeLibraryRepositoryError(
        'type_library_version_unavailable',
        String(header.version),
      );
    }

    const options = database.prepare(`
      SELECT
        entry.type_definition_id AS typeDefinitionId,
        entry.type_definition_version_id AS typeDefinitionVersionId,
        entry.kind AS kind,
        definition.origin AS origin,
        definition.stable_key AS stableKey,
        definition_version.display_name AS displayName,
        definition_version.selection_description AS selectionDescription,
        ROW_NUMBER() OVER (
          PARTITION BY entry.kind
          ORDER BY entry.sort_order ASC, entry.type_definition_id ASC
        ) - 1 AS sortOrder
      FROM type_library_version_entries AS entry
      INNER JOIN type_definitions AS definition
        ON definition.id = entry.type_definition_id
      INNER JOIN type_definition_versions AS definition_version
        ON definition_version.id = entry.type_definition_version_id
        AND definition_version.type_definition_id = entry.type_definition_id
      WHERE entry.type_library_version = ?
        AND definition.archived_at IS NULL
      ORDER BY
        CASE entry.kind WHEN 'main_type' THEN 0 ELSE 1 END ASC,
        entry.sort_order ASC,
        entry.type_definition_id ASC
    `).all(header.version);

    const parsed = typeLibraryReleaseOptionsSchema.safeParse({
      version: header.version,
      options,
    });
    if (!parsed.success) {
      throw new TypeLibraryRepositoryError(
        'type_library_version_unavailable',
        String(header.version),
      );
    }
    return parsed.data;
  }

  getBookBinding(
    database: SqliteDatabase,
    bookId: BreakdownBookId,
  ): BookTypeBindingRead | null {
    const bookExists = database.prepare('SELECT 1 FROM books WHERE id = ?').pluck().get(bookId);
    if (bookExists !== 1) return null;

    const row = database.prepare(`
      SELECT
        book_id AS bookId,
        type_library_version AS typeLibraryVersion,
        main_type_definition_id AS mainTypeDefinitionId,
        main_type_definition_version_id AS mainTypeDefinitionVersionId,
        revision,
        updated_at AS updatedAt
      FROM book_type_bindings
      WHERE book_id = ?
    `).get(bookId) as BookBindingRow | undefined;

    if (!row) {
      const release = this.listReleaseOptions(database);
      return {
        bookId,
        typeLibraryVersion: release.version,
        revision: 0,
        mainType: null,
        contentFocuses: [],
        updatedAt: null,
      };
    }

    if (typeof row.typeLibraryVersion !== 'number') {
      throw new TypeLibraryRepositoryError('invalid_persisted_book_type_binding', String(bookId));
    }
    this.listReleaseOptions(database, row.typeLibraryVersion);

    const contentFocuses = database.prepare(`
      SELECT
        priority,
        type_definition_id AS typeDefinitionId,
        type_definition_version_id AS typeDefinitionVersionId
      FROM book_content_focus_bindings
      WHERE book_id = ?
      ORDER BY priority ASC
    `).all(bookId);

    const parsed = bookTypeBindingReadSchema.safeParse({
      bookId: row.bookId,
      typeLibraryVersion: row.typeLibraryVersion,
      revision: row.revision,
      mainType: row.mainTypeDefinitionId === null && row.mainTypeDefinitionVersionId === null
        ? null
        : {
            typeDefinitionId: row.mainTypeDefinitionId,
            typeDefinitionVersionId: row.mainTypeDefinitionVersionId,
          },
      contentFocuses,
      updatedAt: row.updatedAt,
    });
    if (!parsed.success) {
      throw new TypeLibraryRepositoryError('invalid_persisted_book_type_binding', String(bookId));
    }
    return parsed.data;
  }

  getBookBindingDetail(
    database: SqliteDatabase,
    bookId: BreakdownBookId,
  ): BookTypeBindingDetail | null {
    const binding = this.getBookBinding(database, bookId);
    if (!binding) return null;
    const release = this.listReleaseOptions(database, binding.typeLibraryVersion);
    const references = [
      ...(binding.mainType ? [{ ...binding.mainType, kind: 'main_type' as const }] : []),
      ...binding.contentFocuses.map((focus) => ({
        typeDefinitionId: focus.typeDefinitionId,
        typeDefinitionVersionId: focus.typeDefinitionVersionId,
        kind: 'content_focus' as const,
      })),
    ];
    const pinnedOptions = references.map((reference) => {
      const row = database.prepare(`
        SELECT
          definition.id AS typeDefinitionId,
          definition_version.id AS typeDefinitionVersionId,
          definition.kind AS kind,
          definition.origin AS origin,
          definition.stable_key AS stableKey,
          definition_version.display_name AS displayName,
          definition_version.selection_description AS selectionDescription,
          definition.archived_at AS archivedAt
        FROM type_definition_versions AS definition_version
        INNER JOIN type_definitions AS definition
          ON definition.id = definition_version.type_definition_id
        WHERE definition.id = ? AND definition_version.id = ?
      `).get(
        reference.typeDefinitionId,
        reference.typeDefinitionVersionId,
      ) as PinnedOptionRow | undefined;
      if (!row || row.kind !== reference.kind) {
        throw new TypeLibraryRepositoryError(
          'invalid_persisted_book_type_binding',
          String(bookId),
        );
      }
      const { archivedAt, ...option } = row;
      const availability = archivedAt === null ? 'current_selectable' : 'archived';
      if (availability === 'current_selectable' && !release.options.some((option) =>
        option.kind === reference.kind &&
        option.typeDefinitionId === reference.typeDefinitionId &&
        option.typeDefinitionVersionId === reference.typeDefinitionVersionId)) {
        throw new TypeLibraryRepositoryError(
          'invalid_persisted_book_type_binding',
          String(bookId),
        );
      }
      return { ...option, availability };
    });
    const parsed = bookTypeBindingDetailSchema.safeParse({ binding, pinnedOptions });
    if (!parsed.success) {
      throw new TypeLibraryRepositoryError(
        'invalid_persisted_book_type_binding',
        String(bookId),
      );
    }
    return parsed.data;
  }

  getDefinitionVersionState(
    database: SqliteDatabase,
    reference: TypeDefinitionVersionReference,
  ): TypeDefinitionVersionState | null {
    const row = database.prepare(`
      SELECT definition.kind AS kind, definition.archived_at AS archivedAt
      FROM type_definition_versions AS definition_version
      INNER JOIN type_definitions AS definition
        ON definition.id = definition_version.type_definition_id
      WHERE definition_version.type_definition_id = ?
        AND definition_version.id = ?
    `).get(
      reference.typeDefinitionId,
      reference.typeDefinitionVersionId,
    ) as { readonly kind: unknown; readonly archivedAt: unknown } | undefined;
    if (!row || (row.kind !== 'main_type' && row.kind !== 'content_focus')) return null;
    return { kind: row.kind, archived: row.archivedAt !== null };
  }

  replaceBookBinding(
    database: SqliteDatabase,
    input: ReplaceBookTypeBindingInput,
  ): BookClassificationTarget {
    return database.transaction(() => {
      if (input.expectedRevision === 0) {
        const inserted = database.prepare(`
          INSERT INTO book_type_bindings (
            book_id,
            type_library_version,
            main_type_definition_id,
            main_type_definition_version_id,
            revision,
            updated_at
          )
          SELECT ?, ?, ?, ?, 1, ?
          WHERE EXISTS (SELECT 1 FROM books WHERE id = ?)
            AND NOT EXISTS (SELECT 1 FROM book_type_bindings WHERE book_id = ?)
        `).run(
          input.bookId,
          input.typeLibraryVersion,
          input.mainType?.typeDefinitionId ?? null,
          input.mainType?.typeDefinitionVersionId ?? null,
          input.updatedAt,
          input.bookId,
          input.bookId,
        );
        if (inserted.changes !== 1) {
          throw new TypeLibraryRepositoryError('revision_conflict', String(input.bookId));
        }
      } else {
        database.prepare(`
          DELETE FROM book_content_focus_bindings
          WHERE book_id = ?
            AND EXISTS (
              SELECT 1 FROM book_type_bindings
              WHERE book_id = ? AND revision = ?
            )
        `).run(input.bookId, input.bookId, input.expectedRevision);

        const updated = database.prepare(`
          UPDATE book_type_bindings
          SET type_library_version = ?,
              main_type_definition_id = ?,
              main_type_definition_version_id = ?,
              revision = revision + 1,
              updated_at = ?
          WHERE book_id = ? AND revision = ?
        `).run(
          input.typeLibraryVersion,
          input.mainType?.typeDefinitionId ?? null,
          input.mainType?.typeDefinitionVersionId ?? null,
          input.updatedAt,
          input.bookId,
          input.expectedRevision,
        );
        if (updated.changes !== 1) {
          throw new TypeLibraryRepositoryError('revision_conflict', String(input.bookId));
        }
      }

      const insertFocus = database.prepare(`
        INSERT INTO book_content_focus_bindings (
          book_id,
          priority,
          type_definition_id,
          type_definition_version_id
        ) VALUES (?, ?, ?, ?)
      `);
      input.contentFocuses.forEach((focus, index) => {
        insertFocus.run(
          input.bookId,
          index + 1,
          focus.typeDefinitionId,
          focus.typeDefinitionVersionId,
        );
      });

      const binding = this.getBookBinding(database, input.bookId);
      const parsed = bookClassificationTargetSchema.safeParse(binding);
      if (!parsed.success) {
        throw new TypeLibraryRepositoryError(
          'invalid_persisted_book_type_binding',
          String(input.bookId),
        );
      }
      return parsed.data;
    })();
  }
}
