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
      name: 'library_singleton_and_epoch_checks',
      sql: `INSERT INTO library VALUES (2, 'lib', 'Library', '1.0.0', 2, 'now', 'now')`,
      outcome: 'reject',
    },
    {
      name: 'source_text_positive_size_check',
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 0, 'txt', 'hash', 'utf8', 1, 'source.txt', 'now')`,
      outcome: 'reject',
    },
    {
      name: 'source_text_format_check',
      setupSql: `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`,
      sql: `INSERT INTO source_texts VALUES ('source', 'book', 'source.txt', 1, 'pdf', 'hash', 'utf8', 1, 'source.txt', 'now')`,
      outcome: 'reject',
    },
    {
      name: 'job_state_check',
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'unknown', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      outcome: 'reject',
    },
    {
      name: 'job_progress_check',
      sql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', -1, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      outcome: 'reject',
    },
    {
      name: 'checkpoint_sequence_check',
      setupSql: `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`,
      sql: `INSERT INTO job_checkpoints VALUES ('checkpoint', 'job', 0, 'progress', 1, '{}', 'now')`,
      outcome: 'reject',
    },
  ],
} as const satisfies Migration;
