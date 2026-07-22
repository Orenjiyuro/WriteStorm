import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertBlock6aWindowsArtifactRootPathBudget,
  createBlock6aCertificationStaging,
  finalizeBlock6aCertificationBundle,
} from '../../scripts/block6a-certification-bundle.mjs';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Block 6A immutable certification bundle', () => {
  it('atomically publishes artifact, evidence, verdict and normalized hashes once', () => {
    const root = temporaryRoot();
    const publishRoot = path.join(root, 'published');
    const certificationId = 'b6a-deadbeef-00000001';
    const staging = createBlock6aCertificationStaging(publishRoot, certificationId);
    const artifactRoot = path.join(staging.stagingRoot, 'artifact', 'writestorm-win32-x64');
    const evidenceRoot = path.join(staging.stagingRoot, 'evidence');
    mkdirSync(path.join(artifactRoot, 'resources'), { recursive: true });
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(path.join(artifactRoot, 'writestorm.exe'), 'binary-fixture', 'utf8');
    writeFileSync(path.join(artifactRoot, 'resources', 'app.asar'), 'asar-fixture', 'utf8');
    const evidencePaths = Array.from({ length: 7 }, (_unused, index) => {
      const filePath = path.join(evidenceRoot, `evidence-${index + 1}.json`);
      writeFileSync(filePath, JSON.stringify({ evidenceId: `evidence-${index + 1}` }), 'utf8');
      return filePath;
    });

    const published = finalizeBlock6aCertificationBundle({
      ...staging,
      certificationId,
      artifactRoot,
      evidencePaths,
      verdict: {
        verified: true,
        classification: 'conditional_go_windows_only_macos_deferred_by_user',
        verdict: 'conditional Go — Windows-only feasibility verified; macOS deferred-by-user',
      },
      gitHeadAtRun: '1'.repeat(40),
    });

    expect(existsSync(staging.stagingRoot)).toBe(false);
    expect(published.finalRoot).toBe(staging.finalRoot);
    expect(path.basename(staging.stagingRoot)).toBe(`.s-${certificationId}`);
    expect(existsSync(path.join(published.finalRoot, 'artifact', 'writestorm-win32-x64'))).toBe(true);
    const manifest = JSON.parse(readFileSync(
      path.join(published.finalRoot, 'bundle-manifest.json'),
      'utf8',
    )) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      certificationId,
      gitHeadAtRun: '1'.repeat(40),
      classification: 'immutable_windows_certification_bundle',
      artifactRelativePath: 'artifact/writestorm-win32-x64',
    });
    expect(manifest.artifactSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.artifactManifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.verdictSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.evidenceInputs).toHaveLength(7);
    expect(() => createBlock6aCertificationStaging(publishRoot, certificationId)).toThrow(
      'Block 6A certification bundle operation failed.',
    );
  });

  it('does not publish an unverified verdict or reuse an existing destination', () => {
    const root = temporaryRoot();
    const publishRoot = path.join(root, 'published');
    const certificationId = 'b6a-deadbeef-00000002';
    const staging = createBlock6aCertificationStaging(publishRoot, certificationId);
    const artifactRoot = path.join(staging.stagingRoot, 'artifact', 'writestorm-win32-x64');
    mkdirSync(artifactRoot, { recursive: true });
    writeFileSync(path.join(artifactRoot, 'writestorm.exe'), 'binary-fixture', 'utf8');

    expect(() => finalizeBlock6aCertificationBundle({
      ...staging,
      certificationId,
      artifactRoot,
      evidencePaths: [],
      verdict: { verified: false } as never,
      gitHeadAtRun: '1'.repeat(40),
    })).toThrow('Block 6A certification bundle operation failed.');
    expect(existsSync(staging.finalRoot)).toBe(false);
    expect(existsSync(staging.stagingRoot)).toBe(true);
  });

  it('fails closed before packaging when the Windows artifact root exceeds its path budget', () => {
    const withinBudget = `C:\\${'a'.repeat(107)}`;
    const overBudget = `${withinBudget}b`;

    expect(withinBudget).toHaveLength(110);
    expect(assertBlock6aWindowsArtifactRootPathBudget(withinBudget)).toBe(withinBudget);
    expect(() => assertBlock6aWindowsArtifactRootPathBudget(overBudget)).toThrow(
      'Block 6A certification bundle operation failed.',
    );
  });

  it('runs one clean-head certification command in fail-closed stage order', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const source = readFileSync(
      path.join(rootDir, 'scripts/certify-block6a-windows.mjs'),
      'utf8',
    );
    const packageManifest = JSON.parse(readFileSync(
      path.join(rootDir, 'package.json'),
      'utf8',
    )) as { scripts: Record<string, string> };
    const expectedOrder = [
      "run(npmInvocation.executable, [...npmInvocation.argsPrefix, 'run', 'check'])",
      "'scripts/package-block6a-certification.mjs'",
      "'scripts/verify-block6a-certification-package.mjs'",
      "runProbe('dev')",
      "runProbe('lifecycle')",
      "runProbe('packaged')",
      'verifyBlock6aCertificationFilesAtRepository(',
      'finalizeBlock6aCertificationBundle({',
    ];
    let previousIndex = -1;
    for (const marker of expectedOrder) {
      const index = source.indexOf(marker);
      expect(index, marker).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(packageManifest.scripts['certify:codex:windows']).toBe(
      'node scripts/certify-block6a-windows.mjs',
    );
    expect(packageManifest.scripts['probe:codex:packaged']).toBe(
      'npm run certify:codex:windows',
    );
    expect(source).not.toContain("spawnSync('npm.cmd'");
    expect(source).not.toContain('shell: true');
    expect(source).toContain("git(['status', '--porcelain', '--untracked-files=all'])");
    expect(source).toContain("git(['rev-parse', '@{u}'])");
    expect(source).toContain("path.basename(resolved) === `.s-${certificationId}`");
    expect(source).toContain("path.join(repositoryRoot, 'out', '6a')");
    expect(source).toContain('assertBlock6aWindowsArtifactRootPathBudget(artifactRoot)');
    expect(source).not.toContain("path.join(repositoryRoot, 'out', 'writestorm-win32-x64')");
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    expect(authority).toContain('the only verdict-producing command is:');
    expect(authority).toContain('npm run certify:codex:windows');
    expect(authority).toContain('An existing destination is never overwritten.');
    expect(authority).toContain('bundleManifestSha256');
    expect(authority).toContain('a hash without retrievable bundle custody is insufficient');
  });
});

function temporaryRoot(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-block6a-bundle-test-'));
  temporaryDirectories.push(directory);
  return directory;
}
