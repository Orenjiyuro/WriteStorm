import type { SchemaSemanticBoundary } from '../schema-semantic-witness';
import {
  ANALYSIS_MODULE_INSTANCE_BASE_SETUP,
  instance,
} from './004_analysis_module_instances_boundaries';

export const ANALYSIS_MODULE_BODY_PLACEHOLDER_SETUP =
  `${ANALYSIS_MODULE_INSTANCE_BASE_SETUP}; ${instance()}`;

export const ANALYSIS_MODULE_ASSET_PLACEHOLDERS_SEMANTIC_BOUNDARIES = [
  {
    id: '005.analysis_module_asset.body_text',
    migrationId: 5,
    kind: 'check',
    accept: {
      setupSql: ANALYSIS_MODULE_BODY_PLACEHOLDER_SETUP,
      sql: `UPDATE analysis_module_instances SET body_markdown = '' WHERE id = 'instance'`,
    },
    reject: {
      setupSql: ANALYSIS_MODULE_BODY_PLACEHOLDER_SETUP,
      sql: `UPDATE analysis_module_instances
        SET body_markdown = CAST(X'00' AS BLOB) WHERE id = 'instance'`,
      code: 'SQLITE_CONSTRAINT_CHECK',
    },
  },
] as const satisfies readonly SchemaSemanticBoundary[];
