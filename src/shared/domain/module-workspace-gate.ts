import {
  ANALYSIS_MODULE_ASSET_MATRIX,
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_MODULE_DEPENDENCY_GRAPH,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_SCOPE_MATRIX,
  type AnalysisModuleAssetMatrixEntry,
  type AnalysisModuleDefinition,
  type AnalysisModuleDependencyEntry,
  type AnalysisModuleKey,
  type AnalysisModuleScopeMatrixEntry,
} from './analysis';
import type {
  BreakdownBookId,
  StructureSetId,
} from './ids';

/*
 * This gate intentionally compares an injected snapshot with the shared V1
 * authority. It performs no persistence or session lookup and does not rely on
 * reference identity, so callers can pass decoded or cloned snapshots safely.
 */

export type ModuleWorkspaceGateBlocker =
  | 'book_not_found'
  | 'structure_not_frozen'
  | 'structure_snapshot_mismatch'
  | 'module_contract_unavailable';

export type ModuleWorkspaceBookSnapshot = {
  readonly id: BreakdownBookId;
  readonly structureEdition: number | null;
};

export type ModuleWorkspaceStructureSnapshot = {
  readonly bookId: BreakdownBookId;
  readonly frozenSetId: StructureSetId | null;
  readonly stage: 'missing' | 'candidate' | 'draft' | 'frozen';
  readonly structureEdition: number | null;
};

export type ModuleWorkspaceContractSnapshot = {
  readonly moduleKeys: readonly AnalysisModuleKey[];
  readonly definitions: readonly AnalysisModuleDefinition[];
  readonly scopeMatrix: readonly AnalysisModuleScopeMatrixEntry[];
  readonly assetMatrix: readonly AnalysisModuleAssetMatrixEntry[];
  readonly dependencyGraph: readonly AnalysisModuleDependencyEntry[];
};

export type ModuleWorkspaceGateInput = {
  readonly bookSnapshot: ModuleWorkspaceBookSnapshot | null;
  readonly structureSnapshot: ModuleWorkspaceStructureSnapshot;
  readonly moduleContractSnapshot: ModuleWorkspaceContractSnapshot;
};

export type ModuleWorkspaceGateResult =
  | {
      readonly ready: false;
      readonly blocker: ModuleWorkspaceGateBlocker;
    }
  | {
      readonly ready: true;
      readonly bookId: BreakdownBookId;
      readonly frozenSetId: StructureSetId;
      readonly structureEdition: number;
      readonly moduleCount: number;
    };

export function evaluateModuleWorkspaceGate(
  input: ModuleWorkspaceGateInput,
): ModuleWorkspaceGateResult {
  const { bookSnapshot, structureSnapshot, moduleContractSnapshot } = input;

  if (!bookSnapshot) {
    return blocked('book_not_found');
  }

  if (
    !isPositiveInteger(bookSnapshot.structureEdition) ||
    structureSnapshot.stage !== 'frozen' ||
    structureSnapshot.frozenSetId === null ||
    !isPositiveInteger(structureSnapshot.structureEdition)
  ) {
    return blocked('structure_not_frozen');
  }

  if (
    structureSnapshot.bookId !== bookSnapshot.id ||
    structureSnapshot.structureEdition !== bookSnapshot.structureEdition
  ) {
    return blocked('structure_snapshot_mismatch');
  }

  if (!isCompleteModuleContract(moduleContractSnapshot)) {
    return blocked('module_contract_unavailable');
  }

  return {
    ready: true,
    bookId: bookSnapshot.id,
    frozenSetId: structureSnapshot.frozenSetId,
    structureEdition: structureSnapshot.structureEdition,
    moduleCount: moduleContractSnapshot.moduleKeys.length,
  };
}

function isPositiveInteger(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}

function blocked(blocker: ModuleWorkspaceGateBlocker): ModuleWorkspaceGateResult {
  return { ready: false, blocker };
}

function isCompleteModuleContract(snapshot: ModuleWorkspaceContractSnapshot): boolean {
  return orderedValuesEqual(snapshot.moduleKeys, ANALYSIS_MODULE_KEYS) &&
    snapshot.definitions.length === ANALYSIS_MODULE_DEFINITIONS.length &&
    snapshot.definitions.every((actual, index) => {
      const expected = ANALYSIS_MODULE_DEFINITIONS[index];
      return actual.key === expected.key &&
        String(actual.id) === String(expected.id) &&
        actual.name === expected.name &&
        actual.category === expected.category &&
        actual.createsModuleInstance === expected.createsModuleInstance;
    }) &&
    snapshot.scopeMatrix.length === ANALYSIS_MODULE_SCOPE_MATRIX.length &&
    snapshot.scopeMatrix.every((actual, index) => {
      const expected = ANALYSIS_MODULE_SCOPE_MATRIX[index];
      return actual.moduleKey === expected.moduleKey &&
        actual.storySegmentRangeRelation === expected.storySegmentRangeRelation &&
        orderedValuesEqual(actual.supportedScopes, expected.supportedScopes);
    }) &&
    snapshot.assetMatrix.length === ANALYSIS_MODULE_ASSET_MATRIX.length &&
    snapshot.assetMatrix.every((actual, index) => {
      const expected = ANALYSIS_MODULE_ASSET_MATRIX[index];
      return actual.moduleKey === expected.moduleKey &&
        orderedValuesEqual(actual.allowedAssetKinds, expected.allowedAssetKinds);
    }) &&
    snapshot.dependencyGraph.length === ANALYSIS_MODULE_DEPENDENCY_GRAPH.length &&
    snapshot.dependencyGraph.every((actual, index) => {
      const expected = ANALYSIS_MODULE_DEPENDENCY_GRAPH[index];
      return actual.moduleKey === expected.moduleKey &&
        orderedValuesEqual(actual.requiredGateKinds, expected.requiredGateKinds) &&
        orderedValuesEqual(actual.inputModuleKeys, expected.inputModuleKeys);
    });
}

function orderedValuesEqual(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}
