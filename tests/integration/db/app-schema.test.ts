import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import {
  WRITESTORM_SCHEMA_EPOCH,
  WRITESTORM_SQLITE_APPLICATION_ID,
} from '../../../src/main/db/schema-identity';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { JOB_STATES } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const PRODUCTION_TABLE_OWNERS = {
  schema_migrations: 'MigrationRunner',
  library: 'LibraryService',
  books: 'BookService',
  source_texts: 'SourceTextService',
  jobs: 'JobService',
  job_checkpoints: 'JobService',
  structure_detection_runs: 'StructureService',
  structure_sets: 'StructureService',
  structure_nodes: 'StructureService',
  story_segment_ranges: 'StructureService',
  story_segment_range_chapters: 'StructureService',
} as const;

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('V1 runtime baseline', () => {
  it('admits exactly the production owner map and freezes SQLite identity', () => {
    const db = migratedDatabase();
    try {
      expect(tableNames(db)).toEqual(Object.keys(PRODUCTION_TABLE_OWNERS).sort());
      expect(PRODUCTION_TABLE_OWNERS).toEqual({
        schema_migrations: 'MigrationRunner',
        library: 'LibraryService',
        books: 'BookService',
        source_texts: 'SourceTextService',
        jobs: 'JobService',
        job_checkpoints: 'JobService',
        structure_detection_runs: 'StructureService',
        structure_sets: 'StructureService',
        structure_nodes: 'StructureService',
        story_segment_ranges: 'StructureService',
        story_segment_range_chapters: 'StructureService',
      });
      expect(db.pragma('application_id', { simple: true })).toBe(0x5753544d);
      expect(WRITESTORM_SQLITE_APPLICATION_ID).toBe(0x5753544d);
      expect(columnDefault(db, 'library', 'schema_epoch')).toBe(String(WRITESTORM_SCHEMA_EPOCH));
      expect(WRITESTORM_SCHEMA_EPOCH).toBe(2);
    } finally {
      db.close();
    }
  });

  it('registers the V1 runtime baseline and Structure workspace', () => {
    const db = migratedDatabase();
    try {
      expect(APP_MIGRATIONS).toHaveLength(2);
      expect(APP_MIGRATIONS[0]).toMatchObject({ id: 1, name: 'v1_runtime_baseline' });
      expect(APP_MIGRATIONS[1]).toMatchObject({ id: 2, name: 'structure_workspace' });
      expect(getCurrentSchemaVersion(db)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('freezes runtime foreign keys including Book current-source ownership', () => {
    const db = migratedDatabase();
    try {
      expect(foreignKeys(db, 'books')).toEqual([
        { from: 'current_source_text_id', table: 'source_texts', to: 'id' },
        { from: 'id', table: 'source_texts', to: 'book_id' },
        { from: 'current_source_text_id', table: 'source_texts', to: 'id' },
      ]);
      expect(foreignKeys(db, 'source_texts')).toEqual([
        { from: 'book_id', table: 'books', to: 'id' },
      ]);
      expect(foreignKeys(db, 'jobs')).toEqual([
        { from: 'book_id', table: 'books', to: 'id' },
      ]);
      expect(foreignKeys(db, 'job_checkpoints')).toEqual([
        { from: 'job_id', table: 'jobs', to: 'id' },
      ]);
    } finally {
      db.close();
    }
  });

  it('enforces SourceText size, edition, content-hash, and per-Book edition constraints', () => {
    const db = migratedDatabase();
    try {
      insertBook(db, 'book-1');
      expect(() => insertSourceText(db, { id: 'size-zero', sizeBytes: 0 })).toThrow();
      expect(() => insertSourceText(db, { id: 'size-negative', sizeBytes: -1 })).toThrow();
      expect(() => insertSourceText(db, { id: 'edition-zero', sourceEdition: 0 })).toThrow();

      insertSourceText(db, { id: 'source-1', contentHash: 'sha256:one', sourceEdition: 1 });
      expect(() => insertSourceText(db, {
        id: 'duplicate-hash',
        contentHash: 'sha256:one',
        sourceEdition: 2,
      })).toThrow();
      expect(() => insertSourceText(db, {
        id: 'duplicate-edition',
        contentHash: 'sha256:two',
        sourceEdition: 1,
      })).toThrow();
    } finally {
      db.close();
    }
  });

  it('accepts every canonical Job state and nullable total units', () => {
    const db = migratedDatabase();
    try {
      JOB_STATES.forEach((state, index) => insertJob(db, {
        id: `job-${index}`,
        state,
        totalUnits: null,
      }));
      expect(db.prepare('SELECT state FROM jobs ORDER BY id').pluck().all().sort()).toEqual(
        [...JOB_STATES].sort(),
      );
    } finally {
      db.close();
    }
  });

  it('rejects invalid Job state, units, and payload schema versions', () => {
    const db = migratedDatabase();
    try {
      expect(() => insertJob(db, { id: 'unknown', state: 'unknown' })).toThrow();
      expect(() => insertJob(db, { id: 'completed-negative', completedUnits: -1 })).toThrow();
      expect(() => insertJob(db, { id: 'total-negative', totalUnits: -1 })).toThrow();
      expect(() => insertJob(db, { id: 'payload-zero', payloadSchemaVersion: 0 })).toThrow();
      expect(() => insertJob(db, { id: 'payload-negative', payloadSchemaVersion: -1 })).toThrow();
    } finally {
      db.close();
    }
  });

  it('enforces checkpoint sequence, payload version, and per-Job sequence uniqueness', () => {
    const db = migratedDatabase();
    try {
      insertJob(db, { id: 'job-1' });
      expect(() => insertCheckpoint(db, { id: 'sequence-zero', sequence: 0 })).toThrow();
      expect(() => insertCheckpoint(db, { id: 'sequence-negative', sequence: -1 })).toThrow();
      expect(() => insertCheckpoint(db, { id: 'payload-zero', payloadSchemaVersion: 0 })).toThrow();
      expect(() => insertCheckpoint(db, { id: 'payload-negative', payloadSchemaVersion: -1 })).toThrow();
      insertCheckpoint(db, { id: 'checkpoint-1', sequence: 1 });
      expect(() => insertCheckpoint(db, { id: 'checkpoint-duplicate', sequence: 1 })).toThrow();
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

function columnDefault(db: SqliteDatabase, table: string, column: string): string | null {
  const row = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
    dflt_value: string | null;
  }>).find(({ name }) => name === column);
  return row?.dflt_value ?? null;
}

function foreignKeys(db: SqliteDatabase, table: string): Array<{
  from: string;
  table: string;
  to: string;
}> {
  return (db.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{
    from: string;
    table: string;
    to: string;
  }>).map(({ from, table: targetTable, to }) => ({ from, table: targetTable, to }));
}

function insertBook(db: SqliteDatabase, id: string): void {
  db.prepare(`INSERT INTO books (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    id,
    id,
    '2026-07-12T00:00:00.000Z',
    '2026-07-12T00:00:00.000Z',
  );
}

function insertSourceText(db: SqliteDatabase, input: {
  id: string;
  sizeBytes?: number;
  sourceEdition?: number;
  contentHash?: string;
}): void {
  db.prepare(`
    INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash,
      encoding, source_edition, relative_path, imported_at
    ) VALUES (?, 'book-1', ?, ?, 'md', ?, 'utf-8', ?, ?, ?)
  `).run(
    input.id,
    `${input.id}.md`,
    input.sizeBytes ?? 1,
    input.contentHash ?? `sha256:${input.id}`,
    input.sourceEdition ?? 1,
    `source/${input.id}/${input.id}.md`,
    '2026-07-12T00:00:00.000Z',
  );
}

function insertJob(db: SqliteDatabase, input: {
  id: string;
  state?: string;
  completedUnits?: number;
  totalUnits?: number | null;
  payloadSchemaVersion?: number;
}): void {
  db.prepare(`
    INSERT INTO jobs (
      id, kind, state, completed_units, total_units, payload_schema_version,
      payload_json, created_at, updated_at
    ) VALUES (?, 'source_import', ?, ?, ?, ?, '{}', ?, ?)
  `).run(
    input.id,
    input.state ?? 'queued',
    input.completedUnits ?? 0,
    input.totalUnits === undefined ? null : input.totalUnits,
    input.payloadSchemaVersion ?? 1,
    '2026-07-12T00:00:00.000Z',
    '2026-07-12T00:00:00.000Z',
  );
}

function insertCheckpoint(db: SqliteDatabase, input: {
  id: string;
  sequence?: number;
  payloadSchemaVersion?: number;
}): void {
  db.prepare(`
    INSERT INTO job_checkpoints (
      id, job_id, sequence, kind, payload_schema_version, payload_json, created_at
    ) VALUES (?, 'job-1', ?, 'source_import_completed', ?, '{}', ?)
  `).run(
    input.id,
    input.sequence ?? 1,
    input.payloadSchemaVersion ?? 1,
    '2026-07-12T00:00:00.000Z',
  );
}
