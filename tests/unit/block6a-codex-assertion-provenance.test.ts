import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCK6A_EVIDENCE_SOURCES,
  BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
  areBlock6aAssertionGroupsTrue,
  createBlock6aAssertion,
} from '../../src/main/codex-feasibility/assertion-provenance';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A R6 per-assertion provenance', () => {
  it('constructs only the exact provenance-bearing assertion leaf', () => {
    expect(createBlock6aAssertion(
      true,
      'static_manifest',
      BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
      'typed_protocol_boundary_frozen',
    )).toEqual({
      value: true,
      source: 'static_manifest',
      evidenceId: BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
      classification: 'typed_protocol_boundary_frozen',
    });
    expect(BLOCK6A_EVIDENCE_SOURCES).toEqual([
      'real_sdk',
      'packaged_sdk',
      'local_validator_fixture',
      'static_manifest',
    ]);
  });

  it('classifies assertion groups by leaf values rather than object truthiness', () => {
    const passed = createBlock6aAssertion(
      true,
      'real_sdk',
      'lifecycle-evidence',
      'lifecycle_probe_passed',
    );
    const failed = createBlock6aAssertion(
      false,
      'real_sdk',
      'lifecycle-evidence',
      'lifecycle_probe_passed',
    );

    expect(areBlock6aAssertionGroupsTrue({ passed }, { alsoPassed: passed })).toBe(true);
    expect(areBlock6aAssertionGroupsTrue({ passed }, { failed })).toBe(false);
  });

  it('uses the shared constructor in every fresh runtime producer', () => {
    for (const file of [
      'probe-main.ts',
      'output-schema-probe-main.ts',
      'lifecycle-probe-main.ts',
      'packaged-probe.ts',
    ]) {
      const source = readFileSync(
        path.join(rootDir, 'src/main/codex-feasibility', file),
        'utf8',
      );
      expect(source).toContain('createBlock6aAssertion');
    }
  });

  it('keeps lifecycle classification on assertion leaf values', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/lifecycle-probe-main.ts'),
      'utf8',
    );

    expect(source).toContain(
      'areBlock6aAssertionGroupsTrue(lifecycleAssertions, processAssertions)',
    );
    expect(source).not.toMatch(/Object\.values\([^\n]+\)\.every\(Boolean\)/);
  });

  it('records the R6 contract as self-provenanced static evidence', () => {
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r6-assertion-provenance.json',
    ), 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, Record<string, unknown>>;
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('assertion_provenance_contract_frozen');
    for (const assertion of Object.values(evidence.assertions)) {
      expect(Object.keys(assertion).sort()).toEqual([
        'classification', 'evidenceId', 'source', 'value',
      ]);
      expect(assertion).toMatchObject({
        value: true,
        source: 'static_manifest',
        evidenceId: BLOCK6A_R6_PROVENANCE_EVIDENCE_ID,
        classification: 'assertion_provenance_contract_frozen',
      });
    }
  });
});
