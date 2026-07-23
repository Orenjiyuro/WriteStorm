import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { extractFile } from '@electron/asar';

const boundaryRelativePath = 'config/block13-task13-5-compatibility-boundary-v1.json';
const compatibilityLayerNames = [
  'supplyChain',
  'productionProtocol',
  'probeArtifact',
];
const sha256Pattern = /^[0-9a-f]{64}$/;
const gitHeadPattern = /^[0-9a-f]{40}$/;
const identifierPattern = /^[a-z][a-z0-9_]{0,79}$/;

export function loadTask135CompatibilityBoundary(repositoryRoot) {
  const boundaryPath = path.join(repositoryRoot, boundaryRelativePath);
  const value = JSON.parse(readFileSync(boundaryPath, 'utf8'));
  if (value?.schemaVersion !== 2
    || value?.boundaryId !== 'block13-task13-5-compatibility-v1'
    || !isExactLayerRecord(value.layers)
    || !Array.isArray(value.artifactFiles)
    || !Array.isArray(value.asarEntries)) {
    throw new Error('Task 13.5 compatibility boundary is invalid.');
  }
  for (const layerName of compatibilityLayerNames) {
    const layer = value.layers[layerName];
    assertUniqueRelativePaths(layer.sourceDirectories, `${layerName} source directory`);
    assertUniqueRelativePaths(layer.sourceFiles, `${layerName} source file`);
  }
  assertArtifactDescriptors(value.artifactFiles, false);
  assertArtifactDescriptors(value.asarEntries, true);
  if (!value.layers.probeArtifact.sourceFiles.includes(boundaryRelativePath)) {
    throw new Error('Task 13.5 compatibility boundary must hash itself.');
  }
  return value;
}

export function createTask135CompatibilityFingerprint(
  repositoryRoot,
  boundary,
  gitHead,
) {
  if (gitHead !== undefined && !gitHeadPattern.test(gitHead)) {
    throw new Error('Task 13.5 compatibility fingerprint Git HEAD is invalid.');
  }
  const layers = Object.fromEntries(compatibilityLayerNames.map((layerName) => {
    const definition = boundary.layers[layerName];
    const relativePaths = [
      ...definition.sourceFiles,
      ...definition.sourceDirectories.flatMap((relativeDirectory) => (
        listFilesRecursively(path.join(repositoryRoot, relativeDirectory))
          .map((filePath) => toPosixRelative(repositoryRoot, filePath))
      )),
    ].sort();
    if (new Set(relativePaths).size !== relativePaths.length) {
      throw new Error(`Task 13.5 ${layerName} boundary contains duplicate source files.`);
    }
    const files = relativePaths.map((relativePath) => ({
      relativePath,
      sha256: hashBytes(normalizeSourceBytes(
        readFileSync(resolveInside(repositoryRoot, relativePath)),
      )),
    }));
    return [layerName, {
      files,
      sha256: hashBytes(Buffer.from(JSON.stringify({ layerName, files }))),
    }];
  }));
  const sha256 = hashBytes(Buffer.from(JSON.stringify({
    boundaryId: boundary.boundaryId,
    layers,
  })));
  return {
    boundaryId: boundary.boundaryId,
    ...(gitHead === undefined ? {} : { gitHead }),
    layers,
    sha256,
  };
}

export function evaluateTask135CompatibilityFreshness(current, recorded) {
  const layerStates = Object.fromEntries(compatibilityLayerNames.map((layerName) => [
    layerName,
    recordsEqual(current?.layers?.[layerName], recorded?.layers?.[layerName])
      ? 'fresh'
      : 'stale',
  ]));
  const staleLayers = compatibilityLayerNames.filter(
    (layerName) => layerStates[layerName] === 'stale',
  );
  return {
    status: staleLayers.length === 0
      && current?.boundaryId === recorded?.boundaryId
      && current?.sha256 === recorded?.sha256
      ? 'fresh'
      : 'stale',
    staleLayers,
    layers: layerStates,
  };
}

export function createTask135ArtifactRecord(artifactRoot, boundary) {
  const files = boundary.artifactFiles.map(({ id, relativePath }) => {
    const bytes = readFileSync(resolveInside(artifactRoot, relativePath));
    return { id, relativePath, size: bytes.length, sha256: hashBytes(bytes) };
  });
  const asarEntries = boundary.asarEntries.map(({
    id,
    archiveRelativePath,
    entryPath,
  }) => {
    const archivePath = resolveInside(artifactRoot, archiveRelativePath);
    const bytes = extractFile(archivePath, fromPosixPath(entryPath));
    return {
      id,
      archiveRelativePath,
      entryPath,
      size: bytes.length,
      sha256: hashBytes(bytes),
    };
  });
  return {
    boundaryId: boundary.boundaryId,
    files,
    asarEntries,
    sha256: hashBytes(Buffer.from(JSON.stringify({ files, asarEntries }))),
  };
}

export function assertTask135EvidenceMatches(input) {
  const {
    evidence,
    repositoryRoot,
    artifactRoot,
    boundary = loadTask135CompatibilityBoundary(repositoryRoot),
  } = input;
  const compatibilityFingerprint = createTask135CompatibilityFingerprint(
    repositoryRoot,
    boundary,
    evidence?.gitHeadAtRun,
  );
  const compatibility = evaluateTask135CompatibilityFreshness(
    compatibilityFingerprint,
    evidence?.compatibilityFingerprint,
  );
  const artifact = createTask135ArtifactRecord(artifactRoot, boundary);
  if (compatibility.status !== 'fresh') {
    throw new Error(
      `Task 13.5 compatibility fingerprint is stale (${compatibility.staleLayers.join(',')}).`,
    );
  }
  if (!recordsEqual(evidence?.artifact, artifact)) {
    throw new Error('Task 13.5 packaged artifact content record is stale.');
  }
  if (!sha256Pattern.test(evidence.compatibilityFingerprint.sha256)
    || !sha256Pattern.test(evidence.artifact.sha256)) {
    throw new Error('Task 13.5 evidence hash is invalid.');
  }
  return { compatibilityFingerprint, compatibility, artifact };
}

function isExactLayerRecord(value) {
  if (!value || typeof value !== 'object'
    || Object.keys(value).sort().join(',') !== compatibilityLayerNames.slice().sort().join(',')) {
    return false;
  }
  return compatibilityLayerNames.every((layerName) => (
    Array.isArray(value[layerName]?.sourceDirectories)
    && Array.isArray(value[layerName]?.sourceFiles)
  ));
}

function assertUniqueRelativePaths(values, label) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Task 13.5 ${label} list contains duplicates.`);
  }
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)
      || value.split(/[\\/]/).includes('..')) {
      throw new Error(`Task 13.5 ${label} must be a safe relative path.`);
    }
  }
}

function assertArtifactDescriptors(values, includesAsarEntry) {
  const ids = new Set();
  for (const value of values) {
    if (!identifierPattern.test(value?.id) || ids.has(value.id)) {
      throw new Error('Task 13.5 artifact descriptor id is invalid or duplicated.');
    }
    ids.add(value.id);
    const paths = includesAsarEntry
      ? [value.archiveRelativePath, value.entryPath]
      : [value.relativePath];
    assertUniqueRelativePaths(paths, 'artifact descriptor path');
  }
}

function listFilesRecursively(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory()
      ? listFilesRecursively(entryPath)
      : [entryPath];
  });
}

function resolveInside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, fromPosixPath(relativePath));
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Task 13.5 boundary path escaped its root.');
  }
  return resolved;
}

function fromPosixPath(value) {
  return value.split('/').join(path.sep);
}

function toPosixRelative(root, value) {
  return path.relative(root, value).split(path.sep).join('/');
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeSourceBytes(bytes) {
  if (bytes.includes(0)) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

function recordsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
