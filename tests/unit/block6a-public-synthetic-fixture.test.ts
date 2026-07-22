import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH,
  loadBlock6aPublicSyntheticFixture,
} from '../../scripts/block6a-public-synthetic-fixture.mjs';
import { BLOCK6A_FEASIBILITY_MANIFEST } from '../../src/main/codex-feasibility/manifest';

const rootDir = path.resolve(__dirname, '../..');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Block 6A public synthetic fixture', () => {
  it('provides the approved versioned non-sensitive values from a stable repository path', () => {
    const fixture = loadBlock6aPublicSyntheticFixture(rootDir);

    expect(BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH).toBe(
      BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.path,
    );
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      fixtureId: BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.fixtureId,
      classification: 'public_non_sensitive',
      owner: 'WriteStorm engineering authority',
      inputSha256: BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.inputSha256,
      expectedSha256: BLOCK6A_FEASIBILITY_MANIFEST.syntheticFixture.expectedSha256,
    });
    expect(fixture.rotationPolicy).toContain('new fixtureId');
  });

  it('rejects content changes even when an attacker also changes the fixture-local hash', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-block6a-fixture-test-'));
    temporaryDirectories.push(directory);
    const fixture = JSON.parse(readFileSync(
      path.join(rootDir, BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH),
      'utf8',
    )) as Record<string, unknown>;
    fixture.input = 'different public text';
    fixture.inputSha256 = '0'.repeat(64);
    const candidatePath = path.join(directory, 'candidate.json');
    writeFileSync(candidatePath, JSON.stringify(fixture), 'utf8');

    expect(() => loadBlock6aPublicSyntheticFixture(rootDir, candidatePath)).toThrow(
      'Block 6A public synthetic fixture validation failed.',
    );
  });

  it('makes the repository fixture authoritative instead of caller environment values', () => {
    const runner = readFileSync(path.join(rootDir, 'scripts/run-block6a-probes.mjs'), 'utf8');

    expect(runner).toContain('loadBlock6aPublicSyntheticFixture(root)');
    expect(runner).not.toContain(
      'const syntheticInput = process.env.WRITESTORM_CODEX_SYNTHETIC_INPUT',
    );
    expect(runner).not.toContain(
      'const syntheticExpected = process.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED',
    );
    expect(runner).toContain(
      'environment.WRITESTORM_CODEX_SYNTHETIC_INPUT = syntheticFixture.input',
    );
    expect(runner).toContain(
      'environment.WRITESTORM_CODEX_SYNTHETIC_EXPECTED = syntheticFixture.expected',
    );
  });

  it('documents acquisition and rotation while keeping fixture text out of evidence', () => {
    const fixture = loadBlock6aPublicSyntheticFixture(rootDir);
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    const evidenceDirectory = path.join(rootDir, 'docs/engineering/evidence');
    const currentEvidence = [
      'block6a-r8a5-windows-dev-capability-admitted-with-conditions.json',
      'block6a-r8a5-windows-dev-output-schema-admitted-with-conditions.json',
      'block6a-r8a5-windows-lifecycle-app-timeout.json',
      'block6a-r8a5-windows-lifecycle-explicit-cancel.json',
      'block6a-r8a5-windows-lifecycle-window-close.json',
      'block6a-r8a5-windows-lifecycle-app-quit.json',
      'block6a-r8a5-windows-packaged-sdk.json',
    ].map((file) => readFileSync(path.join(evidenceDirectory, file), 'utf8'));

    expect(authority).toContain(BLOCK6A_PUBLIC_FIXTURE_RELATIVE_PATH);
    expect(authority).toContain('WriteStorm engineering authority');
    expect(authority).toContain('Changing either value requires a new fixture ID');
    for (const evidence of currentEvidence) {
      expect(evidence).not.toContain(fixture.input);
      expect(evidence).not.toContain(`\"expected\": \"${fixture.expected}\"`);
    }
  });
});
