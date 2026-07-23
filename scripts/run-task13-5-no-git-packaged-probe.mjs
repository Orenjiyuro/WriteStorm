import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadBlock6aPublicSyntheticFixture } from './block6a-public-synthetic-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const artifactRoot = path.resolve(root, args.artifactRoot);
const executable = path.join(artifactRoot, 'writestorm.exe');
if (!existsSync(executable)) throw new Error('Packaged executable is missing.');
const gitHead = git(['rev-parse', 'HEAD']).trim();
if (!/^[0-9a-f]{40}$/.test(gitHead)) throw new Error('Git HEAD is invalid.');
if (git(['status', '--porcelain', '--untracked-files=no']).trim()) {
  throw new Error('Tracked worktree must be clean before the packaged probe.');
}

const fixture = loadBlock6aPublicSyntheticFixture(root);
const runId = randomUUID();
const resultRoot = path.join(os.tmpdir(), 'writestorm-task13-5-no-git', runId);
const resultPath = path.join(resultRoot, 'result.json');
const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows';
const safeEnvironment = createSafeEnvironment(systemRoot, {
  WRITESTORM_TASK13_5_NO_GIT_PROBE: '1',
  WRITESTORM_TASK13_5_RUN_ID: runId,
  WRITESTORM_TASK13_5_GIT_HEAD: gitHead,
  WRITESTORM_CODEX_SYNTHETIC_INPUT: fixture.input,
  WRITESTORM_CODEX_SYNTHETIC_EXPECTED: fixture.expected,
});

rmSync(resultRoot, { recursive: true, force: true });
try {
  assertGitUnavailable(safeEnvironment, systemRoot);
  const launched = spawnSync(executable, [], {
    cwd: root,
    env: safeEnvironment,
    windowsHide: true,
    stdio: 'ignore',
    timeout: 180_000,
  });
  if (launched.error || launched.status !== 0) throw new Error('Packaged probe process failed.');
  const result = JSON.parse(readFileSync(resultPath, 'utf8'));
  if (result.classification !== 'windows_packaged_no_global_git_verified'
    || Object.values(result.assertions ?? {}).some((value) => value !== true)) {
    throw new Error('Packaged no-Git evidence was not admitted.');
  }
  const evidence = {
    ...result,
    artifact: {
      writestormExeSha256: hashFile(executable),
      appAsarSha256: hashFile(path.join(artifactRoot, 'resources', 'app.asar')),
      codexExeSha256: hashFile(path.join(
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
      )),
    },
    compatibilityFingerprint: createFingerprint(gitHead),
    invocation: {
      command: 'node scripts/run-task13-5-no-git-packaged-probe.mjs --artifact-root <artifact> --evidence-output <evidence>',
      outerWhereGitUnavailable: true,
      outerGetCommandGitUnavailable: true,
      pathPolicy: 'windows-system-only-no-git-directories',
    },
  };
  const evidencePath = path.resolve(root, args.evidenceOutput);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${evidencePath}\n`);
} finally {
  rmSync(resultRoot, { recursive: true, force: true });
}

function createSafeEnvironment(systemRoot, additions) {
  const keys = [
    'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CODEX_HOME', 'TEMP', 'TMP',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
  ];
  const environment = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    ComSpec: path.join(systemRoot, 'System32', 'cmd.exe'),
    PATH: createNoGitPath(systemRoot),
    ...additions,
  };
  for (const key of keys) if (process.env[key]) environment[key] = process.env[key];
  return environment;
}

function createNoGitPath(systemRoot) {
  return [
    path.join(systemRoot, 'System32'),
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0'),
    systemRoot,
  ].join(path.delimiter);
}

function assertGitUnavailable(environment, systemRoot) {
  const where = spawnSync(path.join(systemRoot, 'System32', 'where.exe'), ['git'], {
    env: environment, windowsHide: true, stdio: 'ignore',
  });
  const getCommand = spawnSync(
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-Command git -ErrorAction Stop | Out-Null'],
    { env: environment, windowsHide: true, stdio: 'ignore' },
  );
  if (where.error || where.status !== 1 || getCommand.error || getCommand.status !== 1) {
    throw new Error('Git remained resolvable in the packaged probe environment.');
  }
}

function createFingerprint(gitHead) {
  const files = [
    'package.json', 'package-lock.json', 'forge.block6a-certification.config.ts',
    'vite.codex-feasibility.config.ts',
    'src/main/codex-feasibility/protocol.ts',
    'src/main/codex-feasibility/runner.ts',
    'src/main/codex-feasibility/utility-entry.ts',
    'src/main/codex-feasibility/task13-no-git-packaged-probe.ts',
    'src/main/ai/providers/codex/codex-scratch-workspace.ts',
  ];
  const entries = files.map((relativePath) => ({
    relativePath,
    sha256: hashFile(path.join(root, relativePath)),
  }));
  return {
    gitHead,
    files: entries,
    sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  };
}

function hashFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function git(arguments_) {
  const result = spawnSync('git', arguments_, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Git command failed before isolation.');
  return result.stdout;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!value) throw new Error('Incomplete Task 13.5 probe arguments.');
    if (key === '--artifact-root') parsed.artifactRoot = value;
    else if (key === '--evidence-output') parsed.evidenceOutput = value;
    else throw new Error('Unknown Task 13.5 probe argument.');
  }
  if (!parsed.artifactRoot || !parsed.evidenceOutput) throw new Error('Required Task 13.5 probe arguments are missing.');
  return parsed;
}
