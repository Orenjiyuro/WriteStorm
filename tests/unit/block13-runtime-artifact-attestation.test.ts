import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_RUNTIME_ATTESTATION_FILE,
  verifyAiRuntimeArtifactAttestation,
} from '../../src/main/ai/ai-runtime-artifact-attestation';

const compatibilityFingerprint = 'a'.repeat(64);

describe('Block 13 packaged artifact attestation', () => {
  it('admits only the exact certified artifact bytes', async () => {
    const fixture = createArtifactFixture();
    try {
      writeAttestation(fixture);
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({
        state: 'verified',
        compatibilityFingerprint,
      });

      writeAttestation(fixture, compatibilityFingerprint, 'c'.repeat(64));
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({ state: 'unverified' });

      writeAttestation(fixture);
      writeFileSync(fixture.appAsarPath, 'new uncertified app artifact');
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({ state: 'unverified' });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('fails closed for missing, malformed or source-mismatched attestations', async () => {
    const fixture = createArtifactFixture();
    try {
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({ state: 'unverified' });

      writeFileSync(
        path.join(fixture.resourcesPath, AI_RUNTIME_ATTESTATION_FILE),
        '{"schemaVersion":1}',
      );
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({ state: 'unverified' });

      writeAttestation(fixture, 'b'.repeat(64));
      await expect(verifyAiRuntimeArtifactAttestation({
        executablePath: fixture.executablePath,
        resourcesPath: fixture.resourcesPath,
        compatibilityFingerprint,
      })).resolves.toEqual({ state: 'unverified' });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

function createArtifactFixture(): {
  readonly root: string;
  readonly executablePath: string;
  readonly resourcesPath: string;
  readonly appAsarPath: string;
  readonly codexExecutablePath: string;
} {
  const root = mkdtempSync(path.join(os.tmpdir(), 'writestorm-attestation-'));
  const executablePath = path.join(root, 'writestorm.exe');
  const resourcesPath = path.join(root, 'resources');
  const appAsarPath = path.join(resourcesPath, 'app.asar');
  const codexExecutablePath = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '@openai',
    'codex-win32-x64',
    'vendor',
    'x86_64-pc-windows-msvc',
    'bin',
    'codex.exe',
  );
  mkdirSync(path.dirname(codexExecutablePath), { recursive: true });
  writeFileSync(executablePath, 'product executable');
  writeFileSync(appAsarPath, 'certified app artifact');
  writeFileSync(codexExecutablePath, 'codex executable');
  return { root, executablePath, resourcesPath, appAsarPath, codexExecutablePath };
}

function writeAttestation(
  fixture: ReturnType<typeof createArtifactFixture>,
  fingerprint = compatibilityFingerprint,
  aggregateOverride?: string,
): void {
  const files = [
    ['writestorm_executable', fixture.executablePath],
    ['app_asar', fixture.appAsarPath],
    ['codex_executable', fixture.codexExecutablePath],
  ].map(([id, filePath]) => {
    const bytes = readFileSync(filePath);
    return {
      id,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  const aggregate = createHash('sha256')
    .update(JSON.stringify({
      boundaryId: 'block13-task13-11-product-artifact-v1',
      files,
    }))
    .digest('hex');
  writeFileSync(
    path.join(fixture.resourcesPath, AI_RUNTIME_ATTESTATION_FILE),
    `${JSON.stringify({
      schemaVersion: 1,
      authority: 'block13-runtime-artifact-attestation-v1',
      platform: 'win32',
      architecture: 'x64',
      compatibilityFingerprint: fingerprint,
      artifact: {
        boundaryId: 'block13-task13-11-product-artifact-v1',
        files,
        sha256: aggregateOverride ?? aggregate,
      },
    })}\n`,
  );
}
