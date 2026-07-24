import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createTask135CompatibilityFingerprint,
  loadTask135CompatibilityBoundary,
} from './task13-5-compatibility-boundary.mjs';
import {
  compactTask1311CompatibilityFingerprint,
  createTask1311ProductArtifactRecord,
  loadTask1311ProductArtifactBoundary,
} from './task13-11-product-artifact.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(repositoryRoot, 'out', 'writestorm-win32-x64');
const executablePath = path.join(artifactRoot, 'writestorm.exe');
if (!existsSync(executablePath)) {
  throw new Error('Task 13.11 final product artifact is missing.');
}

const gitHead = git(['rev-parse', 'HEAD']).trim();
if (!/^[0-9a-f]{40}$/.test(gitHead)
  || git(['status', '--porcelain']).trim().length > 0) {
  throw new Error('Task 13.11 probe requires an exact clean Git HEAD.');
}

const runId = randomUUID();
const resultRoot = path.join(
  os.tmpdir(),
  'writestorm-task13-11-product',
  runId,
);
const productResultPath = path.join(resultRoot, 'result.json');
const evidencePath = path.join(resultRoot, 'evidence.json');
const launched = spawnSync(executablePath, [], {
  cwd: os.tmpdir(),
  env: {
    ...process.env,
    WRITESTORM_TASK13_11_PRODUCT_PROBE: '1',
    WRITESTORM_TASK13_11_RUN_ID: runId,
  },
  windowsHide: true,
  stdio: 'ignore',
  timeout: 420_000,
});
if (launched.error || launched.status !== 0) {
  throw new Error(
    `Task 13.11 packaged probe failed (status=${String(launched.status)}, `
    + `signal=${String(launched.signal)}, code=${launched.error?.code ?? 'none'}).`,
  );
}

const productResult = JSON.parse(readFileSync(productResultPath, 'utf8'));
assertAdmittedProductResult(productResult);
const compatibilityBoundary = loadTask135CompatibilityBoundary(repositoryRoot);
const compatibility = compactTask1311CompatibilityFingerprint(
  createTask135CompatibilityFingerprint(
    repositoryRoot,
    compatibilityBoundary,
    gitHead,
  ),
);
const artifact = createTask1311ProductArtifactRecord(
  artifactRoot,
  loadTask1311ProductArtifactBoundary(repositoryRoot),
);
const evidence = {
  schemaVersion: 1,
  task: '13.11',
  verdict: 'windows_product_packaged_runtime_verified_macos_deferred',
  fixtureHashes: {
    inputSha256:
      '59aa434b8ea52837a69ea3108fed8b68ba88d1619a52a2238beba6131f4c652d',
    expectedSha256:
      'a7f22d406f5cfb05b2d81c85aa8a8672196fb79e98ab44da89c45450bf9f344a',
    schemaSha256:
      '519d24096fd78b806b351fd28ef4c0167acf3c035e91fc9abacadadcd76f0ed8',
  },
  versions: productResult.versions,
  assertions: productResult.scenarios,
  compatibilityFingerprint: compatibility,
  artifact,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
});
process.stdout.write(`${evidencePath}\n`);

function assertAdmittedProductResult(result) {
  const scenarios = result?.scenarios;
  if (!hasExactKeys(result, [
    'schemaVersion',
    'fixtureId',
    'platformVerdict',
    'classification',
    'versions',
    'scenarios',
  ])
    || result?.schemaVersion !== 1
    || result?.fixtureId !== 'block13-product-packaged-probe-v1'
    || result?.platformVerdict !== 'windows_only_macos_deferred'
    || result?.classification !== 'windows_product_packaged_runtime_verified'
    || !Array.isArray(scenarios)
    || scenarios.length !== 3
    || scenarios.map((entry) => entry.scenario).join(',')
      !== 'success,cancel,timeout'
    || !hasExactKeys(result.versions, [
      'electron',
      'nodeRuntime',
      'codexSdk',
      'codexCli',
      'platformPackage',
    ])
    || !/^43\.\d+\.\d+$/.test(result.versions.electron)
    || !/^\d+\.\d+\.\d+$/.test(result.versions.nodeRuntime)
    || result.versions.codexSdk !== '0.144.6'
    || result.versions.codexCli !== '0.144.6'
    || result.versions.platformPackage !== '0.144.6-win32-x64'
    || !isPassingScenario(scenarios[0], 'success')
    || !isPassingScenario(scenarios[1], 'cancel')
    || !isPassingScenario(scenarios[2], 'timeout')) {
    throw new Error('Task 13.11 product result was not admitted.');
  }
}

function isPassingScenario(entry, scenario) {
  const assertions = entry?.assertions;
  const assertionKeys = [
    'sdkImported',
    'clientConstructed',
    'scratchInsideOsTemp',
    'nonGitWorkspace',
    'skipGitRepoCheck',
    'environmentAllowlisted',
    'finalJsonParsed',
    'strictValidatorAccepted',
    'expectedValueMatched',
    'abortRequested',
    'abortObserved',
    'timeoutTriggered',
    'cleanupAcknowledged',
    'utilityExitClean',
    'ownershipObserved',
    'residualScanCompleted',
    'utilityResidualAbsent',
    'cliResidualAbsent',
    'scratchCleanupCompleted',
  ];
  if (!hasExactKeys(entry, ['scenario', 'sessionOrdinal', 'outcome', 'assertions'])
    || entry?.scenario !== scenario
    || entry?.sessionOrdinal !== (scenario === 'success' ? 1 : scenario === 'cancel' ? 2 : 3)
    || !hasExactKeys(assertions, assertionKeys)
    || assertionKeys.some((key) => typeof assertions[key] !== 'boolean')) {
    return false;
  }
  const alwaysTrue = [
    'sdkImported',
    'clientConstructed',
    'scratchInsideOsTemp',
    'nonGitWorkspace',
    'skipGitRepoCheck',
    'environmentAllowlisted',
    'cleanupAcknowledged',
    'utilityExitClean',
    'ownershipObserved',
    'residualScanCompleted',
    'utilityResidualAbsent',
    'cliResidualAbsent',
    'scratchCleanupCompleted',
  ];
  if (alwaysTrue.some((key) => assertions[key] !== true)) return false;
  if (scenario === 'success') {
    return entry.outcome === 'success'
      && assertions.finalJsonParsed === true
      && assertions.strictValidatorAccepted === true
      && assertions.expectedValueMatched === true
      && assertions.abortRequested === false
      && assertions.abortObserved === false
      && assertions.timeoutTriggered === false;
  }
  return entry.outcome === 'aborted'
    && assertions.finalJsonParsed === false
    && assertions.strictValidatorAccepted === false
    && assertions.expectedValueMatched === false
    && assertions.abortRequested === true
    && assertions.abortObserved === true
    && assertions.timeoutTriggered === (scenario === 'timeout');
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}

function git(arguments_) {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('Task 13.11 Git check failed.');
  return result.stdout;
}
