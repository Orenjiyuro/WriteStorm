import type { Migration } from '../migration-runner';
import { V1_RUNTIME_BASELINE_MIGRATION } from './001_v1_runtime_baseline';
import { STRUCTURE_WORKSPACE_MIGRATION } from './002_structure_workspace';
import { ANALYSIS_MODULE_DEFINITIONS_MIGRATION } from './003_analysis_module_definitions';
import { ANALYSIS_MODULE_INSTANCES_MIGRATION } from './004_analysis_module_instances';
import { ANALYSIS_MODULE_ASSET_PLACEHOLDERS_MIGRATION } from './005_analysis_module_asset_placeholders';
export { assertMigrationRegistry } from '../migration-runner';

export const APP_MIGRATIONS = [
  V1_RUNTIME_BASELINE_MIGRATION,
  STRUCTURE_WORKSPACE_MIGRATION,
  ANALYSIS_MODULE_DEFINITIONS_MIGRATION,
  ANALYSIS_MODULE_INSTANCES_MIGRATION,
  ANALYSIS_MODULE_ASSET_PLACEHOLDERS_MIGRATION,
] as const satisfies readonly Migration[];
