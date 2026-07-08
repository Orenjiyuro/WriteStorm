import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
  type AnalysisModuleCategory,
  type AnalysisModuleKey,
  type AnalysisSecondarySystemPageKey,
} from '../../src/shared/domain';

const regularModuleKey: AnalysisModuleKey = 'world_rules';
const secondaryPageKey: AnalysisSecondarySystemPageKey = 'ai_constraint_summary';
const structureCategory: AnalysisModuleCategory = 'structure_input';

// @ts-expect-error AI constraints summary is a secondary system page, not a regular analysis module.
const invalidAnalysisModuleKey: AnalysisModuleKey = 'ai_constraint_summary';

// @ts-expect-error The world/settings module key is fixed as world_rules.
const invalidWorldModuleKey: AnalysisModuleKey = 'world_setting';

describe('analysis module definitions', () => {
  it('locks the seven V1 analysis modules in product order', () => {
    expect(regularModuleKey).toBe('world_rules');
    expect(structureCategory).toBe('structure_input');
    expect(ANALYSIS_MODULE_KEYS).toEqual([
      'structure_and_segments',
      'plot_causality',
      'narrative_pacing',
      'character_relations',
      'world_rules',
      'style_expression',
      'technique_principles',
    ]);
    expect(
      ANALYSIS_MODULE_DEFINITIONS.map((definition) => ({
        key: definition.key,
        name: definition.name,
        category: definition.category,
      })),
    ).toEqual([
      {
        key: 'structure_and_segments',
        name: '作品结构与分段',
        category: 'structure_input',
      },
      {
        key: 'plot_causality',
        name: '情节大纲与因果',
        category: 'analysis',
      },
      {
        key: 'narrative_pacing',
        name: '叙事结构、信息释放与节奏',
        category: 'analysis',
      },
      {
        key: 'character_relations',
        name: '人物系统与关系',
        category: 'analysis',
      },
      {
        key: 'world_rules',
        name: '世界设定与规则',
        category: 'analysis',
      },
      {
        key: 'style_expression',
        name: '文风语言与表达',
        category: 'analysis',
      },
      {
        key: 'technique_principles',
        name: '写作技法与可复用原则',
        category: 'analysis',
      },
    ]);
  });

  it('keeps the structure module distinct from the six ordinary analysis modules', () => {
    const categories = ANALYSIS_MODULE_DEFINITIONS.map((definition) => definition.category);

    expect(categories).toEqual([
      'structure_input',
      'analysis',
      'analysis',
      'analysis',
      'analysis',
      'analysis',
      'analysis',
    ]);
    expect(categories.filter((category) => category === 'analysis')).toHaveLength(6);
  });

  it('keeps module definitions complete and unique against the module key allowlist', () => {
    const definitionKeys = ANALYSIS_MODULE_DEFINITIONS.map((definition) => definition.key);

    expect(definitionKeys).toEqual([...ANALYSIS_MODULE_KEYS]);
    expect(new Set(definitionKeys).size).toBe(ANALYSIS_MODULE_KEYS.length);
  });

  it('keeps AI constraints summary out of regular module instances', () => {
    expect(secondaryPageKey).toBe('ai_constraint_summary');
    expect(ANALYSIS_MODULE_DEFINITIONS.some((definition) => String(definition.key) === secondaryPageKey)).toBe(false);
    expect(ANALYSIS_MODULE_DEFINITIONS.every((definition) => definition.createsModuleInstance)).toBe(true);
    expect(ANALYSIS_SECONDARY_SYSTEM_PAGES).toEqual([
      {
        key: 'ai_constraint_summary',
        name: 'AI 约束摘要',
        category: 'secondary_system_page',
        createsModuleInstance: false,
      },
    ]);
  });
});
