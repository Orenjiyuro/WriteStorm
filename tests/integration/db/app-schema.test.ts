import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { WRITESTORM_SCHEMA_EPOCH, WRITESTORM_SQLITE_APPLICATION_ID } from '../../../src/main/db/schema-identity';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';

const tempDirs: string[] = [];
afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('V1 runtime baseline', () => {
  it('admits only runtime-owned tables and freezes SQLite identity', () => {
    const db = migratedDatabase();
    try {
      expect(tableNames(db)).toEqual([
        'books', 'job_checkpoints', 'jobs', 'library', 'schema_migrations', 'source_texts',
      ]);
      expect(getCurrentSchemaVersion(db)).toBe(1);
      expect(db.pragma('application_id', { simple: true })).toBe(WRITESTORM_SQLITE_APPLICATION_ID);
      expect(columnDefault(db, 'library', 'schema_epoch')).toBe(String(WRITESTORM_SCHEMA_EPOCH));
      expect(tableNames(db)).not.toContain('analysis_module_instances');
      expect(tableNames(db)).not.toContain('structure_nodes');
    } finally {
      db.close();
    }
  });

  it('enforces Book, SourceText, Job, and checkpoint invariants', () => {
    const db = migratedDatabase();
    try {
      expect(columns(db, 'books')).toContain('current_source_text_id');
      expect(columns(db, 'jobs')).toEqual(expect.arrayContaining([
        'kind', 'completed_units', 'total_units', 'payload_schema_version', 'error_code', 'error_details_json',
      ]));
      expect(columns(db, 'job_checkpoints')).toEqual(expect.arrayContaining([
        'job_id', 'sequence', 'kind', 'payload_schema_version', 'payload_json',
      ]));
      expect(uniqueIndexes(db, 'source_texts')).toEqual(expect.arrayContaining([
        ['book_id', 'source_edition'], ['content_hash'],
      ]));
      expect(uniqueIndexes(db, 'job_checkpoints')).toContainEqual(['job_id', 'sequence']);
    } finally {
      db.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-v1-baseline-'));
  tempDirs.push(tempDir);
  const db = openSqliteDatabase(path.join(tempDir, 'writestorm.sqlite'));
  runMigrations(db, APP_MIGRATIONS);
  return db;
}

function tableNames(db: SqliteDatabase): string[] {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all() as string[];
}

function columns(db: SqliteDatabase, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(({ name }) => name);
}

function columnDefault(db: SqliteDatabase, table: string, column: string): string | null {
  const row = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; dflt_value: string | null }>).find(({ name }) => name === column);
  return row?.dflt_value ?? null;
}

function uniqueIndexes(db: SqliteDatabase, table: string): string[][] {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string; unique: number }>;
  return indexes.filter(({ unique }) => unique === 1).map(({ name }) =>
    (db.prepare(`PRAGMA index_info(${name})`).all() as Array<{ name: string }>).map((column) => column.name),
  );
}
