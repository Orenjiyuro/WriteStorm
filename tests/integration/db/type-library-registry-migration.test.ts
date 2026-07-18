import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  BUILT_IN_TYPE_OPTIONS_V1,
  TYPE_LIBRARY_VERSION_1,
} from '../../../src/shared/domain';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('TypeLibrary registry migration', () => {
  it('registers migration 006 and seeds the exact immutable V1 release', () => {
    const database = migratedDatabase();
    try {
      expect(APP_MIGRATIONS[5]).toMatchObject({ id: 6, name: 'type_library_registry' });
      expect(getCurrentSchemaVersion(database)).toBe(APP_MIGRATIONS.at(-1)?.id);

      expect(database.prepare(`
        SELECT id, kind, origin, stable_key AS stableKey, archived_at AS archivedAt
        FROM type_definitions ORDER BY id
      `).all()).toEqual(
        BUILT_IN_TYPE_OPTIONS_V1.map(({ definition }) => ({
          ...definition,
          archivedAt: null,
        })).sort((left, right) => left.id.localeCompare(right.id)),
      );

      expect(database.prepare(`
        SELECT id, type_definition_id AS typeDefinitionId, version,
          display_name AS displayName, selection_description AS selectionDescription,
          created_at AS createdAt
        FROM type_definition_versions ORDER BY id
      `).all()).toEqual(
        BUILT_IN_TYPE_OPTIONS_V1.map(({ definitionVersion }) => definitionVersion)
          .sort((left, right) => left.id.localeCompare(right.id)),
      );

      expect(database.prepare(`
        SELECT version, entry_count AS entryCount, created_at AS createdAt
        FROM type_library_versions ORDER BY version
      `).all()).toEqual([{
        version: TYPE_LIBRARY_VERSION_1.version,
        entryCount: TYPE_LIBRARY_VERSION_1.entries.length,
        createdAt: TYPE_LIBRARY_VERSION_1.createdAt,
      }]);

      expect(database.prepare(`
        SELECT type_definition_id AS typeDefinitionId,
          type_definition_version_id AS typeDefinitionVersionId,
          kind, sort_order AS sortOrder
        FROM type_library_version_entries
        WHERE type_library_version = 1
        ORDER BY kind DESC, sort_order
      `).all()).toEqual(
        [...TYPE_LIBRARY_VERSION_1.entries].sort((left, right) =>
          right.kind.localeCompare(left.kind) || left.sortOrder - right.sortOrder),
      );
    } finally {
      database.close();
    }
  });

  it('replays the registry without duplicating seed facts', () => {
    const database = migratedDatabase();
    try {
      runMigrations(database, APP_MIGRATIONS);
      expect(database.prepare('SELECT COUNT(*) FROM type_definitions').pluck().get()).toBe(14);
      expect(database.prepare('SELECT COUNT(*) FROM type_definition_versions').pluck().get()).toBe(14);
      expect(database.prepare('SELECT COUNT(*) FROM type_library_versions').pluck().get()).toBe(1);
      expect(database.prepare('SELECT COUNT(*) FROM type_library_version_entries').pluck().get()).toBe(14);
    } finally {
      database.close();
    }
  });

  it('enforces identity, version, release membership, and per-kind order', () => {
    const database = migratedDatabase();
    try {
      expect(() => database.prepare(`
        INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('bad-kind', 'genre', 'built_in', 'bad-kind')
      `).run()).toThrow();
      expect(() => database.prepare(`
        INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('user-type', 'main_type', 'user_defined', 'claimed-key')
      `).run()).toThrow();
      expect(() => database.prepare(`
        INSERT INTO type_definition_versions (
          id, type_definition_id, version, display_name, selection_description, created_at
        ) VALUES ('bad-version', 'builtin_main_001', 0, 'Bad', 'Bad', '2026-07-17T00:00:00.000Z')
      `).run()).toThrow();
      expect(() => database.prepare(`
        INSERT INTO type_library_versions (version, entry_count, created_at)
        VALUES (0, 1, '2026-07-17T00:00:00.000Z')
      `).run()).toThrow();
      expect(() => database.prepare(`
        INSERT INTO type_library_version_entries (
          type_library_version, type_definition_id, type_definition_version_id, kind, sort_order
        ) VALUES (1, 'builtin_main_001', 'builtin_focus_001_v1', 'main_type', 7)
      `).run()).toThrow();
    } finally {
      database.close();
    }
  });

  it('permits archive retirement but rejects mutation or deletion of immutable facts', () => {
    const database = migratedDatabase();
    try {
      expect(() => database.prepare(`
        UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z'
        WHERE id = 'builtin_main_001'
      `).run()).not.toThrow();
      expect(() => database.prepare(`
        UPDATE type_definitions SET archived_at = NULL
        WHERE id = 'builtin_main_001'
      `).run()).toThrow();
      expect(() => database.prepare(`
        UPDATE type_definitions SET archived_at = '2026-07-19T00:00:00.000Z'
        WHERE id = 'builtin_main_001'
      `).run()).toThrow();
      expect(database.prepare(`
        SELECT archived_at FROM type_definitions WHERE id = 'builtin_main_001'
      `).pluck().get()).toBe('2026-07-18T00:00:00.000Z');
      expect(() => database.prepare(`
        UPDATE type_definitions SET kind = 'content_focus'
        WHERE id = 'builtin_main_001'
      `).run()).toThrow();
      expect(() => database.prepare(`
        UPDATE type_definition_versions SET display_name = 'Changed'
        WHERE id = 'builtin_main_001_v1'
      `).run()).toThrow();
      expect(() => database.prepare(`
        DELETE FROM type_definition_versions WHERE id = 'builtin_main_001_v1'
      `).run()).toThrow();
      expect(() => database.prepare(`
        UPDATE type_library_versions SET created_at = '2026-07-18T00:00:00.000Z'
        WHERE version = 1
      `).run()).toThrow();
      expect(() => database.prepare('DELETE FROM type_library_versions WHERE version = 1').run())
        .toThrow();
      expect(() => database.prepare(`
        UPDATE type_library_version_entries SET sort_order = 99
        WHERE type_library_version = 1 AND type_definition_id = 'builtin_main_001'
      `).run()).toThrow();
      expect(() => database.prepare(`
        DELETE FROM type_library_version_entries
        WHERE type_library_version = 1 AND type_definition_id = 'builtin_main_001'
      `).run()).toThrow();
    } finally {
      database.close();
    }
  });

  it('seals a published release at its declared entry count', () => {
    const database = migratedDatabase();
    try {
      database.prepare(`
        INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('extra-main', 'main_type', 'user_defined', NULL)
      `).run();
      database.prepare(`
        INSERT INTO type_definition_versions (
          id, type_definition_id, version, display_name, selection_description, created_at
        ) VALUES ('extra-main-v1', 'extra-main', 1, 'Extra', 'Extra', '2026-07-17T00:00:00.000Z')
      `).run();
      expect(() => database.prepare(`
        INSERT INTO type_library_version_entries (
          type_library_version, type_definition_id, type_definition_version_id, kind, sort_order
        ) VALUES (1, 'extra-main', 'extra-main-v1', 'main_type', 7)
      `).run()).toThrow();
      expect(database.prepare(`
        SELECT COUNT(*) FROM type_library_version_entries WHERE type_library_version = 1
      `).pluck().get()).toBe(14);
    } finally {
      database.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-type-library-registry-'));
  tempDirs.push(tempDir);
  const database = openSqliteDatabase(path.join(tempDir, 'writestorm.sqlite'));
  runMigrations(database, APP_MIGRATIONS);
  return database;
}
