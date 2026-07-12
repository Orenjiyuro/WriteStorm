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
        FOREIGN KEY (current_source_text_id) REFERENCES source_texts(id) ON DELETE SET NULL
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
} as const satisfies Migration;
