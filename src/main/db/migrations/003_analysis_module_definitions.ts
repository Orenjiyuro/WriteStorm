import type { Migration } from '../migration-runner';
import { ANALYSIS_MODULE_DEFINITIONS_SEMANTIC_BOUNDARIES } from './003_analysis_module_definitions_boundaries';

export const ANALYSIS_MODULE_KEY_ALLOWLIST_003 = [
  'structure_and_segments',
  'plot_causality',
  'narrative_pacing',
  'character_relations',
  'world_rules',
  'style_expression',
  'technique_principles',
] as const;

export const ANALYSIS_MODULE_DEFINITION_SEED_003 = [
  { id: 'structure_and_segments', key: 'structure_and_segments', name: '作品结构与分段', category: 'structure_input', createsModuleInstance: 1, sortOrder: 0 },
  { id: 'plot_causality', key: 'plot_causality', name: '情节大纲与因果', category: 'analysis', createsModuleInstance: 1, sortOrder: 1 },
  { id: 'narrative_pacing', key: 'narrative_pacing', name: '叙事结构、信息释放与节奏', category: 'analysis', createsModuleInstance: 1, sortOrder: 2 },
  { id: 'character_relations', key: 'character_relations', name: '人物系统与关系', category: 'analysis', createsModuleInstance: 1, sortOrder: 3 },
  { id: 'world_rules', key: 'world_rules', name: '世界设定与规则', category: 'analysis', createsModuleInstance: 1, sortOrder: 4 },
  { id: 'style_expression', key: 'style_expression', name: '文风语言与表达', category: 'analysis', createsModuleInstance: 1, sortOrder: 5 },
  { id: 'technique_principles', key: 'technique_principles', name: '写作技法与可复用原则', category: 'analysis', createsModuleInstance: 1, sortOrder: 6 },
] as const;

const moduleKeyAllowlistSql = ANALYSIS_MODULE_KEY_ALLOWLIST_003
  .map((moduleKey) => `'${moduleKey.replaceAll("'", "''")}'`)
  .join(', ');

export const ANALYSIS_MODULE_DEFINITIONS_MIGRATION = {
  id: 3,
  name: 'analysis_module_definitions',
  up(database) {
    database.exec(`
      CREATE TABLE analysis_modules (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE CHECK (key IN (${moduleKeyAllowlistSql})),
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        category TEXT NOT NULL CHECK (category IN ('structure_input', 'analysis')),
        creates_module_instance INTEGER NOT NULL CHECK (creates_module_instance = 1),
        sort_order INTEGER NOT NULL UNIQUE
          CHECK (sort_order >= 0 AND sort_order < ${ANALYSIS_MODULE_DEFINITION_SEED_003.length}),
        CHECK (id = key)
      )
    `);

    const insertDefinition = database.prepare(`
      INSERT INTO analysis_modules
        (id, key, name, category, creates_module_instance, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const definition of ANALYSIS_MODULE_DEFINITION_SEED_003) {
      insertDefinition.run(
        definition.id,
        definition.key,
        definition.name,
        definition.category,
        definition.createsModuleInstance,
        definition.sortOrder,
      );
    }
  },
  semanticWitnesses: [
    {
      id: '003.analysis_module.unique_sort_order',
      migrationId: 3,
      setupSql: `INSERT INTO analysis_modules VALUES (
        'structure_and_segments', 'structure_and_segments', 'Structure',
        'structure_input', 1, 0
      )`,
      sql: `INSERT INTO analysis_modules VALUES (
        'plot_causality', 'plot_causality', 'Plot', 'analysis', 1, 0
      )`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
  ],
  semanticBoundaries: ANALYSIS_MODULE_DEFINITIONS_SEMANTIC_BOUNDARIES,
} as const satisfies Migration;
