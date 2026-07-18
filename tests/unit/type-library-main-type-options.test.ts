import { describe, expect, it } from 'vitest';
import { builtInTypeOptionProposalSchema } from '../../src/shared/domain';
import { BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-main-type-options';

const expectedOptions = [
  {
    stableKey: 'builtin_main_001',
    displayName: '日轻校园',
    selectionDescription: '以校园、社团为主要舞台，用轻小说式节奏展开青春日常、恋爱喜剧、群像互动或校园中的异常事件，注重人与人之间关系的描写。',
  },
  {
    stableKey: 'builtin_main_002',
    displayName: '日轻异界',
    selectionDescription: '以DQ为蓝本的日式西幻世界舞台，围绕异世界探索、异能\\金手指规则、伙伴关系、冒险等内容描写。',
  },
  {
    stableKey: 'builtin_main_003',
    displayName: '现代都市',
    selectionDescription: '以现实社会为舞台，围绕主角拥有的金手指，可能重点描写人际关系互动，也可能重点描写事业经营。',
  },
  {
    stableKey: 'builtin_main_004',
    displayName: '现代幻想',
    selectionDescription: '在现代社会结构中引入修行、怪异、异能、神秘组织等超常体系，重点表现日常现实与隐秘力量世界的交织。',
  },
  {
    stableKey: 'builtin_main_005',
    displayName: '古代幻想',
    selectionDescription: '以中国古代或古典东方世界为基础，通过王朝、宗门、修行、神魔和江湖秩序推动人物成长、权力斗争与世界变局。',
  },
  {
    stableKey: 'builtin_main_006',
    displayName: '西式幻想',
    selectionDescription: '以欧洲中世纪式文明为主要审美基础，围绕帝国、宗教、种族、魔法、战争及文明兴衰展开宏观幻想叙事。',
  },
  {
    stableKey: 'builtin_main_007',
    displayName: '诸天无限',
    selectionDescription: '主角团在不同的世界冒险探索，重点展示不同世界的独特规则\\生态，描写对其摸索理解。',
  },
] as const;

describe('Block 12 built-in MainType option copy', () => {
  it('preserves the seven user-confirmed names and descriptions exactly', () => {
    expect(BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS).toHaveLength(7);
    expect(BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS.map(({ stableKey, displayName, selectionDescription }) => ({
      stableKey,
      displayName,
      selectionDescription,
    }))).toEqual(expectedOptions);
  });

  it('keeps released identity outside classification logic and methodology', () => {
    expect(new Set(BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS.map(({ proposalId }) => proposalId)).size).toBe(7);

    for (const option of BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS) {
      expect(builtInTypeOptionProposalSchema.safeParse(option).success).toBe(true);
      expect(option).toMatchObject({
        kind: 'main_type',
        ownerKind: 'source_controlled_admission_asset',
        confirmationStatus: 'confirmed',
        selectionAuthority: 'user_only',
        automaticClassification: false,
        methodologyOwner: 'block_14',
      });
      expect(option.stableKey).toMatch(/^builtin_main_00[1-7]$/);
      expect(option).not.toHaveProperty('entryConditions');
      expect(option).not.toHaveProperty('validationCorpus');
      expect(option).not.toHaveProperty('methodology');
    }
  });
});
