import { randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  createTask135CompatibilityFingerprint,
  loadTask135CompatibilityBoundary,
} from './task13-5-compatibility-boundary.mjs';
import {
  assertTask1311CertificationBuildArtifact,
  compactTask1311CompatibilityFingerprint,
  createTask1311ProductArtifactRecord,
  createTask1311RuntimeAttestation,
  loadTask1311ProductArtifactBoundary,
  task1311RuntimeAttestationFile,
} from './task13-11-product-artifact.mjs';

const EXPLICIT_GATE = 'WRITESTORM_TASK13_12_SETTINGS_NATURAL_PATH_PROBE';
if (process.env[EXPLICIT_GATE] !== '1') {
  throw new Error('Task 13.12 Settings natural-path probe is not explicitly enabled.');
}
if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Task 13.12 Settings natural-path probe requires Windows x64.');
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(repositoryRoot, 'out', 'writestorm-win32-x64');
const executablePath = path.join(artifactRoot, 'writestorm.exe');
const codexExecutablePath = path.join(
  artifactRoot,
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
if (!existsSync(executablePath) || !existsSync(codexExecutablePath)) {
  throw new Error('Task 13.12 product artifact is incomplete.');
}

const gitHead = git(['rev-parse', 'HEAD']).trim();
if (!/^[0-9a-f]{40}$/.test(gitHead)
  || git(['status', '--porcelain']).trim().length > 0) {
  throw new Error('Task 13.12 Settings natural-path probe requires an exact clean Git HEAD.');
}

const compatibilityBoundary = loadTask135CompatibilityBoundary(repositoryRoot);
const compatibility = compactTask1311CompatibilityFingerprint(
  createTask135CompatibilityFingerprint(
    repositoryRoot,
    compatibilityBoundary,
    gitHead,
  ),
);
const productArtifactBoundary = loadTask1311ProductArtifactBoundary(repositoryRoot);
assertTask1311CertificationBuildArtifact(
  artifactRoot,
  productArtifactBoundary,
  compatibility.sha256,
);
const artifact = createTask1311ProductArtifactRecord(
  artifactRoot,
  productArtifactBoundary,
);
assertExactRuntimeAttestation(
  artifactRoot,
  createTask1311RuntimeAttestation(compatibility, artifact),
);

const runId = randomUUID();
const outputRoot = createOutputRoot(runId);
const userDataRoot = path.join(outputRoot, 'user-data');
mkdirSync(userDataRoot, { mode: 0o700 });
const evidencePath = path.join(outputRoot, 'evidence.json');
const port = await getFreePort();
const observationStartedAt = Date.now();
const childEnvironment = createChildEnvironment();
const appProcess = spawn(executablePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataRoot}`,
], {
  cwd: os.tmpdir(),
  env: childEnvironment,
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
});
if (!Number.isInteger(appProcess.pid) || appProcess.pid <= 0) {
  throw new Error('Task 13.12 product app did not start.');
}
const rootPid = appProcess.pid;
const boundedStderr = [];
appProcess.stderr?.on('data', (chunk) => {
  boundedStderr.push(...chunk.toString().split(/\r?\n/).filter(Boolean));
  if (boundedStderr.length > 40) boundedStderr.splice(0, boundedStderr.length - 40);
});
const exited = deferred();
appProcess.once('exit', (code, signal) => exited.resolve({ code, signal }));

let browser;
let naturalPathCompleted = false;
try {
  browser = await connectToPackagedElectron(port, exited);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? await context.waitForEvent('page');
  await page.getByRole('heading', { name: 'No library open' }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });

  const preClickCompatibility = await readDefinitionValue(page, 'SDK compatibility');
  const preClickRuntime = await readDefinitionValue(page, 'Runtime authentication');
  const preClickObservedAt = await readDefinitionValue(page, 'Observed at');
  const preClickSamples = [];
  for (let sample = 0; sample < 4; sample += 1) {
    preClickSamples.push(readWindowsObservation({
      rootPid,
      executablePath,
      codexExecutablePath,
      observationStartedAt,
    }));
    await delay(250);
  }
  const preClickExternalConnectionAbsent = preClickSamples.every(
    (sample) => sample.externalConnectionObserved === false,
  );
  const preClickAiProcessesAbsent = preClickSamples.every(
    (sample) => sample.aiProcessObserved === false,
  );
  if (preClickCompatibility !== 'Unknown'
    || preClickRuntime !== 'Unknown'
    || preClickObservedAt !== 'Not observed'
    || !preClickExternalConnectionAbsent
    || !preClickAiProcessesAbsent) {
    throw new Error('Task 13.12 pre-click boundary was not admitted.');
  }

  await page.getByRole('button', { name: 'Check connection' }).click();
  await waitForDefinitionValue(page, 'Runtime authentication', 'Authenticated', 90_000);
  const postClickCompatibility =
    await readDefinitionValue(page, 'SDK compatibility');
  const observedAt = await readDefinitionValue(page, 'Observed at');
  const visibleObservedAt = isCanonicalTimestamp(observedAt);
  const visibleAuthenticated =
    await readDefinitionValue(page, 'Runtime authentication') === 'Authenticated';
  await page.getByRole('button', { name: 'Check connection' }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
  const postResultObservation = readWindowsObservation({
    rootPid,
    executablePath,
    codexExecutablePath,
    observationStartedAt,
  });
  const postResultAiProcessesAbsent =
    postResultObservation.aiProcessObserved === false;
  if (postClickCompatibility !== 'Fresh'
    || !visibleAuthenticated
    || !visibleObservedAt
    || !postResultAiProcessesAbsent) {
    throw new Error('Task 13.12 visible result or cleanup boundary was not admitted.');
  }

  await page.evaluate(() => window.close());
  const appExit = await withTimeout(exited.promise, 15_000);
  await browser.close().catch(() => undefined);
  browser = undefined;
  if (appExit.code !== 0 || appExit.signal !== null) {
    throw new Error('Task 13.12 product app did not exit cleanly.');
  }
  await delay(750);
  const finalObservation = readWindowsObservation({
    rootPid,
    executablePath,
    codexExecutablePath,
    observationStartedAt,
  });
  const appTreeResidualAbsent = finalObservation.startedArtifactProcessObserved === false
    && finalObservation.aiProcessObserved === false;
  if (!appTreeResidualAbsent) {
    throw new Error('Task 13.12 product process tree left a residual.');
  }

  const evidence = {
    schemaVersion: 1,
    evidenceId: 'block13-task13-12-windows-settings-natural-path-001',
    task: '13.12',
    source: 'packaged_settings_ui',
    recordedAt: new Date().toISOString(),
    classification: 'windows_settings_natural_path_verified',
    gitHeadAtRun: gitHead,
    compatibilityFingerprint: compatibility,
    artifact: {
      boundaryId: artifact.boundaryId,
      sha256: artifact.sha256,
    },
    assertions: {
      packagedWindowsX64: true,
      normalProductMain: true,
      noLibraryOpenBeforeClick: true,
      settingsLinkClicked: true,
      connectionButtonClicked: true,
      preClickCompatibilityUnknown: true,
      preClickRuntimeUnknown: true,
      preClickObservedAtAbsent: true,
      preClickExternalConnectionAbsent,
      preClickAiProcessesAbsent,
      postClickCompatibilityFresh: true,
      visibleAuthenticated,
      visibleObservedAt,
      postResultAiProcessesAbsent,
      appExitClean: true,
      appTreeResidualAbsent,
    },
    observation: {
      authState: 'authenticated',
      observedAt,
    },
    limitations: [
      'Fixed product connection-check fixture only; no Library was open.',
      'Windows x64 development-machine artifact only.',
      'macOS, clean-machine, signing, Defender, proxy, enterprise certificate, firewall, offline and telemetry boundaries remain unverified or deferred.',
    ],
  };
  writeEvidenceExclusive(evidencePath, evidence);
  naturalPathCompleted = true;
  process.stdout.write(`${evidencePath}\n`);
} finally {
  await browser?.close().catch(() => undefined);
  if (!naturalPathCompleted && appProcess.exitCode === null && appProcess.signalCode === null) {
    terminateProcessTree(rootPid);
  }
  rmSync(userDataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function createChildEnvironment() {
  const environment = {
    ...process.env,
    WRITESTORM_DISABLE_HARDWARE_ACCELERATION: '1',
    WRITESTORM_E2E_DISPLAY_TARGET: 'secondary',
  };
  delete environment[EXPLICIT_GATE];
  delete environment.WRITESTORM_TASK13_11_PRODUCT_PROBE;
  delete environment.WRITESTORM_TASK13_11_RUN_ID;
  delete environment.WRITESTORM_TASK13_5_NO_GIT_PROBE;
  delete environment.WRITESTORM_TASK13_5_RUN_ID;
  delete environment.WRITESTORM_TASK13_5_GIT_HEAD;
  return environment;
}

function createOutputRoot(runId) {
  const parent = path.join(realpathSync(os.tmpdir()), 'writestorm-task13-12-settings');
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const outputRoot = path.join(parent, runId);
  mkdirSync(outputRoot, { recursive: false, mode: 0o700 });
  const stats = lstatSync(outputRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()
    || realpathSync(outputRoot) !== outputRoot) {
    throw new Error('Task 13.12 output root is not a canonical OS-temp directory.');
  }
  return outputRoot;
}

function writeEvidenceExclusive(filePath, value) {
  verifyOutputRoot(path.dirname(filePath));
  const descriptor = openSync(filePath, 'wx', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  verifyOutputRoot(path.dirname(filePath));
}

function verifyOutputRoot(outputRoot) {
  const stats = lstatSync(outputRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()
    || realpathSync(outputRoot) !== outputRoot) {
    throw new Error('Task 13.12 output root identity changed.');
  }
}

function assertExactRuntimeAttestation(root, expected) {
  const receiptPath = path.join(
    root,
    'resources',
    task1311RuntimeAttestationFile,
  );
  const actual = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Task 13.12 product artifact receipt is missing or stale.');
  }
}

async function readDefinitionValue(page, label) {
  const term = page.locator('dt', { hasText: label }).filter({ hasText: label });
  if (await term.count() !== 1) {
    throw new Error('Task 13.12 visible Settings field is ambiguous.');
  }
  return (await term.locator('xpath=..').locator('dd').innerText()).trim();
}

async function waitForDefinitionValue(page, label, expected, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await readDefinitionValue(page, label) === expected) return;
    await delay(250);
  }
  throw new Error('Task 13.12 visible Settings result timed out.');
}

function readWindowsObservation(input) {
  const script = [
    '$rootPid = [int]$env:WRITESTORM_OBSERVE_ROOT_PID',
    '$appPath = [string]$env:WRITESTORM_OBSERVE_APP_PATH',
    '$codexPath = [string]$env:WRITESTORM_OBSERVE_CODEX_PATH',
    '$startedAt = [long]$env:WRITESTORM_OBSERVE_STARTED_AT',
    '$items = @(Get-CimInstance Win32_Process)',
    '$ids = [System.Collections.Generic.HashSet[int]]::new()',
    '$queue = [System.Collections.Generic.Queue[int]]::new()',
    '$null = $ids.Add($rootPid)',
    '$queue.Enqueue($rootPid)',
    'while ($queue.Count -gt 0) {',
    '  $parent = $queue.Dequeue()',
    '  foreach ($child in $items | Where-Object { [int]$_.ParentProcessId -eq $parent }) {',
    '    $pidValue = [int]$child.ProcessId',
    '    if ($ids.Add($pidValue)) { $queue.Enqueue($pidValue) }',
    '  }',
    '}',
    '$ai = @($items | Where-Object {',
    '  $created = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }',
    '  [int]$_.ProcessId -ne $PID -and $created -ge $startedAt -and (',
    '    ([string]$_.ExecutablePath -ieq $codexPath) -or',
    "    ([string]$_.CommandLine -match 'codex-utility-entry')",
    '  )',
    '})',
    '$artifact = @($items | Where-Object {',
    '  $created = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }',
    '  $created -ge $startedAt -and ([string]$_.ExecutablePath -ieq $appPath)',
    '})',
    '$connections = @(Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object {',
    '  $ids.Contains([int]$_.OwningProcess) -and',
    "  @('127.0.0.1','::1','0.0.0.0','::') -notcontains [string]$_.RemoteAddress",
    '})',
    '[pscustomobject]@{',
    '  externalConnectionObserved = $connections.Count -gt 0',
    '  aiProcessObserved = $ai.Count -gt 0',
    '  startedArtifactProcessObserved = $artifact.Count -gt 0',
    '} | ConvertTo-Json -Compress',
  ].join('\n');
  const output = execFileSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
  ], {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      WRITESTORM_OBSERVE_ROOT_PID: String(input.rootPid),
      WRITESTORM_OBSERVE_APP_PATH: input.executablePath,
      WRITESTORM_OBSERVE_CODEX_PATH: input.codexExecutablePath,
      WRITESTORM_OBSERVE_STARTED_AT: String(input.observationStartedAt),
    },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const parsed = JSON.parse(output);
  if (typeof parsed?.externalConnectionObserved !== 'boolean'
    || typeof parsed?.aiProcessObserved !== 'boolean'
    || typeof parsed?.startedArtifactProcessObserved !== 'boolean') {
    throw new Error('Task 13.12 process observation is invalid.');
  }
  return parsed;
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (
        typeof address === 'object' && address?.port
          ? resolve(address.port)
          : reject(new Error('Task 13.12 local inspection port is unavailable.'))
      ));
    });
    server.once('error', reject);
  });
}

async function connectToPackagedElectron(port, exited) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    const appExit = await Promise.race([
      exited.promise.then((value) => value),
      delay(0).then(() => null),
    ]);
    if (appExit) {
      throw new Error('Task 13.12 product app exited before Settings opened.');
    }
    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Task 13.12 product inspection connection failed.');
}

function terminateProcessTree(pid) {
  spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
}

function git(arguments_) {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Task 13.12 Git check failed.');
  return result.stdout;
}

function isCanonicalTimestamp(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && new Date(value).toISOString() === value;
}

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Task 13.12 product app exit timed out.')),
        timeoutMs,
      );
      timer.unref();
    }),
  ]);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
