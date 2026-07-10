import type { Migration } from '../migration-runner';
import { FOUNDATION_SCHEMA_MIGRATION } from './001_foundation_schema';
import { CONTENT_MODEL_SHELL_MIGRATION } from './002_content_model_shell';
import { SOURCE_IMPORT_METADATA_MIGRATION } from './003_source_import_metadata';
export { assertMigrationRegistry } from '../migration-runner';

export const APP_MIGRATIONS = [
  FOUNDATION_SCHEMA_MIGRATION,
  CONTENT_MODEL_SHELL_MIGRATION,
  SOURCE_IMPORT_METADATA_MIGRATION,
] as const satisfies readonly Migration[];
