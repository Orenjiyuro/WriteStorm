import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_ASSET_KINDS,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_ASSET_MATRIX,
  ANALYSIS_TECHNIQUE_OBSERVATION_ROUTING,
  type AnalysisAssetKind,
  type AnalysisModuleAssetMatrixEntry,
} from '../../src/shared/domain';

const bodyAsset: AnalysisAssetKind = 'body';
const structuredAsset: AnalysisAssetKind = 'structured_object';

// @ts-expect-error Markdown body is not a structured fact or hidden asset bucket.
const invalidMarkdownFactAsset: AnalysisAssetKind = 'markdown_fact';

// @ts-expect-error Reusable technique candidates use the stable candidate asset kind.
const invalidTechniqueCandidateAsset: AnalysisAssetKind = 'technique_entry';

const expectedAssetMatrix = [
  {
    moduleKey: 'structure_and_segments',
    allowedAssetKinds: ['body', 'structured_object', 'evidence_anchor'],
  },
  {
    moduleKey: 'plot_causality',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'narrative_pacing',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'character_relations',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'world_rules',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'style_expression',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'technique_principles',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'reusable_technique_candidate',
      'ai_constraint',
    ],
  },
] as const satisfies readonly AnalysisModuleAssetMatrixEntry[];

describe('analysis module asset matrix', () => {
  it('locks the V1 analysis asset kind vocabulary', () => {
    expect(bodyAsset).toBe('body');
    expect(structuredAsset).toBe('structured_object');
    expect(ANALYSIS_ASSET_KINDS).toEqual([
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'reusable_technique_candidate',
      'ai_constraint',
    ]);
  });

  it('locks the allowed asset kinds for each of the seven modules', () => {
    expect(ANALYSIS_MODULE_ASSET_MATRIX).toEqual(expectedAssetMatrix);
  });

  it('keeps the asset matrix complete and unique against the module key allowlist', () => {
    const matrixKeys = ANALYSIS_MODULE_ASSET_MATRIX.map((entry) => entry.moduleKey);

    expect(matrixKeys).toEqual([...ANALYSIS_MODULE_KEYS]);
    expect(new Set(matrixKeys).size).toBe(ANALYSIS_MODULE_KEYS.length);
  });

  it('prevents Markdown body from becoming the only module output bucket', () => {
    for (const entry of ANALYSIS_MODULE_ASSET_MATRIX) {
      expect(entry.allowedAssetKinds).toContain('body');
      expect(entry.allowedAssetKinds.some((assetKind) => assetKind !== 'body')).toBe(true);
    }
  });

  it('routes cross-module technique observations into the technique module review path', () => {
    expect(ANALYSIS_TECHNIQUE_OBSERVATION_ROUTING).toEqual({
      assetKind: 'work_technique_observation',
      sourceModuleKeys: [
        'plot_causality',
        'narrative_pacing',
        'character_relations',
        'world_rules',
        'style_expression',
        'technique_principles',
      ],
      reviewModuleKey: 'technique_principles',
    });
  });
});
