import type { Migration } from '../migration-runner';

export const FOUNDATION_SCHEMA_MIGRATION = {
  id: 1,
  name: 'foundation_schema',
  up(database) {
    database.exec(`
      CREATE TABLE library (
        singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        app_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_text_id TEXT,
        lifecycle_state TEXT NOT NULL DEFAULT 'draft',
        structure_edition INTEGER NOT NULL DEFAULT 0,
        analysis_revision INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE SET NULL
      );

      CREATE TABLE source_texts (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        format TEXT NOT NULL CHECK (format IN ('txt', 'md')),
        content_hash TEXT NOT NULL,
        encoding TEXT NOT NULL,
        source_edition INTEGER NOT NULL DEFAULT 1,
        relative_path TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE structure_nodes (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_text_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('book', 'volume', 'chapter')),
        title TEXT NOT NULL,
        parent_id TEXT,
        sort_order INTEGER NOT NULL,
        start_offset INTEGER,
        end_offset INTEGER,
        structure_edition INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES structure_nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE story_segment_ranges (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_text_id TEXT NOT NULL,
        label TEXT NOT NULL,
        scope_json TEXT NOT NULL DEFAULT '{}',
        covered_chapter_ids_json TEXT NOT NULL DEFAULT '[]',
        structure_edition INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE CASCADE
      );

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        book_id TEXT,
        type TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'paused', 'failed', 'resumable', 'cancelled', 'completed')),
        progress REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL DEFAULT '{}',
        error_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
      );

      CREATE TABLE exports (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'blocked',
        format TEXT NOT NULL,
        output_relative_path TEXT,
        blocked_reason TEXT,
        latest_job_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (latest_job_id) REFERENCES jobs(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_source_texts_book_id ON source_texts(book_id);
      CREATE INDEX idx_structure_nodes_book_id ON structure_nodes(book_id);
      CREATE INDEX idx_structure_nodes_parent_id ON structure_nodes(parent_id);
      CREATE INDEX idx_story_segment_ranges_book_id ON story_segment_ranges(book_id);
      CREATE INDEX idx_jobs_book_id_state ON jobs(book_id, state);
      CREATE INDEX idx_exports_book_id ON exports(book_id);
    `);
  },
} as const satisfies Migration;
