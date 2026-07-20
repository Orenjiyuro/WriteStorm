export const BLOCK6A_EVIDENCE_SOURCES = [
  'real_sdk',
  'packaged_sdk',
  'local_validator_fixture',
  'static_manifest',
] as const;

export type Block6aEvidenceSource = (typeof BLOCK6A_EVIDENCE_SOURCES)[number];

export type Block6aAssertionEvidence = {
  readonly value: boolean;
  readonly source: Block6aEvidenceSource;
  readonly evidenceId: string;
  readonly classification: string;
};

export const BLOCK6A_R2_ENVIRONMENT_EVIDENCE_ID =
  'block6a-remediation-r2-environment-boundary-001';
export const BLOCK6A_R6_PROVENANCE_EVIDENCE_ID =
  'block6a-remediation-r6-assertion-provenance-001';

export function createBlock6aAssertion(
  value: boolean,
  source: Block6aEvidenceSource,
  evidenceId: string,
  classification: string,
): Block6aAssertionEvidence {
  return { value, source, evidenceId, classification };
}
