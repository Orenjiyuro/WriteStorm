import type { Migration } from '../migration-runner';
import {
  ANALYSIS_MODULE_ASSET_PLACEHOLDERS_SEMANTIC_BOUNDARIES,
  ANALYSIS_MODULE_BODY_PLACEHOLDER_SETUP,
} from './005_analysis_module_asset_placeholders_boundaries';

export const ANALYSIS_MODULE_ASSET_PLACEHOLDERS_MIGRATION = {
  id: 5,
  name: 'analysis_module_asset_placeholders',
  up(database) {
    database.exec(`
      ALTER TABLE analysis_module_instances
      ADD COLUMN body_markdown TEXT NOT NULL DEFAULT ''
        CHECK (typeof(body_markdown) = 'text')
    `);
  },
  semanticWitnesses: [
    {
      id: '005.analysis_module_asset.body_text',
      migrationId: 5,
      setupSql: ANALYSIS_MODULE_BODY_PLACEHOLDER_SETUP,
      sql: `UPDATE analysis_module_instances
        SET body_markdown = CAST(X'00' AS BLOB) WHERE id = 'instance'`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
    },
  ],
  semanticBoundaries: ANALYSIS_MODULE_ASSET_PLACEHOLDERS_SEMANTIC_BOUNDARIES,
} as const satisfies Migration;
