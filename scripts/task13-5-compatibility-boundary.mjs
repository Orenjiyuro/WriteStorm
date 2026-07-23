import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { extractFile } from '@electron/asar';

const boundaryRelativePath = 'config/block13-task13-5-compatibility-boundary-v1.json';
const sha256Pattern = /^[0-9a-f]{64}$/;
const gitHeadPattern = /^[0-9a-f]{40}$/;
const identifierPattern = /^[a-z][a-z0-9_]{0,79}$/;

export function loadTask135CompatibilityBoundary(repositoryRoot) {
  const boundaryPath = path.join(repositoryRoot, boundaryRelativePath);
  const value = JSON.parse(readFileSync(boundaryPath, 'utf8'));
  if (value?.schemaVersion !== 1
    || value?.boundaryId !== 'block13-task13-5-compatibility-v1'
    || !Array.isArray(value.sourceDirectories)
    || !Array.isArray(value.sourceFiles)
    || !Array.isArray(value.artifactFiles)
    || !Array.isArray(value.asarEntries)) {
    throw new Error('Task 13.5 compatibility boundary is invalid.');
  }
  assertUniqueRelativePaths(value.sourceDirectories, 'source directory');
  assertUniqueRelativePaths(value.sourceFiles, 'source file');
  assertArtifactDescriptors(value.artifactFiles, false);
  assertArtifactDescriptors(value.asarEntries, true);
  if (!value.sourceFiles.includes(boundaryRelativePath)) {
    throw new Error('Task 13.5 compatibility boundary must hash itself.');
  }
  return value;
}

export function createTask135SourceFingerprint(repositoryRoot, boundary, gitHead) {
  if (gitHead !== undefined && !gitHeadPattern.test(gitHead)) {
    throw new Error('Task 13.5 source fingerprint Git HEAD is invalid.');
  }
  const relativePaths = [
    ...boundary.sourceFiles,
    ...boundary.sourceDirectories.flatMap((relativeDirectory) => (
      listFilesRecursively(path.join(repositoryRoot, relativeDirectory))
        .map((filePath) => toPosixRelative(repositoryRoot, filePath))
    )),
  ].sort();
  if (new Set(relativePaths).size !== relativePaths.length) {
    throw new Error('Task 13.5 compatibility boundary contains duplicate source files.');
  }
  const files = relativePaths.map((relativePath) => ({
    relativePath,
    sha256: hashBytes(readFileSync(resolveInside(repositoryRoot, relativePath))),
  }));
  const sha256 = hashBytes(Buffer.from(JSON.stringify({
    boundaryId: boundary.boundaryId,
    files,
  })));
  return {
    boundaryId: boundary.boundaryId,
    ...(gitHead === undefined ? {} : { gitHead }),
    files,
    sha256,
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
  const sourceFingerprint = createTask135SourceFingerprint(
    repositoryRoot,
    boundary,
    evidence?.gitHeadAtRun,
  );
  const artifact = createTask135ArtifactRecord(artifactRoot, boundary);
  if (!recordsEqual(evidence?.compatibilityFingerprint, sourceFingerprint)) {
    throw new Error('Task 13.5 source compatibility fingerprint is stale.');
  }
  if (!recordsEqual(evidence?.artifact, artifact)) {
    throw new Error('Task 13.5 packaged artifact content record is stale.');
  }
  if (!sha256Pattern.test(evidence.compatibilityFingerprint.sha256)
    || !sha256Pattern.test(evidence.artifact.sha256)) {
    throw new Error('Task 13.5 evidence hash is invalid.');
  }
  return { sourceFingerprint, artifact };
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

function recordsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
