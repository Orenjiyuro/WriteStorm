import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPackage } from '@electron/asar';
import { describe, expect, it } from 'vitest';
import {
  assertTask1311CertificationBuildArtifact,
  compactTask1311CompatibilityFingerprint,
  createTask1311RuntimeAttestation,
  createTask1311ProductArtifactRecord,
  loadTask1311ProductArtifactBoundary,
} from '../../scripts/task13-11-product-artifact.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.11 final product artifact boundary', () => {
  it('hashes the final product Main, production utility, SDK, CLI and platform bytes', async () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'writestorm-task13-11-artifact-'));
    const artifact = path.join(temporary, 'artifact');
    const asarSource = path.join(temporary, 'asar');
    const codexExecutable = path.join(
      artifact,
      'resources',
      'app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    );
    mkdirSync(path.dirname(codexExecutable), { recursive: true });
    mkdirSync(path.join(asarSource, '.vite', 'build'), { recursive: true });
    for (const packageName of ['codex-sdk', 'codex', 'codex-win32-x64']) {
      mkdirSync(path.join(asarSource, 'node_modules', '@openai', packageName), {
        recursive: true,
      });
      writeFileSync(
        path.join(asarSource, 'node_modules', '@openai', packageName, 'package.json'),
        JSON.stringify({ name: `@openai/${packageName}`, version: '0.144.6' }),
      );
    }
    mkdirSync(artifact, { recursive: true });
    writeFileSync(path.join(artifact, 'writestorm.exe'), 'product');
    writeFileSync(codexExecutable, 'codex');
    const fingerprint = '9'.repeat(64);
    writeFileSync(
      path.join(asarSource, '.vite', 'build', 'main.js'),
      `product-main block13-task13-certification-build-v1:${fingerprint}`,
    );
    writeFileSync(
      path.join(asarSource, '.vite', 'build', 'codex-utility-entry.js'),
      'product-utility',
    );
    await createPackage(asarSource, path.join(artifact, 'resources', 'app.asar'));

    try {
      const record = createTask1311ProductArtifactRecord(
        artifact,
        loadTask1311ProductArtifactBoundary(rootDir),
      );
      expect(record.files.map((entry) => entry.id)).toEqual([
        'writestorm_executable',
        'app_asar',
        'codex_executable',
      ]);
      expect(record.asarEntries.map((entry) => entry.id)).toEqual([
        'product_main_bundle',
        'product_codex_utility_bundle',
        'codex_sdk_manifest',
        'codex_cli_manifest',
        'codex_platform_manifest',
      ]);
      expect(JSON.stringify(record)).not.toContain(artifact);
      expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(() => assertTask1311CertificationBuildArtifact(
        artifact,
        loadTask1311ProductArtifactBoundary(rootDir),
        fingerprint,
      )).not.toThrow();
      expect(() => assertTask1311CertificationBuildArtifact(
        artifact,
        loadTask1311ProductArtifactBoundary(rootDir),
        '8'.repeat(64),
      )).toThrow('not an admitted certification build');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('compacts compatibility evidence without serializing source paths', () => {
    const compact = compactTask1311CompatibilityFingerprint({
      boundaryId: 'block13-task13-5-compatibility-v1',
      gitHead: 'a'.repeat(40),
      layers: {
        supplyChain: { sha256: '1'.repeat(64), files: [{ relativePath: 'secret' }] },
        productionProtocol: { sha256: '2'.repeat(64), files: [] },
        probeArtifact: { sha256: '3'.repeat(64), files: [] },
      },
      sha256: '4'.repeat(64),
    });

    expect(compact).toEqual({
      boundaryId: 'block13-task13-5-compatibility-v1',
      gitHead: 'a'.repeat(40),
      layers: {
        supplyChain: '1'.repeat(64),
        productionProtocol: '2'.repeat(64),
        probeArtifact: '3'.repeat(64),
      },
      sha256: '4'.repeat(64),
    });
    expect(JSON.stringify(compact)).not.toContain('secret');
  });

  it('creates a strict external attestation without hashing itself', () => {
    const compatibility = {
      boundaryId: 'block13-task13-5-compatibility-v1',
      gitHead: 'a'.repeat(40),
      layers: {
        supplyChain: '1'.repeat(64),
        productionProtocol: '2'.repeat(64),
        probeArtifact: '3'.repeat(64),
      },
      sha256: '4'.repeat(64),
    };
    const files = [
      { id: 'writestorm_executable', size: 1, sha256: '5'.repeat(64) },
      { id: 'app_asar', size: 2, sha256: '6'.repeat(64) },
      { id: 'codex_executable', size: 3, sha256: '7'.repeat(64) },
    ];
    expect(createTask1311RuntimeAttestation(compatibility, {
      boundaryId: 'block13-task13-11-product-artifact-v1',
      files,
      asarEntries: [],
      sha256: '8'.repeat(64),
    })).toEqual({
      schemaVersion: 1,
      authority: 'block13-runtime-artifact-attestation-v1',
      platform: 'win32',
      architecture: 'x64',
      compatibilityFingerprint: compatibility.sha256,
      artifact: {
        boundaryId: 'block13-task13-11-product-artifact-v1',
        files,
        sha256: '8'.repeat(64),
      },
    });
  });
});
