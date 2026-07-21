import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const lineageFailureMessage = 'Block 6A evidence lineage verification failed.';
const evidenceInputPaths = [
  'docs/engineering/evidence/block6a-remediation-r2-environment-boundary.json',
  'docs/engineering/evidence/block6a-remediation-r4a-process-ownership.json',
  'docs/engineering/evidence/block6a-remediation-r4b-safe-termination.json',
  'docs/engineering/evidence/block6a-remediation-r5-error-classification.json',
  'docs/engineering/evidence/block6a-remediation-r6-assertion-provenance.json',
  'docs/engineering/evidence/block6a-remediation-r7-evidence-lineage.json',
  'docs/engineering/evidence/block6a-remediation-r8a-turn-deadline.json',
  'docs/engineering/evidence/block6a-remediation-r8a3-runtime-failure-origin.json',
  'docs/engineering/evidence/block6a-remediation-r8a4-cjs-module-anchor.json',
];
const fixedRuntimeBoundaryPaths = [
  'package.json',
  'package-lock.json',
  'forge.config.ts',
  'vite.main.config.ts',
  'vite.preload.config.ts',
  'vite.renderer.config.ts',
  'src/main/main.ts',
  'scripts/block6a-probe-admission.mjs',
  'scripts/block6a-probe-admission.d.mts',
  'scripts/block6a-evidence-lineage.mjs',
  'scripts/block6a-evidence-lineage.d.mts',
  'scripts/verify-block6a-evidence-lineage.mjs',
  'scripts/run-block6a-probes.mjs',
  'tests/verification/block6a-codex-package-boundary.test.ts',
];

export function createBlock6aLineageSnapshot(repositoryRoot, mode, packagedArtifactRoot) {
  const gitHeadAtRun = git(repositoryRoot, ['rev-parse', 'HEAD']).trim();
  const runtimeBoundaryPaths = collectRuntimeBoundaryPaths(repositoryRoot);
  const trackedDiffClean = gitExitCode(
    repositoryRoot,
    ['diff', '--quiet', 'HEAD', '--', ...runtimeBoundaryPaths],
  ) === 0;
  const untracked = git(
    repositoryRoot,
    ['ls-files', '--others', '--exclude-standard', '--', ...runtimeBoundaryPaths],
  ).trim();

  return {
    gitHeadAtRun,
    criticalInputsCleanAtRun: trackedDiffClean && untracked.length === 0,
    packageLockSha256: hashFile(path.join(repositoryRoot, 'package-lock.json')),
    runtimeBoundarySha256: hashRelativeFiles(repositoryRoot, runtimeBoundaryPaths),
    packagedArtifactSha256: mode === 'packaged'
      ? hashDirectory(requiredArtifactRoot(packagedArtifactRoot))
      : null,
    evidenceInputs: readEvidenceInputs(repositoryRoot),
  };
}

export function verifyBlock6aEvidenceLineageAtRepository(
  lineage,
  repositoryRoot,
  packagedArtifactRoot,
) {
  const finalHead = git(repositoryRoot, ['rev-parse', 'HEAD']).trim();
  const isRunHeadAncestor = gitExitCode(
    repositoryRoot,
    ['merge-base', '--is-ancestor', lineage.gitHeadAtRun, finalHead],
  ) === 0;
  const changedPaths = git(
    repositoryRoot,
    ['diff', '--name-only', lineage.gitHeadAtRun, finalHead],
  ).split(/\r?\n/).filter(Boolean).map(normalizePath);
  const runtimeBoundaryPaths = collectRuntimeBoundaryPaths(repositoryRoot);
  const current = {
    finalHead,
    isRunHeadAncestor,
    changedPaths,
    packageLockSha256: hashFile(path.join(repositoryRoot, 'package-lock.json')),
    runtimeBoundarySha256: hashRelativeFiles(repositoryRoot, runtimeBoundaryPaths),
    packagedArtifactSha256: lineage.packagedArtifactSha256 === null
      ? null
      : hashDirectory(requiredArtifactRoot(packagedArtifactRoot)),
    evidenceInputs: readEvidenceInputs(repositoryRoot),
  };
  return evaluateBlock6aEvidenceLineage(lineage, current);
}

export function evaluateBlock6aEvidenceLineage(lineage, current) {
  if (!isRecord(lineage)
    || !isRecord(current)
    || !/^[0-9a-f]{40}$/.test(lineage.gitHeadAtRun)
    || lineage.criticalInputsCleanAtRun !== true
    || !isHash(lineage.packageLockSha256)
    || !isHash(lineage.runtimeBoundarySha256)
    || !(lineage.packagedArtifactSha256 === null || isHash(lineage.packagedArtifactSha256))
    || current.isRunHeadAncestor !== true
    || current.packageLockSha256 !== lineage.packageLockSha256
    || current.runtimeBoundarySha256 !== lineage.runtimeBoundarySha256
    || current.packagedArtifactSha256 !== lineage.packagedArtifactSha256
    || !sameEvidenceInputs(lineage.evidenceInputs, current.evidenceInputs)
    || !Array.isArray(current.changedPaths)
    || current.changedPaths.some((entry) => !isAllowedBlock6aEvidenceOnlyPath(entry))) {
    throw new Error(lineageFailureMessage);
  }
  return { verified: true, classification: 'evidence_lineage_verified' };
}

export function isAllowedBlock6aEvidenceOnlyPath(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith('docs/engineering/evidence/block6a-')
    || [
      'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md',
      'docs/engineering/CONTEXT.md',
      'docs/engineering/DECISIONS.md',
      'tests/unit/block6a-codex-evidence-lineage.test.ts',
      'tests/unit/block6a-codex-sdk-feasibility-docs.test.ts',
    ].includes(normalized);
}

function collectRuntimeBoundaryPaths(repositoryRoot) {
  const codexSourceRoot = path.join(repositoryRoot, 'src/main/codex-feasibility');
  const codexSources = collectFiles(codexSourceRoot)
    .map((filePath) => normalizePath(path.relative(repositoryRoot, filePath)));
  const viteConfigs = readdirSync(repositoryRoot)
    .filter((entry) => /^vite\..+\.config\.ts$/.test(entry));
  return [...new Set([...fixedRuntimeBoundaryPaths, ...viteConfigs, ...codexSources])].sort();
}

function readEvidenceInputs(repositoryRoot) {
  return evidenceInputPaths.map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    const parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
    if (!isRecord(parsed) || typeof parsed.evidenceId !== 'string') fail();
    return { evidenceId: parsed.evidenceId, sha256: hashFile(absolutePath) };
  });
}

function hashRelativeFiles(repositoryRoot, relativePaths) {
  const hash = createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(normalizePath(relativePath));
    hash.update('\0');
    hash.update(hashFile(path.join(repositoryRoot, relativePath)));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function hashDirectory(directory) {
  const hash = createHash('sha256');
  for (const filePath of collectFiles(directory)) {
    hash.update(normalizePath(path.relative(directory, filePath)));
    hash.update('\0');
    hash.update(hashFile(filePath));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(entryPath));
    else if (entry.isFile() && statSync(entryPath).size >= 0) files.push(entryPath);
  }
  return files.sort((left, right) => normalizePath(left).localeCompare(normalizePath(right)));
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function sameEvidenceInputs(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((entry, index) => isRecord(entry)
    && isRecord(right[index])
    && typeof entry.evidenceId === 'string'
    && isHash(entry.sha256)
    && entry.evidenceId === right[index].evidenceId
    && entry.sha256 === right[index].sha256);
}

function requiredArtifactRoot(value) {
  if (typeof value !== 'string' || value.length === 0) fail();
  return value;
}

function git(repositoryRoot, args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
}

function gitExitCode(repositoryRoot, args) {
  try {
    execFileSync('git', args, { cwd: repositoryRoot, stdio: 'ignore' });
    return 0;
  } catch (error) {
    return isRecord(error) && typeof error.status === 'number' ? error.status : 1;
  }
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/');
}

function isHash(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail() {
  throw new Error(lineageFailureMessage);
}
