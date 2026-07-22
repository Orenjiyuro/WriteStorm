import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BLOCK6A_FEASIBILITY_MANIFEST } from './block6a-feasibility-manifest.mjs';

export const BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH =
  BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.path;

const approvedInputSha256 =
  BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256;
const approvedExpectedSha256 =
  BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256;
const exactKeys = [
  'schemaVersion',
  'fixtureId',
  'classification',
  'owner',
  'rotationPolicy',
  'input',
  'expected',
  'inputSha256',
  'expectedSha256',
].sort();

export function loadBlock6aPublicSyntheticFixture(repositoryRoot, candidatePath) {
  try {
    const fixturePath = candidatePath
      ? path.resolve(candidatePath)
      : path.join(repositoryRoot, ...BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH.split('/'));
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    if (!isRecord(fixture)
      || JSON.stringify(Object.keys(fixture).sort()) !== JSON.stringify(exactKeys)
      || fixture.schemaVersion !== 1
      || fixture.fixtureId !== BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.fixtureId
      || fixture.classification !== 'public_non_sensitive'
      || fixture.owner !== 'WriteStorm engineering authority'
      || fixture.rotationPolicy !== 'Changing either value requires a new fixtureId, new pinned hashes, review approval, and fresh Windows recertification.'
      || fixture.inputSha256 !== approvedInputSha256
      || fixture.expectedSha256 !== approvedExpectedSha256
      || !isApprovedValue(
        fixture.input,
        approvedInputSha256,
        BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputMaximumLength,
      )
      || !isApprovedValue(
        fixture.expected,
        approvedExpectedSha256,
        BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedMaximumLength,
      )) fail();

    return fixture;
  } catch {
    fail();
  }
}

function isApprovedValue(value, expectedHash, maximumLength) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\0]/.test(value)
    && createHash('sha256').update(value, 'utf8').digest('hex') === expectedHash;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail() {
  throw new Error('Block 6A public synthetic fixture validation failed.');
}
