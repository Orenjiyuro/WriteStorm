import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateBlock6aCertificationEvidence } from '../../scripts/block6a-certification-verifier.mjs';

const rootDir = path.resolve(__dirname, '../..');
const evidenceFiles = [
  'block6a-r8a5-windows-dev-capability-admitted-with-conditions.json',
  'block6a-r8a5-windows-dev-output-schema-admitted-with-conditions.json',
  'block6a-r8a5-windows-lifecycle-app-timeout.json',
  'block6a-r8a5-windows-lifecycle-explicit-cancel.json',
  'block6a-r8a5-windows-lifecycle-window-close.json',
  'block6a-r8a5-windows-lifecycle-app-quit.json',
  'block6a-r8a5-windows-packaged-sdk.json',
] as const;
const records = evidenceFiles.map((file) => JSON.parse(readFileSync(path.join(
  rootDir,
  'docs/engineering/evidence',
  file,
), 'utf8')) as Record<string, unknown>);
const verifiedLineage = () => ({
  verified: true as const,
  classification: 'evidence_lineage_verified' as const,
});

describe('Block 6A unified certification verifier', () => {
  it('derives the Windows-only conditional verdict from admitted content and lineage', () => {
    const result = evaluateBlock6aCertificationEvidence(records, {
      verifyLineage: verifiedLineage,
    });

    expect(result).toMatchObject({
      verified: true,
      classification: 'conditional_go_windows_only_macos_deferred_by_user',
      verdict: 'conditional Go — Windows-only feasibility verified; macOS deferred-by-user',
      task13Point1Unblocked: false,
      task13Point2Authorized: false,
    });
    expect(result.evidenceInputs).toHaveLength(7);
    expect(result.admissions).toEqual({
      development: 'admitted_with_conditions',
      lifecycle: 'admitted',
      packaged: 'admitted',
    });
  });

  it.each([
    ['classification', (candidate: Array<Record<string, unknown>>) => {
      candidate[6].classification = 'packaged_sdk_probe_failed';
    }],
    ['assertion', (candidate: Array<Record<string, unknown>>) => {
      const assertions = candidate[6].assertions as Record<string, { value: boolean }>;
      assertions.structuredTurnSucceeded.value = false;
    }],
  ])('rejects tampered %s even when lineage remains valid', (_label, mutate) => {
    const candidate = structuredClone(records);
    mutate(candidate);

    expect(() => evaluateBlock6aCertificationEvidence(candidate, {
      verifyLineage: verifiedLineage,
    })).toThrow('Block 6A certification verification failed.');
  });

  it('rejects missing evidence and a lineage failure', () => {
    expect(() => evaluateBlock6aCertificationEvidence(records.slice(0, -1), {
      verifyLineage: verifiedLineage,
    })).toThrow('Block 6A certification verification failed.');
    expect(() => evaluateBlock6aCertificationEvidence(records, {
      verifyLineage: () => {
        throw new Error('lineage rejected');
      },
    })).toThrow('Block 6A certification verification failed.');
  });

  it('keeps the CLI on the unified admission, lineage and artifact verifier', () => {
    const cli = readFileSync(
      path.join(rootDir, 'scripts/verify-block6a-evidence-lineage.mjs'),
      'utf8',
    );
    const verifier = readFileSync(
      path.join(rootDir, 'scripts/block6a-certification-verifier.mjs'),
      'utf8',
    );

    expect(cli).toContain('verifyBlock6aCertificationFilesAtRepository');
    expect(cli).toContain("artifactFlag !== '--artifact-root'");
    expect(cli).not.toContain('verifyBlock6aEvidenceLineageAtRepository');
    expect(verifier).toContain("evaluateBlock6aProbeResults('dev'");
    expect(verifier).toContain("evaluateBlock6aProbeResults('lifecycle'");
    expect(verifier).toContain("evaluateBlock6aProbeResults('packaged'");
    expect(verifier).toContain('verifyBlock6aEvidenceLineageAtRepository');
    expect(verifier).toContain('packagedArtifactRoot');
  });
});
