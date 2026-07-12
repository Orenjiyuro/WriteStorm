import type { Migration } from '../migration-runner';
import { V1_RUNTIME_BASELINE_MIGRATION } from './001_v1_runtime_baseline';
export { assertMigrationRegistry } from '../migration-runner';

export const APP_MIGRATIONS = [
  V1_RUNTIME_BASELINE_MIGRATION,
] as const satisfies readonly Migration[];
