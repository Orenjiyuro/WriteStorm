import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import {
  getCurrentSchemaVersion,
  runMigrations,
} from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('WriteStorm app schema migrations', () => {
  it('creates the Task 6.4 foundation schema tables and relationships', () => {
    const db = migratedDatabase();

    try {
      expect(getCurrentSchemaVersion(db)).toBeGreaterThanOrEqual(1);
      expect(tableNames(db)).toEqual(expect.arrayContaining([
        'library',
        'books',
        'source_texts',
        'structure_nodes',
        'story_segment_ranges',
        'jobs',
        'exports',
      ]));

      expect(columnNames(db, 'library')).toEqual(expect.arrayContaining([
        'id',
        'name',
        'app_version',
        'created_at',
        'updated_at',
      ]));

      expect(columnNames(db, 'books')).toEqual(expect.arrayContaining([
        'id',
        'title',
        'source_text_id',
        'lifecycle_state',
        'structure_edition',
        'analysis_revision',
      ]));
      expect(foreignKeys(db, 'books')).toContainEqual({
        from: 'source_text_id',
        table: 'source_texts',
        to: 'id',
      });

      expect(columnNames(db, 'source_texts')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'format',
        'content_hash',
        'encoding',
        'source_edition',
        'relative_path',
      ]));
      expect(foreignKeys(db, 'source_texts')).toContainEqual({
        from: 'book_id',
        table: 'books',
        to: 'id',
      });

      expect(columnNames(db, 'structure_nodes')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_text_id',
        'kind',
        'title',
        'parent_id',
        'sort_order',
        'start_offset',
        'end_offset',
        'structure_edition',
      ]));
      expect(foreignKeys(db, 'structure_nodes')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'source_text_id', table: 'source_texts', to: 'id' },
        { from: 'parent_id', table: 'structure_nodes', to: 'id' },
      ]));

      expect(columnNames(db, 'story_segment_ranges')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_text_id',
        'label',
        'scope_json',
        'covered_chapter_ids_json',
        'structure_edition',
      ]));
      expect(columnNames(db, 'story_segment_ranges')).not.toContain('parent_id');
      expect(foreignKeys(db, 'story_segment_ranges')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'source_text_id', table: 'source_texts', to: 'id' },
      ]));

      expect(columnNames(db, 'jobs')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'type',
        'state',
        'payload_json',
        'error_json',
        'created_at',
        'updated_at',
      ]));
      expect(foreignKeys(db, 'jobs')).toContainEqual({
        from: 'book_id',
        table: 'books',
        to: 'id',
      });

      expect(columnNames(db, 'exports')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'status',
        'format',
        'output_relative_path',
        'blocked_reason',
        'latest_job_id',
      ]));
      expect(foreignKeys(db, 'exports')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'latest_job_id', table: 'jobs', to: 'id' },
      ]));
    } finally {
      db.close();
    }
  });

  it('creates the Task 6.5 content model shell tables without collapsing domain boundaries', () => {
    const db = migratedDatabase();

    try {
      expect(getCurrentSchemaVersion(db)).toBeGreaterThanOrEqual(2);
      expect(tableNames(db)).toEqual(expect.arrayContaining([
        'analysis_modules',
        'analysis_module_instances',
        'evidence_anchors',
        'relation_links',
        'work_technique_observations',
        'reusable_technique_candidates',
        'technique_entries',
        'source_snapshots',
        'perspective_views',
      ]));

      expect(columnNames(db, 'analysis_modules')).toEqual(expect.arrayContaining([
        'id',
        'module_key',
        'label',
        'category',
        'definition_json',
      ]));

      expect(columnNames(db, 'analysis_module_instances')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'module_id',
        'scope_json',
        'status',
        'body_markdown',
        'structured_payload_json',
        'analysis_revision',
      ]));
      expect(foreignKeys(db, 'analysis_module_instances')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'module_id', table: 'analysis_modules', to: 'id' },
      ]));

      expect(columnNames(db, 'evidence_anchors')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_text_id',
        'source_module_instance_id',
        'anchor_kind',
        'status',
        'selector_json',
      ]));
      expect(columnNames(db, 'relation_links')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_module_instance_id',
        'from_ref_json',
        'to_ref_json',
        'relation_type',
        'link_mode',
      ]));

      expect(columnNames(db, 'work_technique_observations')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_module_instance_id',
        'evidence_anchor_ids_json',
        'content_json',
      ]));
      expect(columnNames(db, 'reusable_technique_candidates')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'source_observation_ids_json',
        'evidence_anchor_ids_json',
        'status',
        'content_json',
      ]));
      expect(columnNames(db, 'technique_entries')).toEqual(expect.arrayContaining([
        'id',
        'source_snapshot_id',
        'status',
        'content_json',
      ]));
      expect(columnNames(db, 'technique_entries')).not.toContain('source_candidate_id');
      expect(columnNames(db, 'technique_entries')).not.toContain('evidence_anchor_ids_json');
      expect(columnNames(db, 'reusable_technique_candidates')).not.toContain('source_snapshot_id');
      expect(foreignKeys(db, 'technique_entries')).toContainEqual({
        from: 'source_snapshot_id',
        table: 'source_snapshots',
        to: 'id',
      });
      expect(foreignKeys(db, 'technique_entries')).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ table: 'reusable_technique_candidates' }),
      ]));

      expect(columnNames(db, 'source_snapshots')).toEqual(expect.arrayContaining([
        'id',
        'source_book_id',
        'source_candidate_id',
        'source_observation_ids_json',
        'captured_at',
        'summary_json',
        'evidence_summary_json',
        'traceability',
      ]));

      expect(columnNames(db, 'perspective_views')).toEqual(expect.arrayContaining([
        'id',
        'book_id',
        'perspective_key',
        'scope_json',
        'status',
        'source_revision_snapshot_json',
        'view_json',
        'user_notes_json',
      ]));
      expect(columnNames(db, 'perspective_views')).not.toContain('module_id');
      expect(columnNames(db, 'perspective_views')).not.toContain('analysis_module_instance_id');
      expect(foreignKeys(db, 'perspective_views')).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ table: 'analysis_module_instances' }),
      ]));

      expect(foreignKeys(db, 'relation_links')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'source_module_instance_id', table: 'analysis_module_instances', to: 'id' },
      ]));
      expect(foreignKeys(db, 'evidence_anchors')).toEqual(expect.arrayContaining([
        { from: 'book_id', table: 'books', to: 'id' },
        { from: 'source_text_id', table: 'source_texts', to: 'id' },
        { from: 'source_module_instance_id', table: 'analysis_module_instances', to: 'id' },
      ]));
    } finally {
      db.close();
    }
  });

  it('creates the Task 7.2 source import metadata schema without implementing import writes', () => {
    const db = migratedDatabase();

    try {
      expect(getCurrentSchemaVersion(db)).toBeGreaterThanOrEqual(3);
      expect(columnNames(db, 'source_texts')).toEqual(expect.arrayContaining([
        'original_file_name',
        'size_bytes',
      ]));
      expect(indexNames(db, 'source_texts')).toEqual(expect.arrayContaining([
        'idx_source_texts_content_hash',
      ]));
      expect(columnDefaultValue(db, 'source_texts', 'original_file_name')).toBeNull();
      expect(columnDefaultValue(db, 'source_texts', 'size_bytes')).toBeNull();
    } finally {
      db.close();
    }
  });

  it('rejects source_text rows without valid import metadata', () => {
    const db = migratedDatabase();

    try {
      insertBook(db);

      expect(() => insertSourceText(db, {})).toThrow(/source_texts import metadata/i);
      expect(() => insertSourceText(db, {
        originalFileName: '',
        sizeBytes: 120,
      })).toThrow(/source_texts import metadata/i);
      expect(() => insertSourceText(db, {
        originalFileName: 'example.md',
        sizeBytes: 0,
      })).toThrow(/source_texts import metadata/i);
      expect(() => insertSourceText(db, {
        originalFileName: 'example.md',
        sizeBytes: 120,
      })).not.toThrow();
    } finally {
      db.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const db = openSqliteDatabase(tempDatabasePath());
  runMigrations(db, APP_MIGRATIONS);

  return db;
}

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-app-schema-'));
  tempDirs.push(tempDir);

  return path.join(tempDir, 'writestorm.sqlite');
}

function tableNames(db: SqliteDatabase): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .pluck()
    .all() as string[];
}

function columnNames(db: SqliteDatabase, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>)
    .map((column) => column.name);
}

function foreignKeys(db: SqliteDatabase, tableName: string): Array<{
  from: string;
  table: string;
  to: string;
}> {
  return (db.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as Array<{
    from: string;
    table: string;
    to: string;
  }>).map((foreignKey) => ({
    from: foreignKey.from,
    table: foreignKey.table,
    to: foreignKey.to,
  }));
}

function indexNames(db: SqliteDatabase, tableName: string): string[] {
  return (db.prepare(`PRAGMA index_list(${tableName})`).all() as Array<{ name: string }>)
    .map((index) => index.name);
}

function columnDefaultValue(
  db: SqliteDatabase,
  tableName: string,
  columnName: string,
): string | number | null {
  const column = (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
    dflt_value: string | number | null;
  }>).find((candidate) => candidate.name === columnName);

  if (!column) {
    throw new Error(`Column ${tableName}.${columnName} does not exist.`);
  }

  return column.dflt_value;
}

function insertBook(db: SqliteDatabase): void {
  db.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', '2026-07-09T00:00:00.000Z', '2026-07-09T00:00:00.000Z')
  `).run();
}

function insertSourceText(
  db: SqliteDatabase,
  metadata: {
    originalFileName?: string;
    sizeBytes?: number;
  },
): void {
  const columns = [
    'id',
    'book_id',
    'format',
    'content_hash',
    'encoding',
    'relative_path',
    'imported_at',
  ];
  const values: unknown[] = [
    `source-${Math.random()}`,
    'book-1',
    'md',
    `sha256:${Math.random()}`,
    'utf-8',
    'sources/example.md',
    '2026-07-09T00:00:00.000Z',
  ];

  if (metadata.originalFileName !== undefined) {
    columns.push('original_file_name');
    values.push(metadata.originalFileName);
  }

  if (metadata.sizeBytes !== undefined) {
    columns.push('size_bytes');
    values.push(metadata.sizeBytes);
  }

  const placeholders = columns.map(() => '?').join(', ');

  db.prepare(`
    INSERT INTO source_texts (${columns.join(', ')})
    VALUES (${placeholders})
  `).run(...values);
}
