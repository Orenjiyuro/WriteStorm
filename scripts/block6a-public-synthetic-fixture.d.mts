export const BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH:
  'fixtures/block6a/codex-sdk-feasibility-v1.json';

export type Block6aPublicSyntheticFixture = {
  readonly schemaVersion: 1;
  readonly fixtureId: 'block6a-codex-sdk-feasibility-v1';
  readonly classification: 'public_non_sensitive';
  readonly owner: 'WriteStorm engineering authority';
  readonly rotationPolicy: string;
  readonly input: string;
  readonly expected: string;
  readonly inputSha256: string;
  readonly expectedSha256: string;
};

export function loadBlock6aPublicSyntheticFixture(
  repositoryRoot: string,
  candidatePath?: string,
): Block6aPublicSyntheticFixture;
