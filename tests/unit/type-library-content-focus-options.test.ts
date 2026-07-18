import { describe, expect, it } from 'vitest';
import { builtInTypeOptionProposalSchema } from '../../src/shared/domain';
import { BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-content-focus-options';

const expectedOptions = [
  {
    stableKey: 'builtin_focus_001',
    displayName: '恋爱炒股',
    selectionDescription: '男主和多个女主之间的情感纠葛，女主的塑造是重中之重。主要阅读和不同女主的互动，读者一般有最支持的一名。',
  },
  {
    stableKey: 'builtin_focus_002',
    displayName: '英雄史诗',
    selectionDescription: '主角和众人抗争命运、轰轰烈烈的战争。核心看众人如何在高压环境下成长、挣扎。',
  },
  {
    stableKey: 'builtin_focus_003',
    displayName: '能力规则',
    selectionDescription: '主要关注不同角色的技能效果、限制、成长，结合情报博弈，不同能力之间如何碰撞出火花。',
  },
  {
    stableKey: 'builtin_focus_004',
    displayName: '种田运营',
    selectionDescription: '如何用更高领先的知识引领社会发展，如何分配剧情中获得的资源建设社会。',
  },
  {
    stableKey: 'builtin_focus_005',
    displayName: '群像',
    selectionDescription: '主角只是主要视角，但不等于独占剧情分量。重点看不同角色的成长，互相之间由交织出怎样的故事。',
  },
  {
    stableKey: 'builtin_focus_006',
    displayName: '事业',
    selectionDescription: '如何运用眼光、金手指等个人资源去发展事业。',
  },
  {
    stableKey: 'builtin_focus_007',
    displayName: '冒险探索',
    selectionDescription: '在一个又一个崭新的环境，一点点探索揭露新的情报资讯，努力冒险。重点关注不同的情景\\压力设置，和如何突破难关又最终获得什么样的回报。',
  },
] as const;

describe('Block 12 built-in ContentFocus option copy', () => {
  it('preserves the seven user-confirmed names and descriptions exactly', () => {
    expect(BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS).toHaveLength(7);
    expect(BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS.map(({ stableKey, displayName, selectionDescription }) => ({
      stableKey,
      displayName,
      selectionDescription,
    }))).toEqual(expectedOptions);
  });

  it('keeps released identity outside automatic classification and methodology', () => {
    expect(new Set(BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS.map(({ proposalId }) => proposalId)).size).toBe(7);

    for (const option of BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS) {
      expect(builtInTypeOptionProposalSchema.safeParse(option).success).toBe(true);
      expect(option).toMatchObject({
        kind: 'content_focus',
        ownerKind: 'source_controlled_admission_asset',
        confirmationStatus: 'confirmed',
        selectionAuthority: 'user_only',
        automaticClassification: false,
        methodologyOwner: 'block_14',
      });
      expect(option.stableKey).toMatch(/^builtin_focus_00[1-7]$/);
      expect(option).not.toHaveProperty('entryConditions');
      expect(option).not.toHaveProperty('validationCorpus');
      expect(option).not.toHaveProperty('methodology');
    }
  });
});
