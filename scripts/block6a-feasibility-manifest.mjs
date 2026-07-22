import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH =
  'config/block6a-feasibility-manifest-v1.json';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BLOCK6A_FEASIBILITY_MANIFEST = loadBlock6aFeasibilityManifest(repositoryRoot);

export function loadBlock6aFeasibilityManifest(root) {
  try {
    const candidate = JSON.parse(readFileSync(
      path.join(root, ...BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH.split('/')),
      'utf8',
    ));
    if (!isRecord(candidate)
      || candidate.schemaVersion !== 1
      || typeof candidate.manifestId !== 'string'
      || !isRecord(candidate.versions)
      || !version(candidate.versions.codexSdk)
      || !version(candidate.versions.codexCli)
      || typeof candidate.versions.platformPackage !== 'string'
      || !isRecord(candidate.syntheticFixture)
      || !relativeJsonPath(candidate.syntheticFixture.path)
      || typeof candidate.syntheticFixture.fixtureId !== 'string'
      || !hash(candidate.syntheticFixture.inputSha256)
      || !hash(candidate.syntheticFixture.expectedSha256)
      || !positiveInteger(candidate.syntheticFixture.inputMaximumLength)
      || !positiveInteger(candidate.syntheticFixture.expectedMaximumLength)
      || !validStaticEvidence(candidate.staticEvidenceInputs)
      || !validRuntimeEvidence(candidate.runtimeEvidence)
      || !Array.isArray(candidate.windowsPlatformRuntimeFiles)
      || candidate.windowsPlatformRuntimeFiles.length !== 6
      || new Set(candidate.windowsPlatformRuntimeFiles).size !== 6
      || !candidate.windowsPlatformRuntimeFiles.every(relativeFilePath)
      || !isRecord(candidate.verdict)
      || typeof candidate.verdict.classification !== 'string'
      || typeof candidate.verdict.text !== 'string') fail();
    return deepFreeze(candidate);
  } catch {
    fail();
  }
}

function validStaticEvidence(value) {
  return Array.isArray(value)
    && value.length === 10
    && new Set(value.map((record) => record?.key)).size === value.length
    && new Set(value.map((record) => record?.evidenceId)).size === value.length
    && value.every((record) => isRecord(record)
      && typeof record.key === 'string'
      && /^[a-z0-9-]+$/.test(record.evidenceId)
      && relativeJsonPath(record.path));
}

function validRuntimeEvidence(value) {
  if (!isRecord(value) || !isRecord(value.lifecycle)) return false;
  const ids = [
    value.capability,
    value.outputSchema,
    ...Object.values(value.lifecycle),
    value.packaged,
  ];
  return Object.keys(value.lifecycle).length === 4
    && ids.length === 7
    && new Set(ids).size === ids.length
    && ids.every((id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id));
}

function deepFreeze(value) {
  if (!isRecord(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function version(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function hash(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function relativeJsonPath(value) {
  return relativeFilePath(value) && value.endsWith('.json');
}

function relativeFilePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.replaceAll('\\', '/').split('/').includes('..');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail() {
  throw new Error('Block 6A feasibility manifest validation failed.');
}
