import type { SchemaSemanticBoundary } from '../schema-semantic-witness';

const mainDefinition = `INSERT INTO type_definitions (id, kind, origin, stable_key)
  VALUES ('main', 'main_type', 'built_in', 'main')`;
const focusDefinition = `INSERT INTO type_definitions (id, kind, origin, stable_key)
  VALUES ('focus', 'content_focus', 'built_in', 'focus')`;
const mainVersion = `INSERT INTO type_definition_versions (
    id, type_definition_id, version, display_name, selection_description, created_at
  ) VALUES ('main-v1', 'main', 1, 'Main', 'Main description', '2026-07-17T00:00:00.000Z')`;
const focusVersion = `INSERT INTO type_definition_versions (
    id, type_definition_id, version, display_name, selection_description, created_at
  ) VALUES ('focus-v1', 'focus', 1, 'Focus', 'Focus description', '2026-07-17T00:00:00.000Z')`;
const release = `INSERT INTO type_library_versions (version, entry_count, created_at)
  VALUES (1, 2, '2026-07-17T00:00:00.000Z')`;

function boundary(
  id: string,
  kind: SchemaSemanticBoundary['kind'],
  accept: SchemaSemanticBoundary['accept'],
  reject: SchemaSemanticBoundary['reject'],
): SchemaSemanticBoundary {
  return { id: `006.type_library.${id}`, migrationId: 6, kind, accept, reject };
}

export const TYPE_LIBRARY_REGISTRY_SEMANTIC_BOUNDARIES = [
  boundary(
    'definition_kind',
    'check',
    { sql: mainDefinition },
    {
      sql: `INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('bad', 'genre', 'built_in', 'bad')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'definition_origin_key',
    'check',
    {
      sql: `INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('user-main', 'main_type', 'user_defined', NULL)`,
    },
    {
      sql: `INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('user-main', 'main_type', 'user_defined', 'claimed')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'built_in_identity',
    'check',
    { sql: mainDefinition },
    {
      sql: `INSERT INTO type_definitions (id, kind, origin, stable_key)
        VALUES ('identity', 'main_type', 'built_in', 'different-key')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'archive_non_blank',
    'check',
    { setupSql: mainDefinition, sql: `UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'` },
    { setupSql: mainDefinition, sql: `UPDATE type_definitions SET archived_at = ' ' WHERE id = 'main'`, code: 'SQLITE_CONSTRAINT_CHECK' },
  ),
  boundary(
    'archive_no_unarchive',
    'trigger',
    {
      setupSql: mainDefinition,
      sql: `UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'`,
    },
    {
      setupSql: `${mainDefinition}; UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'`,
      sql: `UPDATE type_definitions SET archived_at = NULL WHERE id = 'main'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'archive_no_rewrite',
    'trigger',
    {
      setupSql: mainDefinition,
      sql: `UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'`,
    },
    {
      setupSql: `${mainDefinition}; UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'`,
      sql: `UPDATE type_definitions SET archived_at = '2026-07-19T00:00:00.000Z' WHERE id = 'main'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'definition_version_positive',
    'check',
    { setupSql: mainDefinition, sql: mainVersion },
    {
      setupSql: mainDefinition,
      sql: `INSERT INTO type_definition_versions (
        id, type_definition_id, version, display_name, selection_description, created_at
      ) VALUES ('main-v0', 'main', 0, 'Main', 'Main description', '2026-07-17T00:00:00.000Z')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'definition_version_copy',
    'check',
    { setupSql: mainDefinition, sql: mainVersion },
    {
      setupSql: mainDefinition,
      sql: `INSERT INTO type_definition_versions (
        id, type_definition_id, version, display_name, selection_description, created_at
      ) VALUES ('main-v1', 'main', 1, ' ', 'Main description', '2026-07-17T00:00:00.000Z')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'release_positive',
    'check',
    { sql: release },
    {
      sql: `INSERT INTO type_library_versions (version, entry_count, created_at)
        VALUES (0, 1, '2026-07-17T00:00:00.000Z')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'release_entry_count',
    'check',
    { sql: release },
    {
      sql: `INSERT INTO type_library_versions (version, entry_count, created_at)
        VALUES (1, 0, '2026-07-17T00:00:00.000Z')`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'entry_kind_matches_definition',
    'check',
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'content_focus', 0)`,
      code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
    },
  ),
  boundary(
    'entry_version_matches_definition',
    'check',
    {
      setupSql: `${mainDefinition}; ${focusDefinition}; ${mainVersion}; ${focusVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${focusDefinition}; ${mainVersion}; ${focusVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'focus-v1', 'main_type', 0)`,
      code: 'SQLITE_CONSTRAINT_FOREIGNKEY',
    },
  ),
  boundary(
    'entry_sort_order',
    'check',
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', -1)`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  ),
  boundary(
    'definition_identity_immutable',
    'trigger',
    { setupSql: mainDefinition, sql: `UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'` },
    { setupSql: mainDefinition, sql: `UPDATE type_definitions SET kind = 'content_focus' WHERE id = 'main'`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'definition_no_delete',
    'trigger',
    { setupSql: mainDefinition, sql: `UPDATE type_definitions SET archived_at = '2026-07-18T00:00:00.000Z' WHERE id = 'main'` },
    { setupSql: mainDefinition, sql: `DELETE FROM type_definitions WHERE id = 'main'`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'definition_version_immutable',
    'trigger',
    {
      setupSql: `${mainDefinition}; ${mainVersion}`,
      sql: `INSERT INTO type_definition_versions (
        id, type_definition_id, version, display_name, selection_description, created_at
      ) VALUES ('main-v2', 'main', 2, 'Main 2', 'Main description 2', '2026-07-18T00:00:00.000Z')`,
    },
    { setupSql: `${mainDefinition}; ${mainVersion}`, sql: `UPDATE type_definition_versions SET display_name = 'Changed' WHERE id = 'main-v1'`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'definition_version_no_delete',
    'trigger',
    {
      setupSql: `${mainDefinition}; ${mainVersion}`,
      sql: `INSERT INTO type_definition_versions (
        id, type_definition_id, version, display_name, selection_description, created_at
      ) VALUES ('main-v2', 'main', 2, 'Main 2', 'Main description 2', '2026-07-18T00:00:00.000Z')`,
    },
    { setupSql: `${mainDefinition}; ${mainVersion}`, sql: `DELETE FROM type_definition_versions WHERE id = 'main-v1'`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'release_immutable',
    'trigger',
    { setupSql: release, sql: `INSERT INTO type_library_versions VALUES (2, 1, '2026-07-18T00:00:00.000Z')` },
    { setupSql: release, sql: `DELETE FROM type_library_versions WHERE version = 1`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'release_no_update',
    'trigger',
    { setupSql: release, sql: `INSERT INTO type_library_versions VALUES (2, 1, '2026-07-18T00:00:00.000Z')` },
    { setupSql: release, sql: `UPDATE type_library_versions SET created_at = '2026-07-18T00:00:00.000Z' WHERE version = 1`, code: 'SQLITE_CONSTRAINT_TRIGGER' },
  ),
  boundary(
    'release_entry_immutable',
    'trigger',
    {
      setupSql: `${mainDefinition}; ${focusDefinition}; ${mainVersion}; ${focusVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}; INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
      sql: `DELETE FROM type_library_version_entries WHERE type_library_version = 1 AND type_definition_id = 'main'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'release_entry_no_update',
    'trigger',
    {
      setupSql: `${mainDefinition}; ${focusDefinition}; ${mainVersion}; ${focusVersion}; ${release}`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${mainVersion}; ${release}; INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
      sql: `UPDATE type_library_version_entries SET sort_order = 1 WHERE type_library_version = 1 AND type_definition_id = 'main'`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
  boundary(
    'release_entry_capacity',
    'trigger',
    {
      setupSql: `${mainDefinition}; ${mainVersion}; INSERT INTO type_library_versions VALUES (1, 1, '2026-07-17T00:00:00.000Z')`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
    },
    {
      setupSql: `${mainDefinition}; ${focusDefinition}; ${mainVersion}; ${focusVersion}; INSERT INTO type_library_versions VALUES (1, 1, '2026-07-17T00:00:00.000Z'); INSERT INTO type_library_version_entries VALUES (1, 'main', 'main-v1', 'main_type', 0)`,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'focus', 'focus-v1', 'content_focus', 0)`,
      code: 'SQLITE_CONSTRAINT_TRIGGER',
    },
  ),
] as const satisfies readonly SchemaSemanticBoundary[];
