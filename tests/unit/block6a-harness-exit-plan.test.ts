import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const planPath = path.join(
  rootDir,
  'docs/engineering/block6a-feasibility-harness-exit-plan.json',
);

type HarnessExitPlan = {
  readonly schemaVersion: 1;
  readonly status: 'planning_only_no_task13_authority';
  readonly productionTargets: {
    readonly aiExecutionPort: string;
    readonly codexProviderAdapter: string;
    readonly codexUtilityEntry: string;
  };
  readonly extractThenDelete: readonly string[];
  readonly deleteWithoutPromotion: readonly string[];
  readonly retainedCertificationAssets: readonly string[];
  readonly gates: readonly {
    readonly id: string;
    readonly requiredBefore: string;
  }[];
};

describe('Block 6A feasibility harness exit plan', () => {
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as HarnessExitPlan;

  it('classifies every current feasibility source exactly once', () => {
    const sourceRoot = path.join(rootDir, 'src/main/codex-feasibility');
    const currentSources = readdirSync(sourceRoot)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => `src/main/codex-feasibility/${name}`)
      .sort();
    const extracted = [...plan.extractThenDelete].sort();
    const deleted = [...plan.deleteWithoutPromotion].sort();

    expect(new Set([...extracted, ...deleted]).size).toBe(extracted.length + deleted.length);
    expect([...extracted, ...deleted].sort()).toEqual(currentSources);
  });

  it('permits only low-level boundary semantics to be independently extracted', () => {
    expect(plan).toMatchObject({
      schemaVersion: 1,
      status: 'planning_only_no_task13_authority',
      productionTargets: {
        aiExecutionPort: 'src/main/ai/ai-execution-port.ts',
        codexProviderAdapter: 'src/main/ai/providers/codex/codex-provider-adapter.ts',
        codexUtilityEntry: 'src/main/ai/providers/codex/codex-utility-entry.ts',
      },
    });
    expect(plan.extractThenDelete).toEqual([
      'src/main/codex-feasibility/environment.ts',
      'src/main/codex-feasibility/lifecycle.ts',
      'src/main/codex-feasibility/session-supervisor.ts',
      'src/main/codex-feasibility/termination-supervisor.ts',
      'src/main/codex-feasibility/utility-protocol-termination.ts',
    ]);
  });

  it('requires probe protocols, runners and synthetic validation to be deleted, not promoted', () => {
    expect(plan.deleteWithoutPromotion).toEqual(expect.arrayContaining([
      'src/main/codex-feasibility/runner.ts',
      'src/main/codex-feasibility/utility-entry.ts',
      'src/main/codex-feasibility/protocol.ts',
      'src/main/codex-feasibility/operations.ts',
      'src/main/codex-feasibility/structured-output.ts',
      'src/main/codex-feasibility/assertion-provenance.ts',
      'src/main/codex-feasibility/certification-main.ts',
    ]));
    expect(plan.retainedCertificationAssets).toEqual([
      'config/block6a-feasibility-manifest-v1.json',
      'fixtures/block6a/**',
      'scripts/block6a-*.mjs',
      'scripts/certify-block6a-windows.mjs',
      'scripts/package-block6a-certification.mjs',
      'scripts/run-block6a-probes.mjs',
      'scripts/verify-block6a-*.mjs',
      'tests/certification/**',
      'docs/engineering/evidence/block6a-*.json',
    ]);
  });

  it('freezes the no-import, source-exit and release gates', () => {
    expect(plan.gates).toEqual([
      { id: 'no_feasibility_imports', requiredBefore: 'Task 13.2 authorization' },
      { id: 'production_contract_independent', requiredBefore: 'production adapter composition' },
      { id: 'feasibility_source_tree_removed', requiredBefore: 'first product AI execution' },
      { id: 'replacement_certification_passed', requiredBefore: 'Task 17 release readiness' },
    ]);
  });

  it('keeps the same exit contract in current authority and technical design', () => {
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    const design = readFileSync(
      path.join(rootDir, 'docs/engineering/TECHNICAL_DESIGN.md'),
      'utf8',
    );
    const decisions = readFileSync(
      path.join(rootDir, 'docs/engineering/DECISIONS.md'),
      'utf8',
    );

    for (const document of [authority, design, decisions]) {
      expect(document).toContain('block6a-feasibility-harness-exit-plan.json');
      expect(document).toContain('extract-then-delete');
      expect(document).toContain('delete-without-promotion');
      expect(document).toContain('Task 13.2');
    }
    expect(decisions).toContain('## D095: Feasibility Harness Must Exit Before Product AI Execution');
  });
});
