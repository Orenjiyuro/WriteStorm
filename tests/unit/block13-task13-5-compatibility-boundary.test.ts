import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPackage } from '@electron/asar';
import { describe, expect, it } from 'vitest';
import {
  createTask135ArtifactRecord,
  createTask135CompatibilityFingerprint,
  evaluateTask135CompatibilityFreshness,
  loadTask135CompatibilityBoundary,
} from '../../scripts/task13-5-compatibility-boundary.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.5 canonical compatibility boundary', () => {
  it('separates supply-chain, production-protocol and probe-artifact authorities', () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);

    expect(boundary).toMatchObject({
      schemaVersion: 2,
      boundaryId: 'block13-task13-5-compatibility-v1',
      layers: {
        supplyChain: {
          sourceDirectories: [],
        },
        productionProtocol: {
          sourceDirectories: ['src/main/ai'],
        },
        probeArtifact: {
          sourceDirectories: ['src/main/codex-feasibility'],
        },
      },
    });
    expect(boundary.layers.supplyChain.sourceFiles).toEqual(expect.arrayContaining([
      'config/block6a-feasibility-manifest-v1.json',
      'package-lock.json',
      'package.json',
    ]));
    expect(boundary.layers.productionProtocol.sourceFiles).toEqual(expect.arrayContaining([
      'config/block13-product-packaged-probe-v1.json',
      'config/codex-product-runtime-package.ts',
      'config/codex-utility-vite-config.ts',
      'forge.config.ts',
      'src/main/main-lifecycle.ts',
      'src/main/main.ts',
      'src/main/windows/main-window.ts',
      'vite.codex-utility.config.ts',
      'vite.main.config.ts',
    ]));
    expect(boundary.layers.probeArtifact.sourceFiles).toEqual(expect.arrayContaining([
      'config/block13-task13-11-product-artifact-v1.json',
      'config/block13-task13-5-compatibility-boundary-v1.json',
      'forge.block6a-certification.config.ts',
      'vite.block6a-certification-main.config.ts',
      'vite.codex-feasibility.config.ts',
      'scripts/run-task13-5-no-git-packaged-probe.mjs',
      'scripts/run-task13-11-product-packaged-probe.mjs',
      'scripts/task13-11-product-artifact.d.mts',
      'scripts/task13-11-product-artifact.mjs',
      'scripts/task13-5-compatibility-boundary.mjs',
      'scripts/verify-task13-5-packaged-evidence.mjs',
    ]));

    const fingerprint = createTask135CompatibilityFingerprint(rootDir, boundary);
    const productionPaths = fingerprint.layers.productionProtocol.files
      .map((entry) => entry.relativePath);
    expect(productionPaths).toEqual(expect.arrayContaining([
      'src/main/ai/ai-execution-port.ts',
      'src/main/ai/ai-runtime-diagnostics.ts',
      'src/main/ai/providers/codex/codex-provider-adapter.ts',
      'src/main/ai/providers/codex/codex-runtime-diagnostics.ts',
      'src/main/ai/providers/codex/codex-utility-transport.ts',
      'src/main/ai/providers/codex/codex-utility-entry.ts',
      'src/main/main-lifecycle.ts',
      'src/main/main.ts',
      'src/main/windows/main-window.ts',
    ]));
    const probePaths = fingerprint.layers.probeArtifact.files
      .map((entry) => entry.relativePath);
    expect(probePaths).toEqual(expect.arrayContaining([
      'src/main/codex-feasibility/certification-main.ts',
      'src/main/codex-feasibility/environment.ts',
      'src/main/codex-feasibility/lifecycle.ts',
      'src/main/codex-feasibility/manifest.ts',
    ]));
    expect(new Set(productionPaths).size).toBe(productionPaths.length);
    expect(new Set(probePaths).size).toBe(probePaths.length);
    expect(fingerprint.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed by the exact compatibility layer that drifted', () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);
    const current = createTask135CompatibilityFingerprint(rootDir, boundary);
    const recorded = {
      ...current,
      layers: {
        ...current.layers,
        productionProtocol: {
          ...current.layers.productionProtocol,
          sha256: '0'.repeat(64),
        },
      },
    };

    expect(evaluateTask135CompatibilityFreshness(current, recorded)).toEqual({
      status: 'stale',
      staleLayers: ['productionProtocol'],
      layers: {
        supplyChain: 'fresh',
        productionProtocol: 'stale',
        probeArtifact: 'fresh',
      },
    });
    expect(evaluateTask135CompatibilityFreshness(current, current)).toEqual({
      status: 'fresh',
      staleLayers: [],
      layers: {
        supplyChain: 'fresh',
        productionProtocol: 'fresh',
        probeArtifact: 'fresh',
      },
    });
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

  it('accepts the recertified no-global-Git evidence against every current layer', () => {
    const boundary = loadTask135CompatibilityBoundary(rootDir);
    const evidence = JSON.parse(readFileSync(
      path.join(
        rootDir,
        'docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json',
      ),
      'utf8',
    ));
    const current = createTask135CompatibilityFingerprint(
      rootDir,
      boundary,
      evidence.gitHeadAtRun,
    );
    expect(evaluateTask135CompatibilityFreshness(
      current,
      evidence.compatibilityFingerprint,
    )).toEqual({
      status: 'fresh',
      staleLayers: [],
      layers: {
        supplyChain: 'fresh',
        productionProtocol: 'fresh',
        probeArtifact: 'fresh',
      },
    });
    expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
