import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPackage } from '@electron/asar';
import { describe, expect, it } from 'vitest';
import {
  createTask135ArtifactRecord,
  createTask135SourceFingerprint,
  loadTask135CompatibilityBoundary,
} from '../../scripts/task13-5-compatibility-boundary.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.5 canonical compatibility boundary', () => {
  it('covers the complete feasibility runtime and every external probe authority', () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);

    expect(boundary).toMatchObject({
      schemaVersion: 1,
      boundaryId: 'block13-task13-5-compatibility-v1',
      sourceDirectories: ['src/main/codex-feasibility'],
    });
    expect(boundary.sourceFiles).toEqual(expect.arrayContaining([
      'config/block13-task13-5-compatibility-boundary-v1.json',
      'config/block6a-feasibility-manifest-v1.json',
      'forge.block6a-certification.config.ts',
      'forge.config.ts',
      'vite.block6a-certification-main.config.ts',
      'vite.codex-feasibility.config.ts',
      'scripts/run-task13-5-no-git-packaged-probe.mjs',
      'scripts/task13-5-compatibility-boundary.mjs',
      'scripts/verify-task13-5-packaged-evidence.mjs',
      'src/main/ai/providers/codex/codex-scratch-workspace.ts',
      'src/main/ai/providers/codex/codex-utility-entry.ts',
      'vite.codex-utility.config.ts',
    ]));

    const fingerprint = createTask135SourceFingerprint(rootDir, boundary);
    const paths = fingerprint.files.map((entry) => entry.relativePath);
    expect(paths).toEqual(expect.arrayContaining([
      'src/main/codex-feasibility/certification-main.ts',
      'src/main/codex-feasibility/environment.ts',
      'src/main/codex-feasibility/lifecycle.ts',
      'src/main/codex-feasibility/manifest.ts',
    ]));
    expect(new Set(paths).size).toBe(paths.length);
    expect(fingerprint.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes actual packaged files and required ASAR entry bytes', async () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);
    const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-5-artifact-'));
    const artifactRoot = path.join(fixtureRoot, 'artifact');
    const asarSource = path.join(fixtureRoot, 'asar-source');
    mkdirSync(path.join(artifactRoot, 'resources', 'app.asar.unpacked', 'node_modules',
      '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin'), {
      recursive: true,
    });
    mkdirSync(path.join(asarSource, '.vite', 'build'), { recursive: true });
    writeFileSync(path.join(artifactRoot, 'writestorm.exe'), 'desktop-executable');
    writeFileSync(path.join(artifactRoot, 'resources', 'app.asar.unpacked', 'node_modules',
      '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin',
      'codex.exe'), 'codex-executable');
    writeFileSync(path.join(asarSource, '.vite', 'build', 'main.js'), 'main-bundle');
    writeFileSync(path.join(asarSource, '.vite', 'build', 'utility-entry.js'), 'utility-bundle');
    writeFileSync(path.join(asarSource, 'package.json'), '{"name":"writestorm"}');
    await createPackage(asarSource, path.join(artifactRoot, 'resources', 'app.asar'));

    try {
      const first = createTask135ArtifactRecord(artifactRoot, boundary);
      expect(first.files.map((entry) => entry.id)).toEqual([
        'writestorm_executable',
        'app_asar',
        'codex_executable',
      ]);
      expect(first.asarEntries.map((entry) => entry.id)).toEqual([
        'certification_main_bundle',
        'codex_utility_bundle',
        'packaged_package_manifest',
      ]);

      writeFileSync(path.join(artifactRoot, 'writestorm.exe'), 'tampered-executable');
      const tampered = createTask135ArtifactRecord(artifactRoot, boundary);
      expect(tampered.sha256).not.toBe(first.sha256);
      expect(tampered.files[0].sha256).not.toBe(first.files[0].sha256);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('keeps the committed evidence bound to the canonical source record', () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);
    const evidence = JSON.parse(readFileSync(
      path.join(
        rootDir,
        'docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json',
      ),
      'utf8',
    ));
    expect(evidence.compatibilityFingerprint).toEqual(
      createTask135SourceFingerprint(rootDir, boundary),
    );
    expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
