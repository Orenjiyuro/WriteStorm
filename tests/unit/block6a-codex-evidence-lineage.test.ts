import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateBlock6aEvidenceLineage,
  isAllowedBlock6aEvidenceOnlyPath,
} from '../../scripts/block6a-evidence-lineage.mjs';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const runHead = '1'.repeat(40);
const finalHead = '2'.repeat(40);
const evidenceInputs = [
  { evidenceId: 'block6a-remediation-r2-environment-boundary-001', sha256: hashA },
  { evidenceId: 'block6a-remediation-r6-assertion-provenance-001', sha256: hashB },
];
const lineage = {
  gitHeadAtRun: runHead,
  criticalInputsCleanAtRun: true,
  packageLockSha256: hashA,
  runtimeBoundarySha256: hashB,
  packagedArtifactSha256: hashA,
  evidenceInputs,
};
const current = {
  finalHead,
  isRunHeadAncestor: true,
  changedPaths: [
    'docs/engineering/evidence/block6a-r8.json',
    'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md',
    'tests/unit/block6a-codex-evidence-lineage.test.ts',
  ],
  packageLockSha256: hashA,
  runtimeBoundarySha256: hashB,
  packagedArtifactSha256: hashA,
  evidenceInputs,
};

describe('Block 6A R7 evidence lineage binding', () => {
  it('accepts an ancestor run with matching hashes and evidence-only final changes', () => {
    expect(evaluateBlock6aEvidenceLineage(lineage, current)).toEqual({
      verified: true,
      classification: 'evidence_lineage_verified',
    });
  });

  it.each([
    ['non-ancestor run', { ...current, isRunHeadAncestor: false }],
    ['runtime drift', { ...current, runtimeBoundarySha256: 'c'.repeat(64) }],
    ['lockfile drift', { ...current, packageLockSha256: 'c'.repeat(64) }],
    ['artifact drift', { ...current, packagedArtifactSha256: 'c'.repeat(64) }],
    ['evidence-input drift', {
      ...current,
      evidenceInputs: [{ ...evidenceInputs[0], sha256: 'c'.repeat(64) }, evidenceInputs[1]],
    }],
    ['runtime changed after run', {
      ...current,
      changedPaths: ['src/main/codex-feasibility/runner.ts'],
    }],
  ])('rejects %s', (_label, candidate) => {
    expect(() => evaluateBlock6aEvidenceLineage(lineage, candidate)).toThrow(
      'Block 6A evidence lineage verification failed.',
    );
  });

  it('allows only evidence, authority, and corresponding consistency-test paths', () => {
    expect(isAllowedBlock6aEvidenceOnlyPath(
      'docs/engineering/evidence/block6a-r8.json',
    )).toBe(true);
    expect(isAllowedBlock6aEvidenceOnlyPath(
      'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md',
    )).toBe(true);
    expect(isAllowedBlock6aEvidenceOnlyPath(
      'tests/unit/block6a-codex-evidence-lineage.test.ts',
    )).toBe(true);
    expect(isAllowedBlock6aEvidenceOnlyPath(
      'src/main/codex-feasibility/runner.ts',
    )).toBe(false);
    expect(isAllowedBlock6aEvidenceOnlyPath('package-lock.json')).toBe(false);
  });

  it('binds the deadline, failure-attribution and CJS-anchor manifests in future runtime evidence', () => {
    const source = readFileSync(path.resolve(
      __dirname,
      '../../scripts/block6a-evidence-lineage.mjs',
    ), 'utf8');
    expect(source).toContain(
      'docs/engineering/evidence/block6a-remediation-r8a-turn-deadline.json',
    );
    expect(source).toContain(
      'docs/engineering/evidence/block6a-remediation-r8a3-runtime-failure-origin.json',
    );
    expect(source).toContain(
      'docs/engineering/evidence/block6a-remediation-r8a4-cjs-module-anchor.json',
    );
  });

  it('keeps the repository verifier bound to Git ancestry and changed paths', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../scripts/block6a-evidence-lineage.mjs'),
      'utf8',
    );
    expect(source).toContain("['merge-base', '--is-ancestor'");
    expect(source).toContain("['diff', '--name-only'");
    expect(source).toContain('packagedArtifactSha256');
    expect(source).toContain('runtimeBoundarySha256');
    expect(source).toContain("/^vite\\..+\\.config\\.ts$/");
    expect(source).toContain("'scripts/block6a-evidence-lineage.mjs'");
  });
});
