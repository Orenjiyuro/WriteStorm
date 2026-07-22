import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createBlock6aCertificationStaging,
  finalizeBlock6aCertificationBundle,
} from './block6a-certification-bundle.mjs';
import { verifyBlock6aCertificationFilesAtRepository } from './block6a-certification-verifier.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publishRoot = path.join(repositoryRoot, 'out', 'block6a-certifications');
const head = requireCleanPushedHead();

const certificationId = `block6a-win-${head.slice(0, 12)}-${Date.now()}-${randomUUID().slice(0, 8)}`;
const staging = createBlock6aCertificationStaging(publishRoot, certificationId);
const packageOutRoot = path.join(staging.stagingRoot, 'artifact');
const artifactRoot = path.join(packageOutRoot, 'writestorm-win32-x64');
const evidenceRoot = path.join(staging.stagingRoot, 'evidence');

try {
  run(npmExecutable(), ['run', 'check']);
  run(process.execPath, [
    'scripts/package-block6a-certification.mjs',
    '--out-dir',
    packageOutRoot,
  ]);
  run(process.execPath, [
    'scripts/verify-block6a-certification-package.mjs',
    '--artifact-root',
    artifactRoot,
  ]);
  runProbe('dev');
  runProbe('lifecycle');
  runProbe('packaged');

  const evidencePaths = readdirSync(evidenceRoot)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(evidenceRoot, entry))
    .sort();
  const verdict = verifyBlock6aCertificationFilesAtRepository(
    evidencePaths,
    repositoryRoot,
    artifactRoot,
  );
  const published = finalizeBlock6aCertificationBundle({
    ...staging,
    certificationId,
    artifactRoot,
    evidencePaths,
    verdict,
    gitHeadAtRun: head,
  });
  process.stdout.write(`${JSON.stringify({
    certificationId,
    classification: verdict.classification,
    bundleRelativePath: normalize(path.relative(repositoryRoot, published.finalRoot)),
    artifactSha256: published.artifactSha256,
    artifactManifestSha256: published.artifactManifestSha256,
    bundleManifestSha256: published.bundleManifestSha256,
  })}\n`);
} catch {
  cleanupOwnedStaging();
  process.stderr.write('Block 6A Windows certification failed; no bundle was published.\n');
  process.exitCode = 1;
}

function runProbe(mode) {
  const args = [
    'scripts/run-block6a-probes.mjs',
    mode,
    '--evidence-output-root',
    evidenceRoot,
  ];
  if (mode === 'packaged') args.push('--artifact-root', artifactRoot);
  run(process.execPath, args);
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Certification stage failed.');
}

function git(args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
}

function requireCleanPushedHead() {
  try {
    const candidate = git(['rev-parse', 'HEAD']).trim();
    const upstream = git(['rev-parse', '@{u}']).trim();
    if (candidate !== upstream
      || git(['status', '--porcelain', '--untracked-files=all']).trim()) throw new Error();
    return candidate;
  } catch {
    process.stderr.write('Block 6A certification requires a clean pushed HEAD.\n');
    process.exit(1);
  }
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function cleanupOwnedStaging() {
  const resolved = path.resolve(staging.stagingRoot);
  if (path.dirname(resolved) === path.resolve(publishRoot)
    && path.basename(resolved) === `.staging-${certificationId}`
    && existsSync(resolved)) {
    rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function normalize(value) {
  return String(value).replaceAll('\\', '/');
}
