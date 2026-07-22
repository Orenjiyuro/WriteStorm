import manifest from '../../../config/block6a-feasibility-manifest-v1.json';

export const BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH =
  'config/block6a-feasibility-manifest-v1.json';

export const BLOCK6A_FEASIBILITY_MANIFEST = manifest;

export function block6aStaticEvidence(
  key: (typeof manifest.staticEvidenceInputs)[number]['key'],
): (typeof manifest.staticEvidenceInputs)[number] {
  const record = manifest.staticEvidenceInputs.find((candidate) => candidate.key === key);
  if (!record) throw new Error('Block 6A static evidence key is not in the versioned manifest.');
  return record;
}
