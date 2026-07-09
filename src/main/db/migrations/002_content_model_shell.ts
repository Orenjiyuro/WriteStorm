import type { Migration } from '../migration-runner';

export const CONTENT_MODEL_SHELL_MIGRATION = {
  id: 2,
  name: 'content_model_shell',
  up(database) {
    database.exec(`
      CREATE TABLE analysis_modules (
        id TEXT PRIMARY KEY,
        module_key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        category TEXT NOT NULL,
        definition_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE analysis_module_instances (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        module_id TEXT NOT NULL,
        scope_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        body_markdown TEXT NOT NULL DEFAULT '',
        structured_payload_json TEXT NOT NULL DEFAULT '{}',
        analysis_revision INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES analysis_modules(id) ON DELETE RESTRICT
      );

      CREATE TABLE evidence_anchors (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_text_id TEXT NOT NULL,
        source_module_instance_id TEXT,
        anchor_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        selector_json TEXT NOT NULL DEFAULT '{}',
        summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE CASCADE,
        FOREIGN KEY (source_module_instance_id) REFERENCES analysis_module_instances(id) ON DELETE SET NULL
      );

      CREATE TABLE relation_links (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_module_instance_id TEXT NOT NULL,
        from_ref_json TEXT NOT NULL DEFAULT '{}',
        to_ref_json TEXT NOT NULL DEFAULT '{}',
        relation_type TEXT NOT NULL,
        link_mode TEXT NOT NULL DEFAULT 'reference_only',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_module_instance_id) REFERENCES analysis_module_instances(id) ON DELETE CASCADE
      );

      CREATE TABLE work_technique_observations (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_module_instance_id TEXT NOT NULL,
        evidence_anchor_ids_json TEXT NOT NULL DEFAULT '[]',
        content_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_module_instance_id) REFERENCES analysis_module_instances(id) ON DELETE CASCADE
      );

      CREATE TABLE reusable_technique_candidates (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_observation_ids_json TEXT NOT NULL DEFAULT '[]',
        evidence_anchor_ids_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE source_snapshots (
        id TEXT PRIMARY KEY,
        source_book_id TEXT NOT NULL,
        source_candidate_id TEXT NOT NULL,
        source_observation_ids_json TEXT NOT NULL DEFAULT '[]',
        captured_at TEXT NOT NULL,
        summary_json TEXT NOT NULL DEFAULT '{}',
        evidence_summary_json TEXT NOT NULL DEFAULT '{}',
        traceability TEXT NOT NULL DEFAULT 'readonly_source_trace',
        created_at TEXT NOT NULL,
        FOREIGN KEY (source_book_id) REFERENCES books(id) ON DELETE RESTRICT
      );

      CREATE TABLE technique_entries (
        id TEXT PRIMARY KEY,
        source_snapshot_id TEXT NOT NULL,
        status TEXT NOT NULL,
        content_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_snapshot_id) REFERENCES source_snapshots(id) ON DELETE RESTRICT
      );

      CREATE TABLE perspective_views (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        perspective_key TEXT NOT NULL,
        scope_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        source_revision_snapshot_json TEXT NOT NULL DEFAULT '{}',
        view_json TEXT NOT NULL DEFAULT '{}',
        user_notes_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_analysis_module_instances_book_id ON analysis_module_instances(book_id);
      CREATE INDEX idx_analysis_module_instances_module_id ON analysis_module_instances(module_id);
      CREATE INDEX idx_evidence_anchors_book_id ON evidence_anchors(book_id);
      CREATE INDEX idx_relation_links_book_id ON relation_links(book_id);
      CREATE INDEX idx_work_technique_observations_book_id ON work_technique_observations(book_id);
      CREATE INDEX idx_reusable_technique_candidates_book_id ON reusable_technique_candidates(book_id);
      CREATE INDEX idx_source_snapshots_source_book_id ON source_snapshots(source_book_id);
      CREATE INDEX idx_technique_entries_source_snapshot_id ON technique_entries(source_snapshot_id);
      CREATE INDEX idx_perspective_views_book_id ON perspective_views(book_id);
      CREATE UNIQUE INDEX idx_perspective_views_identity ON perspective_views(book_id, perspective_key, scope_json);
    `);
  },
} as const satisfies Migration;
