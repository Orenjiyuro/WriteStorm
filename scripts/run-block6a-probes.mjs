import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';

const approvedInputHash = '59a9268039bb5bad326151cbe27320c64c89cbf5b054035978c432a4ce5c4a26';
const approvedExpectedHash = '6fe7aac1e4d9ae4aec0a14e6bfd46af4ee18892c247a2d0aecfa5091f017afab';
const root = process.cwd();
const mode = process.argv[2];
const syntheticInput = process.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
const syntheticExpected = process.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED;

if (!['dev', 'lifecycle', 'packaged'].includes(mode)) {
  throw new Error('Expected probe mode: dev | lifecycle | packaged.');
}
assertApprovedSyntheticValue(syntheticInput, approvedInputHash, 160, 'input');
assertApprovedSyntheticValue(syntheticExpected, approvedExpectedHash, 64, 'expected value');

const runId = randomUUID();
const resultRoot = path.join(os.tmpdir(), 'writestorm-block6a-reproduction', runId);
mkdirSync(resultRoot, { recursive: true });

try {
  const results = mode === 'packaged'
    ? [await runPackagedProbe(runId)]
    : await runDevelopmentProbes(mode);
  const summary = results.map((result) => ({
    task: result.task,
    source: result.source,
    classification: result.classification,
  }));
  process.stdout.write(`${JSON.stringify({ mode, results: summary })}\n`);
  if (summary.some((item) => /failed|rejected|infrastructure/.test(String(item.classification)))) {
    process.exitCode = 1;
  }
} finally {
  if (process.env.WRITESTORM_CODEX_KEEP_SANITIZED_RESULTS !== '1') {
    rmSync(resultRoot, { recursive: true, force: true });
  }
}

async function runDevelopmentProbes(selectedMode) {
  const buildRoot = path.join(root, '.vite', 'block6a-reproduction');
  await buildProbeEntries(buildRoot);
  const utilityPath = path.join(buildRoot, 'utility-entry.cjs');
  const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const safeEnvironment = createSafeEnvironment({
    WRITESTORM_CODEX_UTILITY_PATH: utilityPath,
    WRITESTORM_CODEX_SOURCE_ROOT: root,
  });
  if (selectedMode === 'dev') {
    const capabilityPath = path.join(resultRoot, 'capability.json');
    const outputSchemaPath = path.join(resultRoot, 'output-schema.json');
    await runElectron(electronPath, path.join(buildRoot, 'probe-main.cjs'), {
      ...safeEnvironment,
      WRITESTORM_CODEX_CAPABILITY_RESULT: capabilityPath,
    });
    await runElectron(electronPath, path.join(buildRoot, 'output-schema-probe-main.cjs'), {
      ...safeEnvironment,
      WRITESTORM_CODEX_OUTPUT_SCHEMA_RESULT: outputSchemaPath,
    });
    return [readSanitizedResult(capabilityPath), readSanitizedResult(outputSchemaPath)];
  }

  const cliPath = path.join(
    root,
    'node_modules',
    '@openai',
    'codex-win32-x64',
    'vendor',
    'x86_64-pc-windows-msvc',
    'bin',
    'codex.exe',
  );
  if (!existsSync(cliPath)) throw new Error('Project-local Windows Codex executable is missing.');
  const results = [];
  for (const scenario of ['app-timeout', 'explicit-cancel', 'window-close', 'app-quit']) {
    const resultPath = path.join(resultRoot, `lifecycle-${scenario}.json`);
    await runElectron(electronPath, path.join(buildRoot, 'lifecycle-probe-main.cjs'), {
      ...safeEnvironment,
      WRITESTORM_CODEX_CLI_PATH: cliPath,
      WRITESTORM_CODEX_LIFECYCLE_RESULT: resultPath,
      WRITESTORM_CODEX_LIFECYCLE_SCENARIO: scenario,
    });
    results.push(readSanitizedResult(resultPath));
  }
  return results;
}

async function runPackagedProbe(packagedRunId) {
  const executable = path.join(root, 'out', 'writestorm-win32-x64', 'writestorm.exe');
  if (!existsSync(executable)) throw new Error('Windows x64 package is missing; run npm run package first.');
  const packagedResultRoot = path.join(
    os.tmpdir(),
    'writestorm-block6a-packaged',
    packagedRunId,
  );
  rmSync(packagedResultRoot, { recursive: true, force: true });
  const resultPath = path.join(packagedResultRoot, 'result.json');
  try {
    await runElectron(executable, undefined, createSafeEnvironment({
      WRITESTORM_CODEX_PACKAGED_PROBE: '1',
      WRITESTORM_CODEX_PROBE_RUN_ID: packagedRunId,
    }));
    return readSanitizedResult(resultPath);
  } finally {
    if (process.env.WRITESTORM_CODEX_KEEP_SANITIZED_RESULTS !== '1') {
      rmSync(packagedResultRoot, { recursive: true, force: true });
    }
  }
}

async function buildProbeEntries(outDir) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      target: 'node22',
      outDir,
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
      lib: {
        entry: {
          'utility-entry': path.join(root, 'src/main/codex-feasibility/utility-entry.ts'),
          'probe-main': path.join(root, 'src/main/codex-feasibility/probe-main.ts'),
          'output-schema-probe-main': path.join(root, 'src/main/codex-feasibility/output-schema-probe-main.ts'),
          'lifecycle-probe-main': path.join(root, 'src/main/codex-feasibility/lifecycle-probe-main.ts'),
        },
        formats: ['cjs'],
      },
      rollupOptions: {
        external: (id) => id === 'electron'
          || id === '@openai/codex-sdk'
          || id === '@openai/codex'
          || id.startsWith('node:'),
        output: { entryFileNames: '[name].cjs' },
      },
    },
  });
}

function createSafeEnvironment(additions) {
  const environment = { ...process.env, ...additions };
  for (const key of Object.keys(environment)) {
    if (/^(?:OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN)$/i.test(key)) delete environment[key];
  }
  environment.WRITESTORM_CODEX_SYNTHETIC_INPUT = syntheticInput;
  environment.WRITESTORM_CODEX_SYNTHETIC_EXPECTED = syntheticExpected;
  return environment;
}

function runElectron(executable, entry, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, entry ? [entry] : [], {
      cwd: root,
      env,
      windowsHide: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Probe process exited with code ${String(code)}.`));
    });
  });
}

function readSanitizedResult(filePath) {
  const result = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!result || typeof result !== 'object' || typeof result.classification !== 'string') {
    throw new Error('Probe did not produce a sanitized classification.');
  }
  return result;
}

function assertApprovedSyntheticValue(value, expectedHash, maximumLength, label) {
  const valid = typeof value === 'string'
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\0]/.test(value)
    && createHash('sha256').update(value, 'utf8').digest('hex') === expectedHash;
  if (!valid) throw new Error(`Approved Block 6A synthetic ${label} was not supplied.`);
}
