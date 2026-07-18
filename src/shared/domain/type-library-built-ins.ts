import type { TypeDefinitionId, TypeDefinitionVersionId } from './ids';
import type {
  TypeDefinition,
  TypeDefinitionKind,
  TypeDefinitionVersion,
  TypeLibraryVersion,
} from './type-library';

const TYPE_LIBRARY_V1_CREATED_AT = '2026-07-17T00:00:00.000Z';

export type BuiltInTypeOptionV1 = {
  readonly definition: TypeDefinition;
  readonly definitionVersion: TypeDefinitionVersion;
  readonly sortOrder: number;
};

function createBuiltInTypeOptionV1(input: {
  readonly stableKey: string;
  readonly kind: TypeDefinitionKind;
  readonly displayName: string;
  readonly selectionDescription: string;
  readonly sortOrder: number;
}): BuiltInTypeOptionV1 {
  const definitionId = input.stableKey as TypeDefinitionId;
  return {
    definition: {
      id: definitionId,
      kind: input.kind,
      origin: 'built_in',
      stableKey: input.stableKey,
    },
    definitionVersion: {
      id: `${input.stableKey}_v1` as TypeDefinitionVersionId,
      typeDefinitionId: definitionId,
      version: 1,
      displayName: input.displayName,
      selectionDescription: input.selectionDescription,
      createdAt: TYPE_LIBRARY_V1_CREATED_AT,
    },
    sortOrder: input.sortOrder,
  };
}

export const BUILT_IN_MAIN_TYPE_OPTIONS_V1 = [
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_001',
    kind: 'main_type',
    displayName: '日轻校园',
    selectionDescription: '以校园、社团为主要舞台，用轻小说式节奏展开青春日常、恋爱喜剧、群像互动或校园中的异常事件，注重人与人之间关系的描写。',
    sortOrder: 0,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_002',
    kind: 'main_type',
    displayName: '日轻异界',
    selectionDescription: '以DQ为蓝本的日式西幻世界舞台，围绕异世界探索、异能\\金手指规则、伙伴关系、冒险等内容描写。',
    sortOrder: 1,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_003',
    kind: 'main_type',
    displayName: '现代都市',
    selectionDescription: '以现实社会为舞台，围绕主角拥有的金手指，可能重点描写人际关系互动，也可能重点描写事业经营。',
    sortOrder: 2,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_004',
    kind: 'main_type',
    displayName: '现代幻想',
    selectionDescription: '在现代社会结构中引入修行、怪异、异能、神秘组织等超常体系，重点表现日常现实与隐秘力量世界的交织。',
    sortOrder: 3,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_005',
    kind: 'main_type',
    displayName: '古代幻想',
    selectionDescription: '以中国古代或古典东方世界为基础，通过王朝、宗门、修行、神魔和江湖秩序推动人物成长、权力斗争与世界变局。',
    sortOrder: 4,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_006',
    kind: 'main_type',
    displayName: '西式幻想',
    selectionDescription: '以欧洲中世纪式文明为主要审美基础，围绕帝国、宗教、种族、魔法、战争及文明兴衰展开宏观幻想叙事。',
    sortOrder: 5,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_main_007',
    kind: 'main_type',
    displayName: '诸天无限',
    selectionDescription: '主角团在不同的世界冒险探索，重点展示不同世界的独特规则\\生态，描写对其摸索理解。',
    sortOrder: 6,
  }),
] as const;

export const BUILT_IN_CONTENT_FOCUS_OPTIONS_V1 = [
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_001',
    kind: 'content_focus',
    displayName: '恋爱炒股',
    selectionDescription: '男主和多个女主之间的情感纠葛，女主的塑造是重中之重。主要阅读和不同女主的互动，读者一般有最支持的一名。',
    sortOrder: 0,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_002',
    kind: 'content_focus',
    displayName: '英雄史诗',
    selectionDescription: '主角和众人抗争命运、轰轰烈烈的战争。核心看众人如何在高压环境下成长、挣扎。',
    sortOrder: 1,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_003',
    kind: 'content_focus',
    displayName: '能力规则',
    selectionDescription: '主要关注不同角色的技能效果、限制、成长，结合情报博弈，不同能力之间如何碰撞出火花。',
    sortOrder: 2,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_004',
    kind: 'content_focus',
    displayName: '种田运营',
    selectionDescription: '如何用更高领先的知识引领社会发展，如何分配剧情中获得的资源建设社会。',
    sortOrder: 3,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_005',
    kind: 'content_focus',
    displayName: '群像',
    selectionDescription: '主角只是主要视角，但不等于独占剧情分量。重点看不同角色的成长，互相之间由交织出怎样的故事。',
    sortOrder: 4,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_006',
    kind: 'content_focus',
    displayName: '事业',
    selectionDescription: '如何运用眼光、金手指等个人资源去发展事业。',
    sortOrder: 5,
  }),
  createBuiltInTypeOptionV1({
    stableKey: 'builtin_focus_007',
    kind: 'content_focus',
    displayName: '冒险探索',
    selectionDescription: '在一个又一个崭新的环境，一点点探索揭露新的情报资讯，努力冒险。重点关注不同的情景\\压力设置，和如何突破难关又最终获得什么样的回报。',
    sortOrder: 6,
  }),
] as const;

export const BUILT_IN_TYPE_OPTIONS_V1 = [
  ...BUILT_IN_MAIN_TYPE_OPTIONS_V1,
  ...BUILT_IN_CONTENT_FOCUS_OPTIONS_V1,
] as const;

export const TYPE_LIBRARY_VERSION_1 = {
  version: 1,
  entries: BUILT_IN_TYPE_OPTIONS_V1.map((option) => ({
    typeDefinitionId: option.definition.id,
    typeDefinitionVersionId: option.definitionVersion.id,
    kind: option.definition.kind,
    sortOrder: option.sortOrder,
  })),
  createdAt: TYPE_LIBRARY_V1_CREATED_AT,
} as const satisfies TypeLibraryVersion;
