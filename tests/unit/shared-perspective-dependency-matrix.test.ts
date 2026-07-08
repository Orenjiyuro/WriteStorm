import { describe, expect, it } from 'vitest';
import {
  PERSPECTIVE_DEPENDENCY_ASSET_KINDS,
  PERSPECTIVE_DEPENDENCY_MATRIX,
  PERSPECTIVE_KEYS,
  PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES,
  type AnalysisModuleInstanceId,
  type EvidenceAnchorId,
  type PerspectiveDependencyAssetRef,
  type PerspectiveDependencyMatrixEntry,
  type PerspectiveDependencyRequirement,
  type PerspectiveMissingDependencyFixture,
  type PerspectiveStatusFromMissingDependency,
  type RelationLinkId,
  type ReusableTechniqueCandidateId,
  type TechniqueEntryId,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';

const moduleInstanceId = 'module-instance-1' as AnalysisModuleInstanceId;
const relationLinkId = 'relation-link-1' as RelationLinkId;
const evidenceAnchorId = 'evidence-1' as EvidenceAnchorId;
const observationId = 'observation-1' as WorkTechniqueObservationId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const techniqueEntryId = 'technique-entry-1' as TechniqueEntryId;

const dependencyRefs = [
  {
    assetKind: 'analysis_module_instance',
    id: moduleInstanceId,
  },
  {
    assetKind: 'relation_link',
    id: relationLinkId,
  },
  {
    assetKind: 'evidence_anchor',
    id: evidenceAnchorId,
  },
  {
    assetKind: 'work_technique_observation',
    id: observationId,
  },
  {
    assetKind: 'reusable_technique_candidate',
    id: candidateId,
  },
] as const satisfies readonly PerspectiveDependencyAssetRef[];

const missingAnalysisModuleStatus: PerspectiveStatusFromMissingDependency = 'partial';
const missingRequiredSourceAssetStatus: PerspectiveStatusFromMissingDependency = 'blocked';
const missingOptionalStatus: PerspectiveStatusFromMissingDependency = 'partial';
const requiredDependency: PerspectiveDependencyRequirement = 'required';

const invalidTechniqueEntryDependencyRef: PerspectiveDependencyAssetRef = {
  // @ts-expect-error TechniqueEntry is a library asset, not a PerspectiveDependencyAssetRef source.
  assetKind: 'technique_entry',
  // @ts-expect-error TechniqueEntryId is not a valid perspective dependency reference id.
  id: techniqueEntryId,
};

// @ts-expect-error A missing dependency cannot silently keep a perspective current.
const invalidMissingDependencyStatus: PerspectiveStatusFromMissingDependency = 'current';

const expectedDependencyMatrix = [
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['plot_causality', 'narrative_pacing'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'character_relation_dynamics',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['character_relations', 'plot_causality'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'setting_rule_payoff',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['world_rules', 'plot_causality'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'pacing_emotion_drive',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['narrative_pacing', 'plot_causality', 'style_expression'],
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'relation_link',
        requirement: 'optional',
        usage: 'reference_only',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'technique_source_trace',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['technique_principles'],
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'required',
      },
      {
        assetKind: 'reusable_technique_candidate',
        requirement: 'required',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'relation_link',
        requirement: 'optional',
        usage: 'reference_only',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
] as const satisfies readonly PerspectiveDependencyMatrixEntry[];

const expectedMissingDependencyFixtures = [
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    missingAssetKind: 'analysis_module_instance',
    missingRequirement: 'required',
    displayStatus: 'partial',
  },
  {
    perspectiveKey: 'pacing_emotion_drive',
    missingAssetKind: 'relation_link',
    missingRequirement: 'optional',
    displayStatus: 'partial',
  },
  {
    perspectiveKey: 'technique_source_trace',
    missingAssetKind: 'reusable_technique_candidate',
    missingRequirement: 'required',
    displayStatus: 'blocked',
  },
] as const satisfies readonly PerspectiveMissingDependencyFixture[];

describe('perspective dependency matrix', () => {
  it('locks the dependency asset reference vocabulary without TechniqueEntry', () => {
    expect(dependencyRefs.map((ref) => ref.assetKind)).toEqual([
      'analysis_module_instance',
      'relation_link',
      'evidence_anchor',
      'work_technique_observation',
      'reusable_technique_candidate',
    ]);
    expect(PERSPECTIVE_DEPENDENCY_ASSET_KINDS).toEqual([
      'analysis_module_instance',
      'relation_link',
      'evidence_anchor',
      'work_technique_observation',
      'reusable_technique_candidate',
    ]);
  });

  it('locks dependency requirements for every built-in perspective', () => {
    expect(requiredDependency).toBe('required');
    expect(PERSPECTIVE_DEPENDENCY_MATRIX).toEqual(expectedDependencyMatrix);
    expect(PERSPECTIVE_DEPENDENCY_MATRIX.map((entry) => entry.perspectiveKey)).toEqual([
      ...PERSPECTIVE_KEYS,
    ]);
  });

  it('keeps RelationLink dependencies reference-only and forbids relation fact generation', () => {
    for (const matrixEntry of PERSPECTIVE_DEPENDENCY_MATRIX) {
      expect(matrixEntry.mayGenerateRelationFacts).toBe(false);

      for (const dependency of matrixEntry.dependencies) {
        if (dependency.assetKind === 'relation_link') {
          expect(dependency.usage).toBe('reference_only');
        }
      }
    }
  });

  it('maps missing dependencies to blocked or partial fixture statuses', () => {
    expect(missingAnalysisModuleStatus).toBe('partial');
    expect(missingRequiredSourceAssetStatus).toBe('blocked');
    expect(missingOptionalStatus).toBe('partial');
    expect(PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES).toEqual(expectedMissingDependencyFixtures);
  });

  it('separates missing module partial state from hard required-source blocking', () => {
    for (const matrixEntry of PERSPECTIVE_DEPENDENCY_MATRIX) {
      expect(matrixEntry.missingAnalysisModuleInstanceStatus).toBe('partial');
      expect(matrixEntry.missingRequiredSourceAssetStatus).toBe('blocked');
      expect('missingRequiredDependencyStatus' in matrixEntry).toBe(false);
    }
  });
});
