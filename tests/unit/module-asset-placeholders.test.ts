import { describe, expect, it } from 'vitest';
import {
  AnalysisModuleAssetPlaceholderError,
  createAnalysisModuleAssetPlaceholders,
} from '../../src/shared/domain';

describe('analysis module asset placeholders', () => {
  it('derives empty slots from the authoritative module asset matrix', () => {
    expect(createAnalysisModuleAssetPlaceholders('structure_and_segments')).toEqual([
      { slotKind: 'body', assetKinds: ['body'], availability: 'empty', emptyState: '尚无资产' },
      { slotKind: 'evidence', assetKinds: ['evidence_anchor'], availability: 'empty', emptyState: '尚无资产' },
    ]);
    expect(createAnalysisModuleAssetPlaceholders('plot_causality')).toEqual([
      { slotKind: 'body', assetKinds: ['body'], availability: 'empty', emptyState: '尚无资产' },
      { slotKind: 'evidence', assetKinds: ['evidence_anchor'], availability: 'empty', emptyState: '尚无资产' },
      { slotKind: 'relation', assetKinds: ['relation_link'], availability: 'empty', emptyState: '尚无资产' },
      { slotKind: 'technique', assetKinds: ['work_technique_observation'], availability: 'empty', emptyState: '尚无资产' },
      { slotKind: 'ai_constraint', assetKinds: ['ai_constraint'], availability: 'empty', emptyState: '尚无资产' },
    ]);
    expect(createAnalysisModuleAssetPlaceholders('technique_principles')[3]).toEqual({
      slotKind: 'technique',
      assetKinds: ['work_technique_observation', 'reusable_technique_candidate'],
      availability: 'empty',
      emptyState: '尚无资产',
    });
  });

  it('keeps ai_constraint distinct from the ai_constraint_summary secondary page', () => {
    expect(createAnalysisModuleAssetPlaceholders('world_rules'))
      .toContainEqual(expect.objectContaining({ slotKind: 'ai_constraint' }));
    expect(() => createAnalysisModuleAssetPlaceholders('ai_constraint_summary'))
      .toThrowError(new AnalysisModuleAssetPlaceholderError('module_contract_unavailable'));
  });
});
