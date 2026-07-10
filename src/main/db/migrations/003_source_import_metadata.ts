import type { Migration } from '../migration-runner';

export const SOURCE_IMPORT_METADATA_MIGRATION = {
  id: 3,
  name: 'source_import_metadata',
  up(database) {
    database.exec(`
      ALTER TABLE source_texts
        ADD COLUMN original_file_name TEXT;

      ALTER TABLE source_texts
        ADD COLUMN size_bytes INTEGER;

      CREATE UNIQUE INDEX idx_source_texts_content_hash ON source_texts(content_hash);

      CREATE TRIGGER trg_source_texts_import_metadata_insert
      BEFORE INSERT ON source_texts
      FOR EACH ROW
      WHEN
        NEW.original_file_name IS NULL OR
        length(trim(NEW.original_file_name)) = 0 OR
        NEW.size_bytes IS NULL OR
        NEW.size_bytes <= 0
      BEGIN
        SELECT RAISE(ABORT, 'source_texts import metadata is required');
      END;

      CREATE TRIGGER trg_source_texts_import_metadata_update
      BEFORE UPDATE ON source_texts
      FOR EACH ROW
      WHEN
        NEW.original_file_name IS NULL OR
        length(trim(NEW.original_file_name)) = 0 OR
        NEW.size_bytes IS NULL OR
        NEW.size_bytes <= 0
      BEGIN
        SELECT RAISE(ABORT, 'source_texts import metadata is required');
      END;
    `);
  },
} as const satisfies Migration;
