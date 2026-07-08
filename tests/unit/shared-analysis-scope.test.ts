import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_SCOPE_MATRIX,
  ANALYSIS_SCOPE_EXCLUDED_TARGETS,
  SCOPE_KINDS,
  STRUCTURE_NODE_KINDS,
  type AnalysisModuleScopeMatrixEntry,
  type AnalysisModuleScopeRelation,
  type ScopeKind,
  type StructureNodeKind,
} from '../../src/shared/domain';

const expectedScopeMatrix = [
  {
    moduleKey: 'structure_and_segments',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'structure_range_layer',
  },
  {
    moduleKey: 'plot_causality',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'narrative_pacing',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'character_relations',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'world_rules',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'style_expression',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'technique_principles',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
] as const satisfies readonly AnalysisModuleScopeMatrixEntry[];

const storyRangeScope: ScopeKind = 'story_segment_range';
const titleTreeKind: StructureNodeKind = 'chapter';
const structureStoryRangeRelation: AnalysisModuleScopeRelation = 'structure_range_layer';

// @ts-expect-error StorySegmentRange is a scope/range layer, not a title-tree structure node kind.
const invalidStructureNodeKind: StructureNodeKind = 'story_segment_range';

// @ts-expect-error Scope terminology is story_segment_range, not story_range.
const invalidScopeKind: ScopeKind = 'story_range';

describe('analysis module scope matrix', () => {
  it('locks the supported scope matrix for all seven modules', () => {
    expect(storyRangeScope).toBe('story_segment_range');
    expect(titleTreeKind).toBe('chapter');
    expect(SCOPE_KINDS).toEqual(['book', 'volume', 'chapter', 'story_segment_range']);
    expect(ANALYSIS_MODULE_SCOPE_MATRIX).toEqual(expectedScopeMatrix);
  });

  it('marks structure story ranges as a range layer instead of a title-tree node', () => {
    const structureEntry = ANALYSIS_MODULE_SCOPE_MATRIX[0];

    expect(structureStoryRangeRelation).toBe('structure_range_layer');
    expect(structureEntry).toMatchObject({
      moduleKey: 'structure_and_segments',
      storySegmentRangeRelation: 'structure_range_layer',
    });
    expect(STRUCTURE_NODE_KINDS).toEqual(['book', 'volume', 'chapter']);
    expect(STRUCTURE_NODE_KINDS.includes('story_segment_range' as StructureNodeKind)).toBe(false);
  });

  it('keeps the scope matrix complete and unique against the module key allowlist', () => {
    const matrixKeys = ANALYSIS_MODULE_SCOPE_MATRIX.map((entry) => entry.moduleKey);

    expect(matrixKeys).toEqual([...ANALYSIS_MODULE_KEYS]);
    expect(new Set(matrixKeys).size).toBe(ANALYSIS_MODULE_KEYS.length);
  });

  it('keeps secondary system pages and thematic perspectives outside the module scope matrix', () => {
    expect(ANALYSIS_SCOPE_EXCLUDED_TARGETS).toEqual([
      {
        targetKey: 'ai_constraint_summary',
        targetKind: 'secondary_system_page',
        attemptedScope: 'book',
        reason: 'AI 约束摘要是二级系统页，不生成普通 AnalysisModuleInstance。',
      },
      {
        targetKey: 'thematic_perspective',
        targetKind: 'derived_view_family',
        attemptedScope: 'story_segment_range',
        reason: '专题视角是跨模块派生视图，不属于 AnalysisModule scope matrix。',
      },
    ]);
    expect(
      ANALYSIS_MODULE_SCOPE_MATRIX.some((entry) => String(entry.moduleKey) === 'thematic_perspective'),
    ).toBe(false);
    expect(
      ANALYSIS_MODULE_SCOPE_MATRIX.some((entry) => String(entry.moduleKey) === 'ai_constraint_summary'),
    ).toBe(false);
  });
});
