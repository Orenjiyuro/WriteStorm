import { describe, expect, it } from 'vitest';
import {
  PERSPECTIVE_DEPENDENCY_MATRIX,
  PERSPECTIVE_TECHNIQUE_RELATION,
  PERSPECTIVE_TECHNIQUE_RELATION_FIXTURE,
  TECHNIQUE_ASSET_OWNERSHIP,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
  type PerspectiveTechniqueRelation,
  type PerspectiveTechniqueRelationFixture,
  type PerspectiveTechniqueModuleAssetKind,
  type PerspectiveTechniqueTraceAssetKind,
} from '../../src/shared/domain';

const moduleSavedAsset: PerspectiveTechniqueModuleAssetKind = 'work_technique_observation';
const tracedAsset: PerspectiveTechniqueTraceAssetKind = 'reusable_technique_candidate';

// @ts-expect-error TechniqueEntry is a technique-library asset, not a perspective trace source.
const invalidTraceAsset: PerspectiveTechniqueTraceAssetKind = 'technique_entry';

const expectedTechniqueRelation = {
  perspectiveKey: 'technique_source_trace',
  techniqueModule: {
    moduleKey: 'technique_principles',
    savesAssetKinds: ['work_technique_observation', 'reusable_technique_candidate'],
    authoritativeForSavedAssets: true,
    savesTechniqueEntry: false,
  },
  perspectiveTrace: {
    role: 'source_chain_trace_only',
    tracedAssetKinds: [
      'work_technique_observation',
      'reusable_technique_candidate',
      'evidence_anchor',
    ],
    mayCreateTechniqueAssets: false,
    mayEditTechniqueAssets: false,
    mayAdoptTechniqueEntry: false,
    mayCreateTechniqueEntry: false,
    mayStoreTechniqueEntry: false,
  },
  techniqueLibrary: {
    assetKind: 'technique_entry',
    ownerKind: 'technique_library',
    entryBelongsToFusionTechniqueLibrary: true,
    perspectiveMayAdoptTechniqueEntry: false,
    perspectiveMayMutateTechniqueEntry: false,
  },
} as const satisfies PerspectiveTechniqueRelation;

const expectedCrossDomainFixture = {
  perspectiveKey: 'technique_source_trace',
  techniqueModuleStores: ['work_technique_observation', 'reusable_technique_candidate'],
  perspectiveTraceOnlyAssets: [
    'work_technique_observation',
    'reusable_technique_candidate',
    'evidence_anchor',
  ],
  techniqueLibraryOwns: 'technique_entry',
  techniqueEntryOwnerKind: 'technique_library',
  perspectiveMayAdoptTechniqueEntry: false,
  perspectiveMayCreateTechniqueEntry: false,
  perspectiveMayStoreTechniqueEntry: false,
  perspectiveMayEditObservationOrCandidate: false,
} as const satisfies PerspectiveTechniqueRelationFixture;

const invalidAdoptionFixture = {
  ...expectedCrossDomainFixture,
  // @ts-expect-error A perspective cannot adopt TechniqueEntry.
  perspectiveMayAdoptTechniqueEntry: true,
} satisfies PerspectiveTechniqueRelationFixture;

describe('perspective technique-source relation contract', () => {
  it('keeps observations and reusable candidates saved by the technique module boundary', () => {
    expect(moduleSavedAsset).toBe('work_technique_observation');
    expect(PERSPECTIVE_TECHNIQUE_RELATION.techniqueModule).toEqual(
      expectedTechniqueRelation.techniqueModule,
    );
    expect(TECHNIQUE_ASSET_OWNERSHIP.workTechniqueObservation.ownerKind).toBe('breakdown_book');
    expect(TECHNIQUE_ASSET_OWNERSHIP.reusableTechniqueCandidate.ownerKind).toBe('breakdown_book');
    expect(PERSPECTIVE_TECHNIQUE_RELATION.techniqueModule.savesTechniqueEntry).toBe(false);
  });

  it('allows the technique source perspective to trace source chains only', () => {
    const techniqueSourceDependencies = PERSPECTIVE_DEPENDENCY_MATRIX.find(
      (entry) => entry.perspectiveKey === 'technique_source_trace',
    );

    expect(tracedAsset).toBe('reusable_technique_candidate');
    expect(invalidTraceAsset).toBe('technique_entry');
    expect(PERSPECTIVE_TECHNIQUE_RELATION.perspectiveTrace).toEqual(
      expectedTechniqueRelation.perspectiveTrace,
    );
    expect(techniqueSourceDependencies?.dependencies.map((dependency) => dependency.assetKind)).toEqual([
      'analysis_module_instance',
      'work_technique_observation',
      'reusable_technique_candidate',
      'evidence_anchor',
      'relation_link',
    ]);
    expect(PERSPECTIVE_TECHNIQUE_RELATION.perspectiveTrace.mayCreateTechniqueAssets).toBe(false);
    expect(PERSPECTIVE_TECHNIQUE_RELATION.perspectiveTrace.mayEditTechniqueAssets).toBe(false);
  });

  it('keeps TechniqueEntry owned by the fusion technique library', () => {
    expect(PERSPECTIVE_TECHNIQUE_RELATION.techniqueLibrary).toEqual(
      expectedTechniqueRelation.techniqueLibrary,
    );
    expect(TECHNIQUE_ASSET_OWNERSHIP.techniqueEntry.ownerKind).toBe('technique_library');
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopySource).toBe('adopted_candidates');
    expect(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.mayBypassAdoptedCandidateForPrimaryCreate).toBe(
      false,
    );
    expect(PERSPECTIVE_TECHNIQUE_RELATION.techniqueLibrary.perspectiveMayAdoptTechniqueEntry).toBe(
      false,
    );
    expect(invalidAdoptionFixture.perspectiveMayAdoptTechniqueEntry).toBe(true);
  });

  it('exposes a cross-domain fixture that keeps all three layers distinct', () => {
    expect(PERSPECTIVE_TECHNIQUE_RELATION).toEqual(expectedTechniqueRelation);
    expect(PERSPECTIVE_TECHNIQUE_RELATION_FIXTURE).toEqual(expectedCrossDomainFixture);
    expect(PERSPECTIVE_TECHNIQUE_RELATION_FIXTURE.techniqueModuleStores).not.toContain(
      'technique_entry',
    );
    expect(PERSPECTIVE_TECHNIQUE_RELATION_FIXTURE.perspectiveTraceOnlyAssets).not.toContain(
      'technique_entry',
    );
  });
});
