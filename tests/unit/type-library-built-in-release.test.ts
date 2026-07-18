import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_CONTENT_FOCUS_OPTIONS_V1,
  BUILT_IN_MAIN_TYPE_OPTIONS_V1,
  BUILT_IN_TYPE_OPTIONS_V1,
  TYPE_LIBRARY_VERSION_1,
  typeDefinitionSchema,
  typeDefinitionVersionSchema,
  typeLibraryVersionSchema,
} from '../../src/shared/domain';

const expectedMainTypes = [
  ['builtin_main_001', '日轻校园'],
  ['builtin_main_002', '日轻异界'],
  ['builtin_main_003', '现代都市'],
  ['builtin_main_004', '现代幻想'],
  ['builtin_main_005', '古代幻想'],
  ['builtin_main_006', '西式幻想'],
  ['builtin_main_007', '诸天无限'],
] as const;

const expectedContentFocuses = [
  ['builtin_focus_001', '恋爱炒股'],
  ['builtin_focus_002', '英雄史诗'],
  ['builtin_focus_003', '能力规则'],
  ['builtin_focus_004', '种田运营'],
  ['builtin_focus_005', '群像'],
  ['builtin_focus_006', '事业'],
  ['builtin_focus_007', '冒险探索'],
] as const;

describe('TypeLibraryVersion 1 built-in release contract', () => {
  it('assigns the approved K1 identities to all fourteen exact copies', () => {
    expect(BUILT_IN_MAIN_TYPE_OPTIONS_V1.map(({ definition, definitionVersion }) => [
      definition.stableKey,
      definitionVersion.displayName,
    ])).toEqual(expectedMainTypes);
    expect(BUILT_IN_CONTENT_FOCUS_OPTIONS_V1.map(({ definition, definitionVersion }) => [
      definition.stableKey,
      definitionVersion.displayName,
    ])).toEqual(expectedContentFocuses);
    expect(BUILT_IN_TYPE_OPTIONS_V1).toHaveLength(14);

    for (const option of BUILT_IN_TYPE_OPTIONS_V1) {
      expect(typeDefinitionSchema.safeParse(option.definition).success).toBe(true);
      expect(typeDefinitionVersionSchema.safeParse(option.definitionVersion).success).toBe(true);
      expect(option.definition.id).toBe(option.definition.stableKey);
      expect(option.definition.origin).toBe('built_in');
      expect(option.definitionVersion.typeDefinitionId).toBe(option.definition.id);
      expect(option.definitionVersion.id).toBe(`${option.definition.stableKey}_v1`);
      expect(option.definitionVersion.version).toBe(1);
      expect(option).not.toHaveProperty('methodology');
      expect(option).not.toHaveProperty('promptTemplate');
    }
  });

  it('publishes one immutable fourteen-entry release with per-kind display order', () => {
    expect(typeLibraryVersionSchema.safeParse(TYPE_LIBRARY_VERSION_1).success).toBe(true);
    expect(TYPE_LIBRARY_VERSION_1.version).toBe(1);
    expect(TYPE_LIBRARY_VERSION_1.entries).toHaveLength(14);
    expect(TYPE_LIBRARY_VERSION_1.entries.filter(({ kind }) => kind === 'main_type')
      .map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(TYPE_LIBRARY_VERSION_1.entries.filter(({ kind }) => kind === 'content_focus')
      .map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(TYPE_LIBRARY_VERSION_1.entries.map(({ typeDefinitionId }) => typeDefinitionId)).size).toBe(14);
    expect(new Set(TYPE_LIBRARY_VERSION_1.entries.map(({ typeDefinitionVersionId }) =>
      typeDefinitionVersionId)).size).toBe(14);

    expect(typeLibraryVersionSchema.safeParse({
      ...TYPE_LIBRARY_VERSION_1,
      methodologyVersionId: 'not-owned-by-release',
    }).success).toBe(false);
  });
});
