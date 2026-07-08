import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY,
  ANALYSIS_MODULE_DEPENDENCY_GRAPH,
  ANALYSIS_MODULE_KEYS,
  type AnalysisAiConstraintDependencyPolicy,
  type AnalysisDependencyGateKind,
  type AnalysisModuleDependencyEntry,
  type AnalysisModuleKey,
} from '../../src/shared/domain';

const frozenStructureGate: AnalysisDependencyGateKind = 'frozen_structure';

// @ts-expect-error Module dependency contracts describe prerequisites, not scheduler states.
const invalidDependencyGate: AnalysisDependencyGateKind = 'queued_job';

const expectedDependencyGraph = [
  {
    moduleKey: 'structure_and_segments',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: [],
  },
  {
    moduleKey: 'plot_causality',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments'],
  },
  {
    moduleKey: 'narrative_pacing',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'character_relations',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'world_rules',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'style_expression',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'character_relations'],
  },
  {
    moduleKey: 'technique_principles',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: [
      'plot_causality',
      'narrative_pacing',
      'character_relations',
      'world_rules',
      'style_expression',
    ],
  },
] as const satisfies readonly AnalysisModuleDependencyEntry[];

const expectedAiConstraintDependency = {
  assetKind: 'ai_constraint',
  requiresConfirmedSourceAssets: true,
  mayReferencePendingAssets: false,
  sourceAssetKinds: [
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
  ],
} as const satisfies AnalysisAiConstraintDependencyPolicy;

describe('analysis module dependency contract', () => {
  it('requires frozen structure before every module can be generated or reviewed', () => {
    expect(frozenStructureGate).toBe('frozen_structure');
    expect(ANALYSIS_MODULE_DEPENDENCY_GRAPH).toEqual(expectedDependencyGraph);
    expect(
      ANALYSIS_MODULE_DEPENDENCY_GRAPH.every((entry) => entry.requiredGateKinds.includes('frozen_structure')),
    ).toBe(true);
  });

  it('keeps dependency graph entries complete and unique against the module key allowlist', () => {
    const graphKeys = ANALYSIS_MODULE_DEPENDENCY_GRAPH.map((entry) => entry.moduleKey);

    expect(graphKeys).toEqual([...ANALYSIS_MODULE_KEYS]);
    expect(new Set(graphKeys).size).toBe(ANALYSIS_MODULE_KEYS.length);
  });

  it('locks the six ordinary analysis modules to their minimum input dependencies', () => {
    const ordinaryEntries = ANALYSIS_MODULE_DEPENDENCY_GRAPH.filter(
      (entry) => entry.moduleKey !== 'structure_and_segments',
    );

    expect(ordinaryEntries.map((entry) => ({
      moduleKey: entry.moduleKey,
      inputModuleKeys: entry.inputModuleKeys,
    }))).toEqual(expectedDependencyGraph.slice(1).map((entry) => ({
      moduleKey: entry.moduleKey,
      inputModuleKeys: entry.inputModuleKeys,
    })));
  });

  it('keeps the module dependency graph acyclic without adding a scheduler', () => {
    expect(findFirstCycle(ANALYSIS_MODULE_DEPENDENCY_GRAPH)).toBeNull();
    expect(ANALYSIS_MODULE_DEPENDENCY_GRAPH.some((entry) => 'schedulerState' in entry)).toBe(false);
  });

  it('requires AI constraints to reference confirmed source assets only', () => {
    expect(ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY).toEqual(expectedAiConstraintDependency);
  });
});

function findFirstCycle(graph: readonly AnalysisModuleDependencyEntry[]): AnalysisModuleKey[] | null {
  const visiting = new Set<AnalysisModuleKey>();
  const visited = new Set<AnalysisModuleKey>();
  const stack: AnalysisModuleKey[] = [];
  const dependencyMap = new Map(graph.map((entry) => [entry.moduleKey, entry.inputModuleKeys]));

  const visit = (moduleKey: AnalysisModuleKey): AnalysisModuleKey[] | null => {
    if (visiting.has(moduleKey)) {
      return stack.slice(stack.indexOf(moduleKey)).concat(moduleKey);
    }

    if (visited.has(moduleKey)) {
      return null;
    }

    visiting.add(moduleKey);
    stack.push(moduleKey);

    for (const dependencyKey of dependencyMap.get(moduleKey) ?? []) {
      const cycle = visit(dependencyKey);

      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(moduleKey);
    visited.add(moduleKey);

    return null;
  };

  for (const moduleKey of dependencyMap.keys()) {
    const cycle = visit(moduleKey);

    if (cycle) {
      return cycle;
    }
  }

  return null;
}
