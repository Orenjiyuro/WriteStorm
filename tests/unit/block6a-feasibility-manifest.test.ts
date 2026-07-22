import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCK6A_FEASIBILITY_MANIFEST,
  BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH,
} from '../../src/main/codex-feasibility/manifest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A versioned feasibility manifest', () => {
  it('is the canonical dependency and public-fixture authority', () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    const fixture = JSON.parse(readFileSync(
      path.join(rootDir, BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.path),
      'utf8',
    )) as Record<string, unknown>;

    expect(BLOCK6A_FEASIBILITY_MANIFEST).toMatchObject({
      schemaVersion: 1,
      manifestId: 'block6a-feasibility-manifest-v1',
    });
    expect(packageManifest.dependencies['@openai/codex-sdk']).toBe(
      BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
    );
    expect(fixture.fixtureId).toBe(BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.fixtureId);
    expect(fixture.inputSha256).toBe(BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256);
    expect(fixture.expectedSha256).toBe(
      BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256,
    );
  });

  it('binds every static evidence id to its exact committed record', () => {
    const records = BLOCK6A_FEASIBILITY_MANIFEST.staticEvidenceInputs;
    expect(records).toHaveLength(10);
    expect(new Set(records.map(({ key }) => key)).size).toBe(records.length);
    expect(new Set(records.map(({ evidenceId }) => evidenceId)).size).toBe(records.length);

    for (const record of records) {
      const evidence = JSON.parse(readFileSync(path.join(rootDir, record.path), 'utf8')) as {
        evidenceId: string;
      };
      expect(evidence.evidenceId, record.path).toBe(record.evidenceId);
    }
  });

  it('keeps runtime evidence ids unique and source values out of operational files', () => {
    const runtimeIds = [
      BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.capability,
      BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.outputSchema,
      ...Object.values(BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.lifecycle),
      BLOCK6A_FEASIBILITY_MANIFEST.runtimeEvidence.packaged,
    ];
    expect(new Set(runtimeIds).size).toBe(runtimeIds.length);

    const forbiddenDuplicates = [
      BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
      BLOCK6A_FEASIBILITY_MANIFEST.versions.platformPackage,
      BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256,
      BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256,
      ...BLOCK6A_FEASIBILITY_MANIFEST.staticEvidenceInputs.map(({ evidenceId }) => evidenceId),
      ...runtimeIds,
    ];
    const operationalFiles = [
      ...sourceFiles(path.join(rootDir, 'src/main/codex-feasibility')),
      ...sourceFiles(path.join(rootDir, 'scripts')).filter((file) => (
        /(?:block6a|run-block6a|certify-block6a|package-block6a|verify-block6a)/.test(
          path.basename(file),
        )
      )),
    ].filter((file) => !file.endsWith('block6a-feasibility-manifest.mjs'));

    for (const file of operationalFiles) {
      const source = readFileSync(file, 'utf8');
      for (const value of forbiddenDuplicates) {
        expect(source, `${path.relative(rootDir, file)} duplicates ${value}`).not.toContain(value);
      }
    }
  });

  it('includes the canonical manifest in the evidence runtime boundary', () => {
    const lineage = readFileSync(
      path.join(rootDir, 'scripts/block6a-evidence-lineage.mjs'),
      'utf8',
    );
    expect(lineage).toContain('BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH');
    expect(BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH).toBe(
      'config/block6a-feasibility-manifest-v1.json',
    );
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    const decisions = readFileSync(
      path.join(rootDir, 'docs/engineering/DECISIONS.md'),
      'utf8',
    );
    expect(authority).toContain('## Versioned feasibility manifest');
    expect(authority).toContain(BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH);
    expect(decisions).toContain('## D096: Block 6A Operational Constants Have One Versioned Manifest');
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|mjs)$/.test(entry) ? [entryPath] : [];
  });
}
