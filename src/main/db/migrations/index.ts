import type { Migration } from '../migration-runner';
import { V1_RUNTIME_BASELINE_MIGRATION } from './001_v1_runtime_baseline';
import { STRUCTURE_WORKSPACE_MIGRATION } from './002_structure_workspace';
export { assertMigrationRegistry } from '../migration-runner';

export const APP_MIGRATIONS = [
  V1_RUNTIME_BASELINE_MIGRATION,
  STRUCTURE_WORKSPACE_MIGRATION,
] as const satisfies readonly Migration[];
