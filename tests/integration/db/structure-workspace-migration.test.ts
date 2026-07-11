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

describe('structure workspace migration', () => {
  it('upgrades a real schema-3 library to normalized detection runs and globally identified structure sets', () => {
    const db = schema3Database();
    try {
      seedBookSourceAndJob(db);

    runMigrations(db, APP_MIGRATIONS);

    expect(getCurrentSchemaVersion(db)).toBe(4);
    expect(tableNames(db)).toEqual(expect.arrayContaining([
      'structure_detection_runs',
      'structure_sets',
      'structure_nodes',
      'story_segment_ranges',
      'story_segment_range_chapters',
    ]));
    expect(columnNames(db, 'story_segment_ranges')).toContain('boundary_evidence_json');
    expect(columnNames(db, 'structure_sets')).toContain('is_current');

    db.prepare(`
      INSERT INTO structure_detection_runs (
        id, job_id, book_id, source_text_id, source_text_edition,
        source_content_hash, decoded_text_length, offset_unit, state,
        failure_reason, created_at, updated_at
      )
      VALUES ('run-1', 'job-1', 'book-1', 'source-1', 1, 'sha256:source', 24,
        'utf16_code_unit', 'queued', NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO structure_sets (
        id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
        draft_revision, structure_edition, frozen_at, created_at, updated_at
      )
      VALUES ('set-1', 'book-1', 'source-1', 1, 'sha256:source', 24,
        'utf16_code_unit', 'candidate', 'run-1', 'included', NULL, NULL, NULL,
        '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO structure_nodes (
        id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
        start_offset, end_offset, raw_heading_text, heading_start_offset,
        heading_end_offset, confidence_score, confidence_level,
        low_confidence_resolution, created_at, updated_at
      )
      VALUES ('node-1', 'set-1', NULL, 'book', 'Example Book', NULL, 0,
        0, 24, NULL, NULL, NULL, 1, 'high', NULL,
        '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run();

    expect(() => db.prepare(`
      INSERT INTO structure_nodes (
        id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
        start_offset, end_offset, raw_heading_text, heading_start_offset,
        heading_end_offset, confidence_score, confidence_level,
        low_confidence_resolution, created_at, updated_at
      )
      VALUES ('node-1', 'set-1', NULL, 'chapter', 'Duplicate', NULL, 1,
        1, 24, NULL, NULL, NULL, 1, 'high', NULL,
        '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run()).toThrow(/UNIQUE constraint failed: structure_nodes\.id/i);
    expect(() => db.prepare(`
      INSERT INTO structure_detection_runs (
        id, job_id, book_id, source_text_id, source_text_edition,
        source_content_hash, decoded_text_length, offset_unit, state,
        failure_reason, created_at, updated_at
      )
      VALUES ('run-unknown-job', 'missing-job', 'book-1', 'source-1', 1, 'sha256:source', 24,
        'utf16_code_unit', 'queued', NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run()).toThrow(/FOREIGN KEY constraint failed/i);

      insertFrozenStructureSet(db, 'set-frozen');
      insertStoryRange(db, {
        id: 'range-a',
        structureSetId: 'set-frozen',
        startOffset: 0,
        endOffset: 10,
      });
      expect(() => insertStoryRange(db, {
        id: 'range-overlap',
        structureSetId: 'set-frozen',
        startOffset: 9,
        endOffset: 12,
      })).toThrow(/frozen story segment ranges cannot overlap/i);
      expect(() => insertStoryRange(db, {
        id: 'range-adjacent',
        structureSetId: 'set-frozen',
        startOffset: 10,
        endOffset: 14,
      })).not.toThrow();
      expect(() => db.prepare("DELETE FROM books WHERE id = 'book-1'").run()).not.toThrow();

    } finally {
      db.close();
    }
  });

  it('rejects a non-empty legacy structure shell and rolls migration 004 back', () => {
    const db = schema3Database();
    try {
      seedBookSourceAndJob(db);
      db.prepare(`
      INSERT INTO structure_nodes (
        id, book_id, source_text_id, kind, title, parent_id, sort_order,
        start_offset, end_offset, structure_edition, created_at, updated_at
      )
      VALUES ('legacy-node', 'book-1', 'source-1', 'chapter', 'Legacy chapter', NULL, 0,
        0, 10, 0, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
    `).run();

    expect(() => runMigrations(db, APP_MIGRATIONS)).toThrow(
      /legacy structure shell tables must be empty/i,
    );
    expect(getCurrentSchemaVersion(db)).toBe(3);
    expect(tableNames(db)).not.toContain('structure_detection_runs');
    expect(db.prepare('SELECT COUNT(*) FROM structure_nodes').pluck().get()).toBe(1);

    } finally {
      db.close();
    }
  });

  it('reopens an upgraded schema-3 library at schema version 4', () => {
    const databasePath = tempDatabasePath();
    const db = openSqliteDatabase(databasePath);
    runMigrations(db, APP_MIGRATIONS.slice(0, 3));
    runMigrations(db, APP_MIGRATIONS);
    db.close();

    const reopened = openSqliteDatabase(databasePath);
    try {
      runMigrations(reopened, APP_MIGRATIONS);
      expect(getCurrentSchemaVersion(reopened)).toBe(4);
      expect(tableNames(reopened)).toContain('structure_sets');
    } finally {
      reopened.close();
    }
  });

  it('allows one current structure set per book and stage while retaining historical sets', () => {
    const db = schema3Database();
    try {
      seedBookSourceAndJob(db);
      runMigrations(db, APP_MIGRATIONS);
      insertDetectionRun(db, 'run-1', 'job-1');
      insertCandidateSet(db, 'candidate-current', 'run-1', 1);

      expect(() => insertCandidateSet(db, 'candidate-other-current', 'run-1', 1)).toThrow(
        /UNIQUE constraint failed/i,
      );
      expect(() => insertCandidateSet(db, 'candidate-history', 'run-1', 0)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('cascades a deleted detection Job through its run and current candidate', () => {
    const db = schema3Database();
    try {
      seedBookSourceAndJob(db);
      runMigrations(db, APP_MIGRATIONS);
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

function schema3Database(): SqliteDatabase {
  const db = openSqliteDatabase(tempDatabasePath());
  runMigrations(db, APP_MIGRATIONS.slice(0, 3));
  return db;
}

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-structure-workspace-'));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'writestorm.sqlite');
}

function seedBookSourceAndJob(db: SqliteDatabase): void {
  const now = '2026-07-10T00:00:00.000Z';
  db.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example Library', '0.1.0', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)
  `).run(now, now);
  db.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    )
    VALUES ('source-1', 'book-1', 'md', 'sha256:source', 'utf-8', 1, 'source/book-1/example.md',
      ?, 'example.md', 24)
  `).run(now);
  db.prepare('UPDATE books SET source_text_id = ? WHERE id = ?').run('source-1', 'book-1');
  db.prepare(`
    INSERT INTO jobs (id, book_id, type, state, progress, payload_json, error_json, created_at, updated_at)
    VALUES ('job-1', 'book-1', 'structure_detection', 'queued', 0, '{}', NULL, ?, ?)
  `).run(now, now);
}

function tableNames(db: SqliteDatabase): string[] {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all() as string[];
}

function columnNames(db: SqliteDatabase, tableName: string): string[] {
  return (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>)
    .map((column) => column.name);
}

function insertDetectionRun(db: SqliteDatabase, id: string, jobId: string): void {
  db.prepare(`
    INSERT INTO structure_detection_runs (
      id, job_id, book_id, source_text_id, source_text_edition,
      source_content_hash, decoded_text_length, offset_unit, state,
      failure_reason, created_at, updated_at
    )
    VALUES (?, ?, 'book-1', 'source-1', 1, 'sha256:source', 24,
      'utf16_code_unit', 'queued', NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
  `).run(id, jobId);
}

function insertCandidateSet(
  db: SqliteDatabase,
  id: string,
  detectionRunId: string,
  isCurrent: 0 | 1,
): void {
  db.prepare(`
    INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at
    )
    VALUES (?, 'book-1', 'source-1', 1, 'sha256:source', 24,
      'utf16_code_unit', 'candidate', ?, 'included', NULL, NULL, NULL, ?,
      '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
  `).run(id, detectionRunId, isCurrent);
}

function insertFrozenStructureSet(db: SqliteDatabase, id: string): void {
  db.prepare(`
    INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, created_at, updated_at
    )
    VALUES (?, 'book-1', 'source-1', 1, 'sha256:source', 24,
      'utf16_code_unit', 'frozen', NULL, 'included', NULL, 1,
      '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
  `).run(id);
}

function insertStoryRange(
  db: SqliteDatabase,
  range: { id: string; structureSetId: string; startOffset: number; endOffset: number },
): void {
  db.prepare(`
    INSERT INTO story_segment_ranges (
      id, structure_set_id, origin_id, title, start_offset, end_offset,
      suggested_function_tags_json, start_reason, end_reason,
      confidence_score, confidence_level, low_confidence_resolution, created_at, updated_at
    )
    VALUES (?, ?, NULL, 'Range', ?, ?, '[]', 'start', 'end',
      0.9, 'high', NULL, '2026-07-10T00:00:00.000Z', '2026-07-10T00:00:00.000Z')
  `).run(range.id, range.structureSetId, range.startOffset, range.endOffset);
}
