import type { Migration } from '../migration-runner';
import {
  WRITESTORM_SCHEMA_EPOCH,
  WRITESTORM_SQLITE_APPLICATION_ID,
} from '../schema-identity';

export const V1_RUNTIME_BASELINE_MIGRATION = {
  id: 1,
  name: 'v1_runtime_baseline',
  up(database) {
    database.pragma(`application_id = ${WRITESTORM_SQLITE_APPLICATION_ID}`);
    database.exec(`
      CREATE TABLE library (
        singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        app_version TEXT NOT NULL,
        schema_epoch INTEGER NOT NULL DEFAULT ${WRITESTORM_SCHEMA_EPOCH}
          CHECK (schema_epoch = ${WRITESTORM_SCHEMA_EPOCH}),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        current_source_text_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (current_source_text_id) REFERENCES source_texts(id) ON DELETE SET NULL,
        FOREIGN KEY (current_source_text_id, id) REFERENCES source_texts(id, book_id)
      );

      CREATE TABLE source_texts (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        original_file_name TEXT NOT NULL CHECK (length(trim(original_file_name)) > 0),
        size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
        format TEXT NOT NULL CHECK (format IN ('txt', 'md')),
        content_hash TEXT NOT NULL UNIQUE,
        encoding TEXT NOT NULL,
        source_edition INTEGER NOT NULL CHECK (source_edition > 0),
        relative_path TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE (id, book_id),
        UNIQUE (book_id, source_edition)
      );

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        book_id TEXT,
        kind TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN (
          'queued', 'estimating', 'waiting_confirmation', 'running', 'paused',
          'failed', 'resumable', 'cancelled', 'completed'
        )),
        completed_units INTEGER NOT NULL DEFAULT 0 CHECK (completed_units >= 0),
        total_units INTEGER CHECK (total_units IS NULL OR total_units >= 0),
        payload_schema_version INTEGER NOT NULL CHECK (payload_schema_version > 0),
        payload_json TEXT NOT NULL,
        error_code TEXT,
        error_details_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
      );

      CREATE TABLE job_checkpoints (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence > 0),
        kind TEXT NOT NULL,
        payload_schema_version INTEGER NOT NULL CHECK (payload_schema_version > 0),
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        UNIQUE (job_id, sequence)
      );

      CREATE INDEX idx_source_texts_book_id ON source_texts(book_id);
      CREATE INDEX idx_jobs_book_id_state ON jobs(book_id, state);
      CREATE INDEX idx_job_checkpoints_job_id ON job_checkpoints(job_id);
    `);
  },
  semanticWitnesses: [
    {
      id: '001.library.singleton', migrationId: 1,
      sql: `INSERT INTO library VALUES (2, 'lib', 'Library', '1.0.0', 2, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.library.schema_epoch', migrationId: 1,
      sql: `INSERT INTO library VALUES (1, 'lib', 'Library', '1.0.0', 1, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.source_text.positive_size', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 0, 'txt', 'hash', 'utf8', 1, 'source.txt', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.source_text.format', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 1, 'pdf', 'hash', 'utf8', 1, 'source.txt', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.source_text.positive_edition', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 1, 'txt', 'hash', 'utf8', 0, 'source.txt', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.source_text.unique_hash', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now'); INSERT INTO source_texts VALUES ('source-1', 'book', 'one.txt', 1, 'txt', 'hash', 'utf8', 1, 'one.txt', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source-2', 'book', 'two.txt', 1, 'txt', 'hash', 'utf8', 2, 'two.txt', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
    {
      id: '001.source_text.unique_book_edition', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now'); INSERT INTO source_texts VALUES ('source-1', 'book', 'one.txt', 1, 'txt', 'hash-1', 'utf8', 1, 'one.txt', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source-2', 'book', 'two.txt', 1, 'txt', 'hash-2', 'utf8', 1, 'two.txt', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
    {
      id: '001.book.current_source_ownership', migrationId: 1,
      setupSql: `INSERT INTO books VALUES ('book-1', 'One', NULL, 'now', 'now'); INSERT INTO books VALUES ('book-2', 'Two', NULL, 'now', 'now'); INSERT INTO source_texts VALUES ('source', 'book-1', 'one.txt', 1, 'txt', 'hash', 'utf8', 1, 'one.txt', 'now')`,
      sql: `UPDATE books SET current_source_text_id = 'source' WHERE id = 'book-2'`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_FOREIGNKEY' },
    },
    {
      id: '001.job.state', migrationId: 1,
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'unknown', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.job.progress', migrationId: 1,
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', -1, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.job.total_units', migrationId: 1,
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, -1, 1, '{}', NULL, NULL, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.job.payload_version', migrationId: 1,
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 0, '{}', NULL, NULL, 'now', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.checkpoint.sequence', migrationId: 1,
      setupSql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      sql: `INSERT INTO job_checkpoints VALUES ('checkpoint', 'job', 0, 'progress', 1, '{}', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.checkpoint.payload_version', migrationId: 1,
      setupSql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      sql: `INSERT INTO job_checkpoints VALUES ('checkpoint', 'job', 1, 'progress', 0, '{}', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
    {
      id: '001.checkpoint.unique_job_sequence', migrationId: 1,
      setupSql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now'); INSERT INTO job_checkpoints VALUES ('checkpoint-1', 'job', 1, 'progress', 1, '{}', 'now')`,
      sql: `INSERT INTO job_checkpoints VALUES ('checkpoint-2', 'job', 1, 'progress', 1, '{}', 'now')`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
  ],
} as const satisfies Migration;
