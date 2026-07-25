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
  block6aStaticEvidence('r2Environment').evidenceId;
export const BLOCK6A_R6_PROVENANCE_EVIDENCE_ID =
  block6aStaticEvidence('r6AssertionProvenance').evidenceId;

export function createBlock6aAssertion(
  value: boolean,
  source: Block6aEvidenceSource,
  evidenceId: string,
  classification: string,
): Block6aAssertionEvidence {
  return { value, source, evidenceId, classification };
}

export function areBlock6aAssertionGroupsTrue(
  ...groups: ReadonlyArray<Readonly<Record<string, Block6aAssertionEvidence>>>
): boolean {
  return groups.every((group) => (
    Object.values(group).every((assertion) => assertion.value === true)
  ));
}
import { block6aStaticEvidence } from './manifest';
