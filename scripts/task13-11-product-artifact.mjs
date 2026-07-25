import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractFile } from '@electron/asar';

const manifestRelativePath =
  'config/block13-task13-11-product-artifact-v1.json';
export const task1311RuntimeAttestationFile =
  'writestorm-ai-runtime-attestation-v1.json';

export function loadTask1311ProductArtifactBoundary(repositoryRoot) {
  const manifest = JSON.parse(readFileSync(
    path.join(repositoryRoot, manifestRelativePath),
    'utf8',
  ));
  if (manifest?.schemaVersion !== 1
    || manifest?.boundaryId !== 'block13-task13-11-product-artifact-v1'
    || !Array.isArray(manifest.artifactFiles)
    || !Array.isArray(manifest.asarEntries)) {
    throw new Error('Task 13.11 product artifact boundary is invalid.');
  }
  assertDescriptors(manifest.artifactFiles, false);
  assertDescriptors(manifest.asarEntries, true);
  return manifest;
}

export function createTask1311ProductArtifactRecord(artifactRoot, boundary) {
  const files = boundary.artifactFiles.map(({ id, relativePath }) => {
    const bytes = readFileSync(resolveInside(artifactRoot, relativePath));
    return { id, size: bytes.length, sha256: hash(bytes) };
  });
  const asarEntries = boundary.asarEntries.map(({
    id,
    archiveRelativePath,
    entryPath,
  }) => {
    const archive = resolveInside(artifactRoot, archiveRelativePath);
    const bytes = extractFile(archive, entryPath.split('/').join(path.sep));
    return { id, size: bytes.length, sha256: hash(bytes) };
  });
  return {
    boundaryId: boundary.boundaryId,
    files,
    asarEntries,
    sha256: hash(Buffer.from(JSON.stringify({ files, asarEntries }))),
  };
}

export function assertTask1311CertificationBuildArtifact(
  artifactRoot,
  boundary,
  compatibilityFingerprint,
) {
  if (!/^[0-9a-f]{64}$/.test(compatibilityFingerprint)) {
    throw new Error('Task 13.11 certification fingerprint is invalid.');
  }
  const descriptor = boundary.asarEntries.find(
    ({ id }) => id === 'product_main_bundle',
  );
  if (!descriptor) {
    throw new Error('Task 13.11 product Main boundary is missing.');
  }
  const archive = resolveInside(artifactRoot, descriptor.archiveRelativePath);
  const mainBundle = extractFile(
    archive,
    descriptor.entryPath.split('/').join(path.sep),
  ).toString('utf8');
  const marker =
    `block13-task13-certification-build-v1:${compatibilityFingerprint}`;
  if (!mainBundle.includes(marker)) {
    throw new Error('Task 13.11 artifact is not an admitted certification build.');
  }
}

export function compactTask1311CompatibilityFingerprint(fingerprint) {
  return {
    boundaryId: fingerprint.boundaryId,
    gitHead: fingerprint.gitHead,
    layers: {
      supplyChain: fingerprint.layers.supplyChain.sha256,
      productionProtocol: fingerprint.layers.productionProtocol.sha256,
      probeArtifact: fingerprint.layers.probeArtifact.sha256,
    },
    sha256: fingerprint.sha256,
  };
}

export function createTask1311RuntimeAttestation(
  compatibilityFingerprint,
  artifact,
) {
  if (!/^[0-9a-f]{64}$/.test(compatibilityFingerprint?.sha256)
    || artifact?.boundaryId !== 'block13-task13-11-product-artifact-v1'
    || !Array.isArray(artifact.files)
    || artifact.files.map(({ id }) => id).join(',')
      !== 'writestorm_executable,app_asar,codex_executable'
    || !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
    throw new Error('Task 13.11 runtime attestation input is invalid.');
  }
  const receiptSha256 = hash(Buffer.from(JSON.stringify({
    boundaryId: artifact.boundaryId,
    files: artifact.files,
  })));
  return {
    schemaVersion: 1,
    authority: 'block13-runtime-artifact-attestation-v1',
    platform: 'win32',
    architecture: 'x64',
    compatibilityFingerprint: compatibilityFingerprint.sha256,
    artifact: {
      boundaryId: artifact.boundaryId,
      files: artifact.files,
      sha256: receiptSha256,
    },
  };
}

function assertDescriptors(descriptors, asar) {
  const ids = new Set();
  for (const descriptor of descriptors) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(descriptor?.id)
      || ids.has(descriptor.id)) {
      throw new Error('Task 13.11 product artifact descriptor is invalid.');
    }
    ids.add(descriptor.id);
    const values = asar
      ? [descriptor.archiveRelativePath, descriptor.entryPath]
      : [descriptor.relativePath];
    for (const value of values) assertSafeRelativePath(value);
  }
}

function assertSafeRelativePath(value) {
  if (typeof value !== 'string'
    || value.length === 0
    || path.isAbsolute(value)
    || value.split(/[\\/]/).includes('..')) {
    throw new Error('Task 13.11 product artifact path is invalid.');
  }
}

function resolveInside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath.split('/').join(path.sep));
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Task 13.11 product artifact path escaped its root.');
  }
  return resolved;
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
