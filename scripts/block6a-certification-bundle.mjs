import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const failureMessage = 'Block 6A certification bundle operation failed.';
const certificationIdPattern = /^b6a-[0-9a-f]{8}-[0-9a-f]{8}$/;
const windowsArtifactRootMaximumLength = 110;

export function createBlock6aCertificationStaging(publishRoot, certificationId) {
  try {
    if (typeof publishRoot !== 'string'
      || !certificationIdPattern.test(certificationId)) fail();
    const resolvedPublishRoot = path.resolve(publishRoot);
    const stagingRoot = path.join(resolvedPublishRoot, `.s-${certificationId}`);
    const finalRoot = path.join(resolvedPublishRoot, certificationId);
    assertDirectChild(stagingRoot, resolvedPublishRoot);
    assertDirectChild(finalRoot, resolvedPublishRoot);
    mkdirSync(resolvedPublishRoot, { recursive: true });
    if (existsSync(stagingRoot) || existsSync(finalRoot)) fail();
    mkdirSync(stagingRoot);
    return { stagingRoot, finalRoot };
  } catch {
    fail();
  }
}

export function finalizeBlock6aCertificationBundle(options) {
  try {
    if (!isRecord(options)
      || !certificationIdPattern.test(options.certificationId)
      || !/^[0-9a-f]{40}$/.test(options.gitHeadAtRun)
      || !isRecord(options.verdict)
      || options.verdict.verified !== true
      || options.verdict.classification
        !== 'conditional_go_windows_only_macos_deferred_by_user'
      || !Array.isArray(options.evidencePaths)
      || options.evidencePaths.length !== 7) fail();

    const stagingRoot = path.resolve(options.stagingRoot);
    const finalRoot = path.resolve(options.finalRoot);
    const publishRoot = path.dirname(stagingRoot);
    if (path.basename(stagingRoot) !== `.s-${options.certificationId}`
      || finalRoot !== path.join(publishRoot, options.certificationId)
      || !existsSync(stagingRoot)
      || existsSync(finalRoot)) fail();
    const artifactRoot = path.resolve(options.artifactRoot);
    assertInside(artifactRoot, stagingRoot);
    if (!existsSync(artifactRoot) || collectFiles(artifactRoot).length === 0) fail();

    const evidenceInputs = options.evidencePaths.map((filePath) => {
      const absolutePath = path.resolve(filePath);
      assertInside(absolutePath, path.join(stagingRoot, 'evidence'));
      const parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
      if (!isRecord(parsed) || typeof parsed.evidenceId !== 'string') fail();
      return {
        evidenceId: parsed.evidenceId,
        relativePath: normalize(path.relative(stagingRoot, absolutePath)),
        sha256: hashFile(absolutePath),
      };
    }).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    if (new Set(evidenceInputs.map(({ evidenceId }) => evidenceId)).size !== 7) fail();

    const artifactFiles = collectFiles(artifactRoot).map((filePath) => ({
      relativePath: normalize(path.relative(artifactRoot, filePath)),
      size: statSync(filePath).size,
      sha256: hashFile(filePath),
    }));
    const artifactManifestPath = path.join(stagingRoot, 'artifact-manifest.json');
    writeJson(artifactManifestPath, { schemaVersion: 1, files: artifactFiles });
    const verdictPath = path.join(stagingRoot, 'verdict.json');
    writeJson(verdictPath, options.verdict);
    const artifactSha256 = hashDirectory(artifactRoot);
    const artifactManifestSha256 = hashFile(artifactManifestPath);
    const verdictSha256 = hashFile(verdictPath);
    const payloadHash = createHash('sha256');
    payloadHash.update(artifactSha256);
    payloadHash.update(artifactManifestSha256);
    payloadHash.update(verdictSha256);
    for (const evidence of evidenceInputs) payloadHash.update(evidence.sha256);

    const bundleManifestPath = path.join(stagingRoot, 'bundle-manifest.json');
    writeJson(bundleManifestPath, {
      schemaVersion: 1,
      certificationId: options.certificationId,
      classification: 'immutable_windows_certification_bundle',
      recordedAt: new Date().toISOString(),
      gitHeadAtRun: options.gitHeadAtRun,
      artifactRelativePath: normalize(path.relative(stagingRoot, artifactRoot)),
      artifactSha256,
      artifactManifestSha256,
      verdictSha256,
      bundlePayloadSha256: payloadHash.digest('hex'),
      evidenceInputs,
      overwritePolicy: 'fail_if_destination_exists',
      macosStatus: 'deferred-by-user',
    });

    renameSync(stagingRoot, finalRoot);
    return {
      finalRoot,
      artifactSha256,
      artifactManifestSha256,
      bundleManifestSha256: hashFile(path.join(finalRoot, 'bundle-manifest.json')),
    };
  } catch {
    fail();
  }
}

export function assertBlock6aWindowsArtifactRootPathBudget(artifactRoot) {
  if (typeof artifactRoot !== 'string'
    || !path.isAbsolute(artifactRoot)
    || artifactRoot.length > windowsArtifactRootMaximumLength) fail();
  return artifactRoot;
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : entry.isFile() ? [entryPath] : [];
  }).sort((left, right) => normalize(left).localeCompare(normalize(right)));
}

function hashDirectory(directory) {
  const hash = createHash('sha256');
  for (const filePath of collectFiles(directory)) {
    hash.update(normalize(path.relative(directory, filePath)));
    hash.update('\0');
    hash.update(hashFile(filePath));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function assertDirectChild(candidate, parent) {
  if (path.dirname(candidate) !== parent) fail();
}

function assertInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail();
}

function normalize(value) {
  return String(value).replaceAll('\\', '/');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail() {
  throw new Error(failureMessage);
}
