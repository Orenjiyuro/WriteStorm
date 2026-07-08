import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_MODULE_KEYS,
  PERSPECTIVE_DEFINITIONS,
  PERSPECTIVE_KEYS,
  type AnalysisModuleKey,
  type PerspectiveDefinition,
  type PerspectiveKey,
} from '../../src/shared/domain';

const foreshadowingKey: PerspectiveKey = 'foreshadowing_suspense_payoff';
const characterDynamicsKey: PerspectiveKey = 'character_relation_dynamics';
const settingRuleKey: PerspectiveKey = 'setting_rule_payoff';
const pacingDriveKey: PerspectiveKey = 'pacing_emotion_drive';
const techniqueSourceKey: PerspectiveKey = 'technique_source_trace';

// @ts-expect-error V1 perspective keys must use the locked stable vocabulary.
const invalidForeshadowingKey: PerspectiveKey = 'foreshadowing_payoff';

// @ts-expect-error Built-in perspectives are not ordinary analysis modules.
const invalidPerspectiveAsAnalysisModule: AnalysisModuleKey = 'foreshadowing_suspense_payoff';

const expectedPerspectiveDefinitions = [
  {
    key: 'foreshadowing_suspense_payoff',
    name: '伏笔/悬念/回收链',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'character_relation_dynamics',
    name: '人物关系动力/身份互动',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'setting_rule_payoff',
    name: '设定展开/规则兑现',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'pacing_emotion_drive',
    name: '节奏/情绪/阅读驱动力',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'technique_source_trace',
    name: '可复用技法来源视角',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
] as const satisfies readonly PerspectiveDefinition[];

describe('built-in perspective definitions', () => {
  it('locks the five V1 built-in perspective keys in product order', () => {
    expect(foreshadowingKey).toBe('foreshadowing_suspense_payoff');
    expect(characterDynamicsKey).toBe('character_relation_dynamics');
    expect(settingRuleKey).toBe('setting_rule_payoff');
    expect(pacingDriveKey).toBe('pacing_emotion_drive');
    expect(techniqueSourceKey).toBe('technique_source_trace');
    expect(PERSPECTIVE_KEYS).toEqual([
      'foreshadowing_suspense_payoff',
      'character_relation_dynamics',
      'setting_rule_payoff',
      'pacing_emotion_drive',
      'technique_source_trace',
    ]);
  });

  it('locks the five V1 built-in perspective names without making them fact sources', () => {
    expect(PERSPECTIVE_DEFINITIONS).toEqual(expectedPerspectiveDefinitions);
    expect(PERSPECTIVE_DEFINITIONS).toHaveLength(5);

    for (const definition of PERSPECTIVE_DEFINITIONS) {
      expect(definition.kind).toBe('derived_composite_view');
      expect(definition.createsAnalysisModuleInstance).toBe(false);
      expect(definition.isFactSource).toBe(false);
      expect(definition.mayStoreViewInstance).toBe(true);
    }
  });

  it('keeps perspective definitions complete and unique against the perspective key allowlist', () => {
    const definitionKeys = PERSPECTIVE_DEFINITIONS.map((definition) => definition.key);

    expect(definitionKeys).toEqual([...PERSPECTIVE_KEYS]);
    expect(new Set(definitionKeys).size).toBe(PERSPECTIVE_KEYS.length);
  });

  it('does not add built-in perspectives to the seven ordinary analysis modules', () => {
    const analysisDefinitionKeys = ANALYSIS_MODULE_DEFINITIONS.map((definition) => definition.key);

    expect(ANALYSIS_MODULE_KEYS).toHaveLength(7);
    expect(analysisDefinitionKeys).toEqual([...ANALYSIS_MODULE_KEYS]);

    for (const perspectiveKey of PERSPECTIVE_KEYS) {
      expect(ANALYSIS_MODULE_KEYS.includes(perspectiveKey as AnalysisModuleKey)).toBe(false);
      expect(analysisDefinitionKeys.includes(perspectiveKey as AnalysisModuleKey)).toBe(false);
    }
  });
});
