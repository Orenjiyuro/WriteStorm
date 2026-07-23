import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';
import { createJiti } from 'jiti';
import { build, mergeConfig } from 'vite';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID();
const buildRoot = path.join(repositoryRoot, '.vite', `task13-utility-smoke-${runId}`);
const smokeAppRoot = path.join(buildRoot, 'smoke-app');
const utilityBuildRoot = path.join(buildRoot, 'utility');
const smokeRoot = path.join(os.tmpdir(), `writestorm-task13-utility-smoke-${runId}`);
const utilityEntry = path.join(
  repositoryRoot,
  'src/main/ai/providers/codex/codex-utility-entry.ts',
);
const smokeMainEntry = path.join(
  repositoryRoot,
  'tests/smoke/block13-production-utility-smoke-main.ts',
);
const utilityBundle = path.join(utilityBuildRoot, 'codex-utility-entry.js');
const smokeMainBundle = path.join(smokeAppRoot, 'smoke-main.cjs');
const sharedViteConfigPath = path.join(
  repositoryRoot,
  'config/codex-utility-vite-config.ts',
);
const networkBlockerPath = path.join(
  repositoryRoot,
  'tests/smoke/block13-network-blocker.cjs',
);
const networkObservationPath = path.join(smokeRoot, 'network-observation.json');
const utilitySource = readFileSync(utilityEntry, 'utf8');
let processResult;
let networkObservation;

if (/^const\s+\w+\s*=\s*new\s+Codex/m.test(utilitySource)
  || /startThread|resumeThread|runStreamed|process\.env/.test(utilitySource)) {
  throw new Error('Production Codex utility is no longer an offline import-only boundary.');
}

try {
  const jiti = createJiti(import.meta.url);
  const { CODEX_UTILITY_VITE_CONFIG } = await jiti.import(sharedViteConfigPath);
  await build(mergeConfig(CODEX_UTILITY_VITE_CONFIG, {
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: true,
      lib: {
        entry: utilityEntry,
        formats: ['cjs'],
        fileName: () => 'codex-utility-entry.js',
      },
      outDir: utilityBuildRoot,
      rollupOptions: {
        output: {
          banner: `require(${JSON.stringify(networkBlockerPath)});`,
        },
      },
    },
  }));
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: false,
      lib: {
        entry: smokeMainEntry,
        formats: ['cjs'],
        fileName: () => 'smoke-main.cjs',
      },
      outDir: smokeAppRoot,
      rollupOptions: {
        external: ['electron', 'node:fs', 'node:path'],
      },
      target: 'node22',
    },
  });
  if (!existsSync(utilityBundle) || !existsSync(smokeMainBundle)) {
    throw new Error('Production utility smoke bundle is missing.');
  }
  mkdirSync(smokeAppRoot, { recursive: true });
  writeFileSync(path.join(smokeAppRoot, 'package.json'), JSON.stringify({
    name: 'writestorm-block13-utility-smoke',
    private: true,
    main: 'smoke-main.cjs',
  }));

  processResult = spawnSync(electronPath, ['--enable-logging=stderr', smokeAppRoot], {
    cwd: repositoryRoot,
    env: createOfflineEnvironment(smokeRoot, utilityBundle),
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  if (processResult.error || processResult.status !== 0) {
    const smokeObservation = readSmokeObservation(smokeRoot);
    const startupDiagnostic = sanitizeStartupDiagnostic(processResult.stderr);
    throw new Error(
      `Production utility smoke process failed (status=${String(processResult.status)}, `
      + `signal=${String(processResult.signal)}, code=${processResult.error?.code ?? 'none'}, `
      + `stage=${smokeObservation.stage}, utility=${smokeObservation.diagnostic}, `
      + `startup=${startupDiagnostic}).`,
    );
  }
  const processEvidence = JSON.parse(processResult.stdout.trim());
  networkObservation = readNetworkObservation(networkObservationPath);
  if (processEvidence.exactBundleResolved !== true
    || processEvidence.sdkExportImported !== true
    || processEvidence.unsupportedMessageExitCode !== 28
    || networkObservation.installed !== true
    || networkObservation.attemptCount !== 0
    || networkObservation.attemptedKinds.length !== 0) {
    throw new Error('Production utility smoke assertions failed.');
  }
} finally {
  rmSync(buildRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  classification: 'production_utility_offline_smoke_passed',
  exactBundleResolved: true,
  sdkExportImported: true,
  unsupportedMessageExitCode: 28,
  credentialEnvironmentExcluded: true,
  proxyEnvironmentExcluded: true,
  networkGuardInstalled: networkObservation.installed,
  networkAttemptCount: networkObservation.attemptCount,
  networkAccessObserved: networkObservation.attemptCount !== 0,
  cleanupCompleted: !existsSync(buildRoot) && !existsSync(smokeRoot),
})}\n`);

function createOfflineEnvironment(smokeRootPath, utilityBundlePath) {
  const environment = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || isRejectedEnvironmentKey(key)) continue;
    environment[key] = value;
  }
  if (Object.keys(environment).some(isRejectedEnvironmentKey)) {
    throw new Error('Offline smoke environment retained a rejected key.');
  }
  environment.WRITESTORM_BLOCK13_UTILITY_SMOKE = '1';
  environment.WRITESTORM_BLOCK13_UTILITY_SMOKE_ROOT = smokeRootPath;
  environment.WRITESTORM_BLOCK13_UTILITY_BUNDLE = utilityBundlePath;
  environment.WRITESTORM_BLOCK13_NETWORK_OBSERVATION = networkObservationPath;
  return environment;
}

function isRejectedEnvironmentKey(key) {
  return /OPENAI|CODEX|PROXY|(^|_)(AUTH|TOKEN|KEY|SECRET|PASSWORD)(_|$)/i.test(key)
    || /^(NODE_OPTIONS|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|ELECTRON_RUN_AS_NODE)$/i
      .test(key);
}

function readSmokeObservation(smokeRootPath) {
  try {
    const value = JSON.parse(readFileSync(path.join(smokeRootPath, 'stage.json'), 'utf8'));
    const stage = typeof value?.stage === 'string' && /^[a-z0-9_]+$/.test(value.stage)
      ? value.stage
      : 'invalid_stage';
    const diagnostic = typeof value?.diagnostic === 'string'
      ? value.diagnostic.replace(/[\r\n]+/g, ' ').slice(0, 500)
      : 'none';
    return { stage, diagnostic };
  } catch {
    return { stage: 'stage_missing', diagnostic: 'none' };
  }
}

function readNetworkObservation(observationPath) {
  let value;
  try {
    value = JSON.parse(readFileSync(observationPath, 'utf8'));
  } catch {
    throw new Error('Production utility network guard observation is missing.');
  }
  if (value?.schemaVersion !== 1
    || value?.installed !== true
    || !Number.isSafeInteger(value?.attemptCount)
    || value.attemptCount < 0
    || !Array.isArray(value?.attemptedKinds)
    || value.attemptedKinds.some((kind) => (
      typeof kind !== 'string' || !/^[a-z0-9.]+$/.test(kind)
    ))) {
    throw new Error('Production utility network guard observation is invalid.');
  }
  return value;
}

function sanitizeStartupDiagnostic(stderr) {
  if (!stderr) return 'none';
  return stderr
    .replaceAll(repositoryRoot, '<repository>')
    .replaceAll(smokeRoot, '<temporary>')
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/gi, '<user>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
}
