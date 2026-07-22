import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { build } from 'vite';
import { evaluateBlock6aProbeResults } from './block6a-probe-admission.mjs';
import { loadBlock6aPublicSyntheticFixture } from './block6a-public-synthetic-fixture.mjs';
import {
  createBlock6aLineageSnapshot,
  verifyBlock6aEvidenceLineageAtRepository,
} from './block6a-evidence-lineage.mjs';

const root = process.cwd();
const mode = process.argv[2];
const probeOptions = parseProbeOptions(process.argv.slice(3));
const syntheticFixture = loadBlock6aPublicSyntheticFixture(root);

if (!['dev', 'lifecycle', 'packaged'].includes(mode)) {
  throw new Error('Expected probe mode: dev | lifecycle | packaged.');
}

const runId = randomUUID();
const resultRoot = path.join(os.tmpdir(), 'writestorm-block6a-reproduction', runId);
const packagedArtifactRoot = mode === 'packaged'
  ? probeOptions.artifactRoot
  : undefined;
if (mode === 'packaged' && !packagedArtifactRoot) {
  throw new Error('Packaged mode requires --artifact-root.');
}
const lineage = createBlock6aLineageSnapshot(root, mode, packagedArtifactRoot);
mkdirSync(resultRoot, { recursive: true });

try {
  const results = mode === 'packaged'
    ? [await runPackagedProbe(runId)]
    : await runDevelopmentProbes(mode);
  verifyBlock6aEvidenceLineageAtRepository(lineage, root, packagedArtifactRoot);
  const evaluation = evaluateBlock6aProbeResults(mode, results);
  if (probeOptions.evidenceOutputRoot) {
    persistSanitizedEvidence(results, probeOptions.evidenceOutputRoot);
  }
  process.stdout.write(`${JSON.stringify({ mode, evaluation })}\n`);
  if (!evaluation.recertificationAdmitted) process.exitCode = 1;
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
  const safeEnvironment = createSafeEnvironment({
    WRITESTORM_CODEX_UTILITY_PATH: utilityPath,
    WRITESTORM_CODEX_SOURCE_ROOT: root,
    WRITESTORM_CODEX_CLI_PATH: cliPath,
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
  const executable = path.join(packagedArtifactRoot, 'writestorm.exe');
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

function parseProbeOptions(args) {
  const options = { artifactRoot: undefined, evidenceOutputRoot: undefined };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) throw new Error('Incomplete Block 6A probe option.');
    if (flag === '--artifact-root' && !options.artifactRoot) {
      options.artifactRoot = path.resolve(root, value);
    } else if (flag === '--evidence-output-root' && !options.evidenceOutputRoot) {
      options.evidenceOutputRoot = path.resolve(root, value);
    } else {
      throw new Error('Unknown or duplicate Block 6A probe option.');
    }
  }
  return options;
}

function persistSanitizedEvidence(results, evidenceOutputRoot) {
  mkdirSync(evidenceOutputRoot, { recursive: true });
  for (const result of results) {
    if (!result
      || typeof result !== 'object'
      || typeof result.evidenceId !== 'string'
      || !/^[a-z0-9-]+$/.test(result.evidenceId)) {
      throw new Error('Cannot persist unidentified Block 6A evidence.');
    }
    writeFileSync(path.join(evidenceOutputRoot, `${result.evidenceId}.json`), (
      `${JSON.stringify(result, null, 2)}\n`
    ), { encoding: 'utf8', flag: 'wx' });
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
  environment.WRITESTORM_CODEX_SYNTHETIC_INPUT = syntheticFixture.input;
  environment.WRITESTORM_CODEX_SYNTHETIC_EXPECTED = syntheticFixture.expected;
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
  const boundResult = { ...result, lineage };
  writeFileSync(filePath, `${JSON.stringify(boundResult, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
  });
  return boundResult;
}
