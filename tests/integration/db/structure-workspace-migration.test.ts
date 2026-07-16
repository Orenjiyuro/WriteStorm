import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';

const tempDirs: string[] = [];
const STRUCTURE_WORKSPACE_MIGRATIONS = APP_MIGRATIONS.slice(0, 2);

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('structure workspace migration 002', () => {
  it('builds the final structure workspace directly after the V1 runtime baseline', () => {
    const db = migratedDatabase();
    try {
      expect(STRUCTURE_WORKSPACE_MIGRATIONS.map(({ id, name }) => ({ id, name }))).toEqual([
        { id: 1, name: 'v1_runtime_baseline' },
        { id: 2, name: 'structure_workspace' },
      ]);
      expect(getCurrentSchemaVersion(db)).toBe(2);
      expect(tableNames(db)).toEqual(expect.arrayContaining([
        'structure_detection_runs',
        'structure_sets',
        'structure_nodes',
        'story_segment_ranges',
        'story_segment_range_chapters',
      ]));
      expect(columnNames(db, 'story_segment_ranges')).toContain('boundary_evidence_json');
      expect(columnNames(db, 'structure_detection_runs')).toContain('run_sequence');
      expect(columnNames(db, 'structure_sets')).toContain('is_current');
      expect(columnNames(db, 'structure_sets')).toContain('origin_set_id');
      expect(columnNames(db, 'books')).toContain('structure_edition');
    } finally {
      db.close();
    }
  });

  it('keeps Book structure edition nullable before freeze and positive afterwards', () => {
    const db = migratedDatabase();
    try {
      seedBookSourceAndJob(db);
      expect(db.prepare("SELECT structure_edition FROM books WHERE id = 'book-1'").pluck().get()).toBeNull();
      expect(() => db.prepare("UPDATE books SET structure_edition = 0 WHERE id = 'book-1'").run())
        .toThrow(/CHECK constraint failed/i);
      expect(() => db.prepare("UPDATE books SET structure_edition = 1 WHERE id = 'book-1'").run())
        .not.toThrow();
    } finally {
      db.close();
    }
  });

  it('requires a positive detection run sequence that is unique within each book', () => {
    const db = migratedDatabase();
    try {
      seedBookSourceAndJob(db);
      insertDetectionRun(db, 'run-1', 'job-1', 1);
      expect(() => db.prepare("UPDATE structure_detection_runs SET run_sequence = 0 WHERE id = 'run-1'").run())
        .toThrow(/CHECK constraint failed/i);
      db.prepare(`INSERT INTO jobs (
        id, book_id, kind, state, completed_units, total_units, payload_schema_version,
        payload_json, error_code, error_details_json, created_at, updated_at
      ) VALUES ('job-2', 'book-1', 'structure_detection', 'queued', 0, 1, 1,
        '{}', NULL, NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')`).run();
      expect(() => insertDetectionRun(db, 'run-2', 'job-2', 1)).toThrow(/UNIQUE constraint failed/i);
      expect(() => insertDetectionRun(db, 'run-2', 'job-2', 2)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('requires positive draft revisions and preserves an origin set reference', () => {
    const db = migratedDatabase();
    try {
      seedBookSourceAndJob(db);
      insertDetectionRun(db, 'run-1', 'job-1');
      insertCandidateSet(db, 'candidate-current', 'run-1', 1);
      expect(() => db.prepare(`INSERT INTO structure_sets (
        id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
        draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
      ) VALUES ('draft-zero', 'book-1', 'source-1', 1, 'sha256:source', 24,
        'utf16_code_unit', 'draft', NULL, 'included', 0, NULL, NULL, 1,
        '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z', 'candidate-current')`).run())
        .toThrow(/CHECK constraint failed/i);
      db.prepare(`INSERT INTO structure_sets (
        id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
        draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at, origin_set_id
      ) VALUES ('draft-1', 'book-1', 'source-1', 1, 'sha256:source', 24,
        'utf16_code_unit', 'draft', NULL, 'included', 1, NULL, NULL, 1,
        '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z', 'candidate-current')`).run();
      expect(db.prepare("SELECT origin_set_id FROM structure_sets WHERE id = 'draft-1'").pluck().get())
        .toBe('candidate-current');
    } finally {
      db.close();
    }
  });

  it('replays from a genuinely empty database without a legacy structure shell', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    try {
      expect(tableNames(db)).toEqual([]);
      expect(() => runMigrations(db, STRUCTURE_WORKSPACE_MIGRATIONS)).not.toThrow();
      expect(getCurrentSchemaVersion(db)).toBe(2);
      expect(tableNames(db)).toContain('structure_nodes');
    } finally {
      db.close();
    }
  });

  it('allows one current structure set per book and stage while retaining history', () => {
    const db = migratedDatabase();
    try {
      seedBookSourceAndJob(db);
      insertDetectionRun(db, 'run-1', 'job-1');
      insertCandidateSet(db, 'candidate-current', 'run-1', 1);
      expect(() => insertCandidateSet(db, 'candidate-other-current', 'run-1', 1)).toThrow(/UNIQUE constraint failed/i);
      expect(() => insertCandidateSet(db, 'candidate-history', 'run-1', 0)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('cascades a deleted detection Job through its run and current candidate', () => {
    const db = migratedDatabase();
    try {
      seedBookSourceAndJob(db);
      insertDetectionRun(db, 'run-1', 'job-1');
      insertCandidateSet(db, 'candidate-current', 'run-1', 1);
      expect(() => db.prepare("DELETE FROM jobs WHERE id = 'job-1'").run()).not.toThrow();
      expect(db.prepare('SELECT COUNT(*) FROM structure_detection_runs').pluck().get()).toBe(0);
      expect(db.prepare('SELECT COUNT(*) FROM structure_sets').pluck().get()).toBe(0);
    } finally {
      db.close();
    }
  });
});

function migratedDatabase(): SqliteDatabase {
  const db = openSqliteDatabase(tempDatabasePath());
  runMigrations(db, STRUCTURE_WORKSPACE_MIGRATIONS);
  return db;
}

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-structure-workspace-'));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'writestorm.sqlite');
}

function seedBookSourceAndJob(db: SqliteDatabase): void {
  const now = '2026-07-10T00:00:00.000Z';
  db.prepare(`INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example Library', '0.1.0', ?, ?)`).run(now, now);
  db.prepare(`INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)`).run(now, now);
  db.prepare(`INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash, encoding,
      source_edition, relative_path, imported_at
    ) VALUES ('source-1', 'book-1', 'example.md', 24, 'md', 'sha256:source', 'utf-8', 1,
      'source/source-1/example.md', ?)`).run(now);
  db.prepare("UPDATE books SET current_source_text_id = 'source-1' WHERE id = 'book-1'").run();
  db.prepare(`INSERT INTO jobs (
      id, book_id, kind, state, completed_units, total_units, payload_schema_version,
      payload_json, error_code, error_details_json, created_at, updated_at
    ) VALUES ('job-1', 'book-1', 'structure_detection', 'queued', 0, 1, 1,
      '{}', NULL, NULL, ?, ?)`).run(now, now);
}

function tableNames(db: SqliteDatabase): string[] {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all() as string[];
}

function columnNames(db: SqliteDatabase, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(({ name }) => name);
}

function insertDetectionRun(db: SqliteDatabase, id: string, jobId: string, runSequence = 1): void {
  db.prepare(`INSERT INTO structure_detection_runs (
      id, job_id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, state, failure_reason, created_at, updated_at, run_sequence
    ) VALUES (?, ?, 'book-1', 'source-1', 1, 'sha256:source', 24,
      'utf16_code_unit', 'queued', NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z', ?)`).run(id, jobId, runSequence);
}

function insertCandidateSet(db: SqliteDatabase, id: string, detectionRunId: string, isCurrent: 0 | 1): void {
  db.prepare(`INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
    ) VALUES (?, 'book-1', 'source-1', 1, 'sha256:source', 24,
      'utf16_code_unit', 'candidate', ?, 'included', NULL, NULL, NULL, ?,
      '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')`).run(id, detectionRunId, isCurrent);
}
