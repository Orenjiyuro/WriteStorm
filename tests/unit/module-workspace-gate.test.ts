import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_ASSET_MATRIX,
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_MODULE_DEPENDENCY_GRAPH,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_SCOPE_MATRIX,
  evaluateModuleWorkspaceGate,
  type ModuleWorkspaceContractSnapshot,
} from '../../src/shared/domain';
import type {
  AnalysisModuleId,
  AnalysisModuleKey,
  BreakdownBookId,
  StructureSetId,
} from '../../src/shared/domain';

const bookId = '00000000-0000-4000-8000-000000000001' as BreakdownBookId;
const otherBookId = '00000000-0000-4000-8000-000000000002' as BreakdownBookId;
const frozenSetId = '00000000-0000-4000-8000-000000000003' as StructureSetId;

const completeContractSnapshot: ModuleWorkspaceContractSnapshot = {
  moduleKeys: ANALYSIS_MODULE_KEYS,
  definitions: ANALYSIS_MODULE_DEFINITIONS,
  scopeMatrix: ANALYSIS_MODULE_SCOPE_MATRIX,
  assetMatrix: ANALYSIS_MODULE_ASSET_MATRIX,
  dependencyGraph: ANALYSIS_MODULE_DEPENDENCY_GRAPH,
};

const frozenInput = {
  bookSnapshot: {
    id: bookId,
    structureEdition: 2,
  },
  structureSnapshot: {
    bookId,
    frozenSetId,
    stage: 'frozen' as const,
    structureEdition: 2,
  },
  moduleContractSnapshot: completeContractSnapshot,
};

describe('module workspace prerequisite gate', () => {
  it('returns book_not_found without consulting services or global session state', () => {
    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      bookSnapshot: null,
    })).toEqual({
      ready: false,
      blocker: 'book_not_found',
    });
  });

  it('requires a frozen structure and a positive Book structure edition', () => {
    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      bookSnapshot: { id: bookId, structureEdition: null },
      structureSnapshot: {
        bookId,
        frozenSetId: null,
        stage: 'draft',
        structureEdition: null,
      },
    })).toEqual({
      ready: false,
      blocker: 'structure_not_frozen',
    });

    for (const structureEdition of [0, -1, Number.NaN, 1.5]) {
      expect(evaluateModuleWorkspaceGate({
        ...frozenInput,
        bookSnapshot: { id: bookId, structureEdition },
        structureSnapshot: {
          ...frozenInput.structureSnapshot,
          structureEdition,
        },
      })).toEqual({
        ready: false,
        blocker: 'structure_not_frozen',
      });
    }
  });

  it('rejects a frozen structure snapshot from another Book or edition', () => {
    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      structureSnapshot: {
        ...frozenInput.structureSnapshot,
        bookId: otherBookId,
      },
    })).toEqual({
      ready: false,
      blocker: 'structure_snapshot_mismatch',
    });

    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      structureSnapshot: {
        ...frozenInput.structureSnapshot,
        structureEdition: 1,
      },
    })).toEqual({
      ready: false,
      blocker: 'structure_snapshot_mismatch',
    });
  });

  it('rejects an injected incomplete module contract fixture without mutating shared constants', () => {
    const incompleteContract: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      definitions: completeContractSnapshot.definitions.slice(0, -1),
    };

    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      moduleContractSnapshot: incompleteContract,
    })).toEqual({
      ready: false,
      blocker: 'module_contract_unavailable',
    });
    expect(ANALYSIS_MODULE_DEFINITIONS).toHaveLength(7);
  });

  it('rejects incomplete scope, asset, and dependency matrix fixtures', () => {
    for (const moduleContractSnapshot of [
      {
        ...completeContractSnapshot,
        scopeMatrix: completeContractSnapshot.scopeMatrix.slice(1),
      },
      {
        ...completeContractSnapshot,
        assetMatrix: completeContractSnapshot.assetMatrix.slice(1),
      },
      {
        ...completeContractSnapshot,
        dependencyGraph: completeContractSnapshot.dependencyGraph.slice(1),
      },
    ] satisfies ModuleWorkspaceContractSnapshot[]) {
      expect(evaluateModuleWorkspaceGate({
        ...frozenInput,
        moduleContractSnapshot,
      })).toEqual({
        ready: false,
        blocker: 'module_contract_unavailable',
      });
    }
  });

  it('rejects complete-looking snapshots whose authoritative semantics changed', () => {
    const changedScope: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      scopeMatrix: completeContractSnapshot.scopeMatrix.map((entry, index) => index === 0
        ? { ...entry, supportedScopes: ['book'] }
        : entry),
    };
    const changedAssets: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      assetMatrix: completeContractSnapshot.assetMatrix.map((entry, index) => index === 1
        ? { ...entry, allowedAssetKinds: ['body'] }
        : entry),
    };
    const changedDependencies: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      dependencyGraph: completeContractSnapshot.dependencyGraph.map((entry, index) => index === 1
        ? { ...entry, inputModuleKeys: [] }
        : entry),
    };
    const changedName: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      definitions: completeContractSnapshot.definitions.map((definition, index) => index === 0
        ? { ...definition, name: 'Changed name' }
        : definition),
    };
    const changedCategory: ModuleWorkspaceContractSnapshot = {
      ...completeContractSnapshot,
      definitions: completeContractSnapshot.definitions.map((definition, index) => index === 0
        ? { ...definition, category: 'analysis' }
        : definition),
    };

    for (const moduleContractSnapshot of [
      changedScope,
      changedAssets,
      changedDependencies,
      changedName,
      changedCategory,
      selfConsistentFakeContract(),
    ]) {
      expect(evaluateModuleWorkspaceGate({
        ...frozenInput,
        moduleContractSnapshot,
      })).toEqual({
        ready: false,
        blocker: 'module_contract_unavailable',
      });
    }
  });

  it('accepts a structurally cloned authoritative snapshot without relying on object identity', () => {
    const clonedSnapshot = structuredClone(completeContractSnapshot);

    expect(evaluateModuleWorkspaceGate({
      ...frozenInput,
      moduleContractSnapshot: clonedSnapshot,
    })).toMatchObject({ ready: true, moduleCount: 7 });
  });

  it('returns the frozen edition and module count for a complete injected snapshot', () => {
    expect(evaluateModuleWorkspaceGate(frozenInput)).toEqual({
      ready: true,
      bookId,
      frozenSetId,
      structureEdition: 2,
      moduleCount: 7,
    });
  });

  it('keeps the gate source free from privileged, service, and global-session dependencies', () => {
    const source = readFileSync('src/shared/domain/module-workspace-gate.ts', 'utf8');

    expect(source).not.toMatch(/from ['"]node:/);
    expect(source).not.toMatch(/from ['"][^'"]*main\//);
    expect(source).not.toContain('LibraryService');
    expect(source).not.toContain('Sqlite');
    expect(source).not.toMatch(/\b(?:window|process)\./);
  });
});

function selfConsistentFakeContract(): ModuleWorkspaceContractSnapshot {
  const replacements = new Map<AnalysisModuleKey, AnalysisModuleKey>(
    ANALYSIS_MODULE_KEYS.map((key, index) => [key, `fake_module_${index}` as AnalysisModuleKey]),
  );
  const replace = (key: AnalysisModuleKey): AnalysisModuleKey => replacements.get(key)!;

  return {
    moduleKeys: ANALYSIS_MODULE_KEYS.map(replace),
    definitions: ANALYSIS_MODULE_DEFINITIONS.map((definition) => ({
      ...definition,
      key: replace(definition.key),
      id: replace(definition.key) as unknown as AnalysisModuleId,
    })),
    scopeMatrix: ANALYSIS_MODULE_SCOPE_MATRIX.map((entry) => ({
      ...entry,
      moduleKey: replace(entry.moduleKey),
    })),
    assetMatrix: ANALYSIS_MODULE_ASSET_MATRIX.map((entry) => ({
      ...entry,
      moduleKey: replace(entry.moduleKey),
    })),
    dependencyGraph: ANALYSIS_MODULE_DEPENDENCY_GRAPH.map((entry) => ({
      ...entry,
      moduleKey: replace(entry.moduleKey),
      inputModuleKeys: entry.inputModuleKeys.map(replace),
    })),
  };
}
