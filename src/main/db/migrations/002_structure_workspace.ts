import type { Migration } from '../migration-runner';

export const STRUCTURE_WORKSPACE_MIGRATION = {
  id: 2,
  name: 'structure_workspace',
  up(database) {
    database.exec(`
      CREATE TABLE structure_detection_runs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE,
        book_id TEXT NOT NULL,
        source_text_id TEXT NOT NULL,
        source_text_edition INTEGER NOT NULL CHECK (source_text_edition > 0),
        source_content_hash TEXT NOT NULL CHECK (length(trim(source_content_hash)) > 0),
        decoded_text_length INTEGER NOT NULL CHECK (decoded_text_length >= 0),
        offset_unit TEXT NOT NULL CHECK (offset_unit = 'utf16_code_unit'),
        state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'completed', 'failed')),
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (state = 'failed' AND failure_reason IS NOT NULL AND length(trim(failure_reason)) > 0) OR
          (state <> 'failed' AND failure_reason IS NULL)
        ),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE CASCADE
      );

      CREATE TABLE structure_sets (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        source_text_id TEXT NOT NULL,
        source_text_edition INTEGER NOT NULL CHECK (source_text_edition > 0),
        source_content_hash TEXT NOT NULL CHECK (length(trim(source_content_hash)) > 0),
        decoded_text_length INTEGER NOT NULL CHECK (decoded_text_length >= 0),
        offset_unit TEXT NOT NULL CHECK (offset_unit = 'utf16_code_unit'),
        stage TEXT NOT NULL CHECK (stage IN ('candidate', 'draft', 'frozen')),
        detection_run_id TEXT,
        story_range_mode TEXT NOT NULL CHECK (story_range_mode IN ('included', 'skipped_by_user')),
        draft_revision INTEGER,
        structure_edition INTEGER,
        frozen_at TEXT,
        is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (stage = 'candidate' AND detection_run_id IS NOT NULL AND draft_revision IS NULL AND structure_edition IS NULL AND frozen_at IS NULL) OR
          (stage = 'draft' AND detection_run_id IS NULL AND draft_revision IS NOT NULL AND draft_revision >= 0 AND structure_edition IS NULL AND frozen_at IS NULL) OR
          (stage = 'frozen' AND detection_run_id IS NULL AND draft_revision IS NULL AND structure_edition IS NOT NULL AND structure_edition > 0 AND frozen_at IS NOT NULL)
        ),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (source_text_id) REFERENCES source_texts(id) ON DELETE CASCADE,
        FOREIGN KEY (detection_run_id) REFERENCES structure_detection_runs(id) ON DELETE CASCADE,
        UNIQUE (book_id, structure_edition)
      );

      CREATE TABLE structure_nodes (
        id TEXT PRIMARY KEY,
        structure_set_id TEXT NOT NULL,
        origin_id TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('book', 'volume', 'chapter')),
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        parent_id TEXT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
        end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
        raw_heading_text TEXT,
        heading_start_offset INTEGER,
        heading_end_offset INTEGER,
        confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
        confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low', 'unusable')),
        low_confidence_resolution TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (raw_heading_text IS NULL AND heading_start_offset IS NULL AND heading_end_offset IS NULL) OR
          (
            raw_heading_text IS NOT NULL AND length(raw_heading_text) > 0 AND
            heading_start_offset IS NOT NULL AND heading_end_offset IS NOT NULL AND
            heading_start_offset >= start_offset AND heading_end_offset <= end_offset AND
            heading_end_offset > heading_start_offset
          )
        ),
        CHECK (
          (confidence_level = 'low' AND low_confidence_resolution IN ('unresolved', 'accepted', 'corrected')) OR
          (confidence_level <> 'low' AND low_confidence_resolution IS NULL)
        ),
        FOREIGN KEY (structure_set_id) REFERENCES structure_sets(id) ON DELETE CASCADE,
        FOREIGN KEY (origin_id) REFERENCES structure_nodes(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_id) REFERENCES structure_nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE story_segment_ranges (
        id TEXT PRIMARY KEY,
        structure_set_id TEXT NOT NULL,
        origin_id TEXT,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
        end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
        suggested_function_tags_json TEXT NOT NULL DEFAULT '[]',
        boundary_evidence_json TEXT NOT NULL DEFAULT '[]',
        start_reason TEXT NOT NULL CHECK (length(trim(start_reason)) > 0),
        end_reason TEXT NOT NULL CHECK (length(trim(end_reason)) > 0),
        confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
        confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low', 'unusable')),
        low_confidence_resolution TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (confidence_level = 'low' AND low_confidence_resolution IN ('unresolved', 'accepted', 'corrected')) OR
          (confidence_level <> 'low' AND low_confidence_resolution IS NULL)
        ),
        FOREIGN KEY (structure_set_id) REFERENCES structure_sets(id) ON DELETE CASCADE,
        FOREIGN KEY (origin_id) REFERENCES story_segment_ranges(id) ON DELETE SET NULL
      );

      CREATE TABLE story_segment_range_chapters (
        story_segment_range_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        PRIMARY KEY (story_segment_range_id, chapter_id),
        UNIQUE (story_segment_range_id, sort_order),
        FOREIGN KEY (story_segment_range_id) REFERENCES story_segment_ranges(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES structure_nodes(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_structure_detection_runs_book_id ON structure_detection_runs(book_id);
      CREATE INDEX idx_structure_detection_runs_source_text_id ON structure_detection_runs(source_text_id);
      CREATE INDEX idx_structure_sets_book_stage ON structure_sets(book_id, stage);
      CREATE UNIQUE INDEX idx_structure_sets_current_stage
        ON structure_sets(book_id, stage)
        WHERE is_current = 1;
      CREATE INDEX idx_structure_sets_source_text_id ON structure_sets(source_text_id);
      CREATE INDEX idx_structure_nodes_structure_set_id ON structure_nodes(structure_set_id);
      CREATE INDEX idx_structure_nodes_parent_id ON structure_nodes(parent_id);
      CREATE INDEX idx_structure_nodes_origin_id ON structure_nodes(origin_id);
      CREATE INDEX idx_story_segment_ranges_structure_set_id ON story_segment_ranges(structure_set_id);
      CREATE INDEX idx_story_segment_ranges_origin_id ON story_segment_ranges(origin_id);
      CREATE INDEX idx_story_segment_range_chapters_chapter_id ON story_segment_range_chapters(chapter_id);

      CREATE TRIGGER trg_structure_nodes_parent_same_set_insert
      BEFORE INSERT ON structure_nodes
      FOR EACH ROW
      WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM structure_nodes parent
        WHERE parent.id = NEW.parent_id AND parent.structure_set_id = NEW.structure_set_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'structure node parent must belong to the same structure set');
      END;

      CREATE TRIGGER trg_structure_nodes_parent_same_set_update
      BEFORE UPDATE OF parent_id, structure_set_id ON structure_nodes
      FOR EACH ROW
      WHEN NEW.parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM structure_nodes parent
        WHERE parent.id = NEW.parent_id AND parent.structure_set_id = NEW.structure_set_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'structure node parent must belong to the same structure set');
      END;

      CREATE TRIGGER trg_story_ranges_respect_skip_mode_insert
      BEFORE INSERT ON story_segment_ranges
      FOR EACH ROW
      WHEN (SELECT story_range_mode FROM structure_sets WHERE id = NEW.structure_set_id) = 'skipped_by_user'
      BEGIN
        SELECT RAISE(ABORT, 'skipped story range mode cannot contain story ranges');
      END;

      CREATE TRIGGER trg_story_ranges_respect_skip_mode_update
      BEFORE UPDATE OF structure_set_id ON story_segment_ranges
      FOR EACH ROW
      WHEN (SELECT story_range_mode FROM structure_sets WHERE id = NEW.structure_set_id) = 'skipped_by_user'
      BEGIN
        SELECT RAISE(ABORT, 'skipped story range mode cannot contain story ranges');
      END;

      CREATE TRIGGER trg_structure_sets_skip_mode_no_ranges
      BEFORE UPDATE OF story_range_mode ON structure_sets
      FOR EACH ROW
      WHEN NEW.story_range_mode = 'skipped_by_user' AND EXISTS (
        SELECT 1 FROM story_segment_ranges WHERE structure_set_id = NEW.id
      )
      BEGIN
        SELECT RAISE(ABORT, 'skipped story range mode cannot retain story ranges');
      END;

      CREATE TRIGGER trg_story_range_chapters_same_set_insert
      BEFORE INSERT ON story_segment_range_chapters
      FOR EACH ROW
      WHEN NOT EXISTS (
        SELECT 1
        FROM story_segment_ranges range
        JOIN structure_nodes chapter ON chapter.id = NEW.chapter_id
        WHERE range.id = NEW.story_segment_range_id
          AND range.structure_set_id = chapter.structure_set_id
          AND chapter.kind = 'chapter'
      )
      BEGIN
        SELECT RAISE(ABORT, 'story range chapters must be chapters from the same structure set');
      END;

      CREATE TRIGGER trg_story_range_chapters_same_set_update
      BEFORE UPDATE OF story_segment_range_id, chapter_id ON story_segment_range_chapters
      FOR EACH ROW
      WHEN NOT EXISTS (
        SELECT 1
        FROM story_segment_ranges range
        JOIN structure_nodes chapter ON chapter.id = NEW.chapter_id
        WHERE range.id = NEW.story_segment_range_id
          AND range.structure_set_id = chapter.structure_set_id
          AND chapter.kind = 'chapter'
      )
      BEGIN
        SELECT RAISE(ABORT, 'story range chapters must be chapters from the same structure set');
      END;

      CREATE TRIGGER trg_story_ranges_no_frozen_overlap_insert
      BEFORE INSERT ON story_segment_ranges
      FOR EACH ROW
      WHEN (SELECT stage FROM structure_sets WHERE id = NEW.structure_set_id) = 'frozen' AND EXISTS (
        SELECT 1 FROM story_segment_ranges existing
        WHERE existing.structure_set_id = NEW.structure_set_id
          AND NEW.start_offset < existing.end_offset
          AND existing.start_offset < NEW.end_offset
      )
      BEGIN
        SELECT RAISE(ABORT, 'frozen story segment ranges cannot overlap');
      END;

      CREATE TRIGGER trg_story_ranges_no_frozen_overlap_update
      BEFORE UPDATE OF structure_set_id, start_offset, end_offset ON story_segment_ranges
      FOR EACH ROW
      WHEN (SELECT stage FROM structure_sets WHERE id = NEW.structure_set_id) = 'frozen' AND EXISTS (
        SELECT 1 FROM story_segment_ranges existing
        WHERE existing.structure_set_id = NEW.structure_set_id
          AND existing.id <> NEW.id
          AND NEW.start_offset < existing.end_offset
          AND existing.start_offset < NEW.end_offset
      )
      BEGIN
        SELECT RAISE(ABORT, 'frozen story segment ranges cannot overlap');
      END;

      CREATE TRIGGER trg_structure_sets_freeze_no_range_overlap
      BEFORE UPDATE OF stage ON structure_sets
      FOR EACH ROW
      WHEN NEW.stage = 'frozen' AND EXISTS (
        SELECT 1
        FROM story_segment_ranges first
        JOIN story_segment_ranges second
          ON second.structure_set_id = first.structure_set_id
         AND second.id > first.id
         AND first.start_offset < second.end_offset
         AND second.start_offset < first.end_offset
        WHERE first.structure_set_id = NEW.id
      )
      BEGIN
        SELECT RAISE(ABORT, 'frozen story segment ranges cannot overlap');
      END;
    `);
  },
} as const satisfies Migration;
