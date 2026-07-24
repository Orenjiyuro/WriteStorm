import { app, utilityProcess } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  CodexUtilityLauncher,
  type ForkCodexUtilityProcess,
} from '../../src/main/ai/providers/codex/codex-utility-launcher';

const expectedBundlePath = path.resolve(
  process.env.WRITESTORM_BLOCK13_UTILITY_BUNDLE ?? '',
);
const smokeRoot = process.env.WRITESTORM_BLOCK13_UTILITY_SMOKE_ROOT;
const networkObservationPath = process.env.WRITESTORM_BLOCK13_NETWORK_OBSERVATION;
const smokeMode = process.env.WRITESTORM_BLOCK13_UTILITY_SMOKE_MODE;
if (process.env.WRITESTORM_BLOCK13_UTILITY_SMOKE !== '1'
  || (smokeMode !== 'unsupported' && smokeMode !== 'lifecycle_shutdown')
  || !path.isAbsolute(expectedBundlePath)
  || !smokeRoot
  || !path.isAbsolute(smokeRoot)
  || !networkObservationPath
  || !path.isAbsolute(networkObservationPath)) {
  process.exit(70);
}
mkdirSync(smokeRoot, { recursive: true });
const stagePath = path.join(smokeRoot, 'stage.json');
recordStage('main_loaded');
app.disableHardwareAcceleration();
app.setPath('userData', smokeRoot);
const appReadyTimeout = setTimeout(() => {
  recordStage('app_ready_timeout');
  process.exit(74);
}, 15_000);

app.whenReady().then(() => {
  clearTimeout(appReadyTimeout);
  recordStage('app_ready');
  let exactBundleResolved = false;
  let settled = false;
  let utilityStderr = '';
  const fork = ((modulePath, args, options) => {
    exactBundleResolved = path.resolve(modulePath) === expectedBundlePath;
    const utility = utilityProcess.fork(modulePath, [...args], {
      ...options,
      env: {
        ...options.env,
        WRITESTORM_BLOCK13_NETWORK_OBSERVATION: networkObservationPath,
      },
    });
    utility.stderr?.on('data', (chunk) => {
      utilityStderr = `${utilityStderr}${String(chunk)}`.slice(-4_000);
    });
    return utility;
  }) as ForkCodexUtilityProcess;
  const launcher = new CodexUtilityLauncher({
    mainBundleDirectory: path.dirname(expectedBundlePath),
    fork,
  });
  if (smokeMode === 'lifecycle_shutdown') {
    runLifecycleShutdownSmoke(launcher, () => exactBundleResolved);
    return;
  }
  const child = launcher.launch();
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill();
    process.exit(71);
  }, 15_000);

  child.on('spawn', () => {
    recordStage('utility_spawned');
    child.postMessage({ kind: 'unsupported-offline-smoke' });
    recordStage('unsupported_message_sent');
  });
  child.on('exit', (code) => {
    recordStage(
      `utility_exited_${String(code)}_${classifyUtilityFailure(utilityStderr)}`,
      sanitizeUtilityDiagnostic(utilityStderr),
    );
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (!exactBundleResolved || code !== 28) {
      process.exit(72);
      return;
    }
    process.stdout.write(`${JSON.stringify({
      exactBundleResolved,
      sdkExportImported: true,
      unsupportedMessageExitCode: code,
    })}\n`);
    app.exit(0);
  });
}).catch(() => {
  recordStage('app_ready_rejected');
  process.exit(73);
});

function recordStage(stage: string, diagnostic?: string): void {
  writeFileSync(stagePath, `${JSON.stringify({
    stage,
    ...(diagnostic ? { diagnostic } : {}),
  })}\n`, 'utf8');
}

function classifyUtilityFailure(stderr: string): string {
  if (!stderr) return 'no_stderr';
  if (/cannot find (?:module|package).*@openai[\\/]codex-sdk/i.test(stderr)) {
    return 'sdk_module_unresolved';
  }
  if (/ERR_REQUIRE_ESM|require\(\) of ES Module/i.test(stderr)) {
    return 'sdk_esm_cjs_mismatch';
  }
  return 'utility_runtime_error';
}

function sanitizeUtilityDiagnostic(stderr: string): string {
  return stderr
    .replaceAll(path.dirname(expectedBundlePath), '<bundle>')
    .replaceAll(smokeRoot!, '<temporary>')
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/gi, '<user>')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500);
}

function runLifecycleShutdownSmoke(
  launcher: CodexUtilityLauncher,
  exactBundleResolved: () => boolean,
): void {
  const token = { attempt: 1, generation: 1 } as const;
  const child = launcher.launch();
  let acknowledged = false;
  let settled = false;
  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill();
    process.exit(75);
  }, 15_000);
  child.on('spawn', () => {
    recordStage('lifecycle_utility_spawned');
    child.postMessage({
      version: 1,
      origin: 'main',
      type: 'ai.shutdown',
      token,
    });
  });
  child.on('message', (message) => {
    acknowledged = isLifecycleShutdownAcknowledgement(message, token);
  });
  child.on('exit', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (!acknowledged || code !== 0) {
      process.exit(76);
      return;
    }
    process.stdout.write(`${JSON.stringify({
      exactBundleResolved: exactBundleResolved(),
      sdkExportImported: true,
      lifecycleShutdownAcknowledged: true,
      lifecycleExitCode: code,
    })}\n`);
    app.exit(0);
  });
}

function isLifecycleShutdownAcknowledgement(
  value: unknown,
  token: { readonly attempt: number; readonly generation: number },
): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const receivedToken = record.token as Record<string, unknown> | undefined;
  return record.version === 1
    && record.origin === 'utility'
    && record.type === 'ai.shutdown-result'
    && record.cleanupAcknowledged === true
    && receivedToken?.attempt === token.attempt
    && receivedToken.generation === token.generation;
}
