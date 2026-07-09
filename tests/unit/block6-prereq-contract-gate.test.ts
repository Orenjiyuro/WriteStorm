import { describe, expect, it } from 'vitest';
import {
  getContract,
  PRODUCT_IPC_CHANNELS,
} from '../../src/shared/contracts';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  PERSPECTIVE_DEFINITIONS,
  TECHNIQUE_ASSET_OWNERSHIP,
} from '../../src/shared/domain';

describe('Block 6 prerequisite contract gate', () => {
  it('keeps the existing library IPC channels available without renderer-provided paths', () => {
    expect(PRODUCT_IPC_CHANNELS).toEqual(expect.arrayContaining([
      'library:create',
      'library:open',
      'library:get-current',
    ]));

    expect(getContract('library:create').request.safeParse({}).success).toBe(true);
    expect(getContract('library:open').request.safeParse({}).success).toBe(true);
    expect(getContract('library:get-current').request.safeParse({}).success).toBe(true);
    expect(getContract('library:create').request.safeParse({ rootPath: 'C:\\Library' }).success).toBe(false);
    expect(getContract('library:open').request.safeParse({ rootPath: 'C:\\Library' }).success).toBe(false);
  });

  it('confirms the Block 3-5 content boundaries exist before SQLite work starts', () => {
    expect(ANALYSIS_MODULE_DEFINITIONS).toHaveLength(7);
    expect(TECHNIQUE_ASSET_OWNERSHIP.workTechniqueObservation.ownerKind).toBe('breakdown_book');
    expect(TECHNIQUE_ASSET_OWNERSHIP.reusableTechniqueCandidate.ownerKind).toBe('breakdown_book');
    expect(TECHNIQUE_ASSET_OWNERSHIP.techniqueEntry.ownerKind).toBe('technique_library');
    expect(PERSPECTIVE_DEFINITIONS).toHaveLength(5);
    expect(PERSPECTIVE_DEFINITIONS.every((definition) => definition.createsAnalysisModuleInstance === false)).toBe(
      true,
    );
  });
});
