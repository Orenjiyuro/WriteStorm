import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AiRuntimeCleanupObservation } from '../../ai-attempt-lifecycle';
import type { AiAttemptToken } from '../../ai-execution-port';
import { CodexUtilityCleanupController } from './codex-utility-cleanup';
import {
  CodexUtilityLauncher,
  type ForkCodexUtilityProcess,
} from './codex-utility-launcher';
import { CodexUtilityProcessCleanupDriver } from './codex-utility-process-cleanup-driver';
import {
  isCodexProductProbeResponse,
  type CodexProductProbeResultResponse,
  type CodexProductProbeScenario,
} from './codex-product-probe-protocol';
import { resolvePackagedCodexExecutablePath } from './codex-product-runtime-path';
import { CodexWindowsProcessGuard } from './codex-windows-process-guard';

export const CODEX_PRODUCT_PACKAGED_PROBE_TRIGGER =
  'WRITESTORM_TASK13_11_PRODUCT_PROBE';
export const CODEX_PRODUCT_PACKAGED_PROBE_RUN_ID =
  'WRITESTORM_TASK13_11_RUN_ID';

export type CodexProductProbeGateResult =
  | {
    readonly accepted: false;
    readonly reason: 'disabled' | 'not_packaged' | 'unsupported_platform' | 'invalid_run_id';
  }
  | {
    readonly accepted: true;
    readonly reason: 'accepted';
    readonly runId: string;
  };

const preparedOutputTargetBrand: unique symbol = Symbol('codexProductProbeOutputTarget');
export type CodexProductProbeOutputTarget = Readonly<{
  readonly [preparedOutputTargetBrand]: true;
  readonly resultPath: string;
  readonly temporaryRoot: string;
  readonly baseDirectory: string;
  readonly runDirectory: string;
  readonly device: number;
  readonly inode: number;
}>;

export type CodexProductPackagedScenarioResult = {
  readonly scenario: CodexProductProbeScenario;
  readonly sessionOrdinal: number;
  readonly outcome: 'success' | 'aborted' | 'runtime_unavailable';
  readonly assertions: {
    readonly sdkImported: boolean;
    readonly clientConstructed: boolean;
    readonly scratchInsideOsTemp: boolean;
    readonly nonGitWorkspace: boolean;
    readonly skipGitRepoCheck: boolean;
    readonly environmentAllowlisted: boolean;
    readonly finalJsonParsed: boolean;
    readonly strictValidatorAccepted: boolean;
    readonly expectedValueMatched: boolean;
    readonly abortRequested: boolean;
    readonly abortObserved: boolean;
    readonly timeoutTriggered: boolean;
    readonly cleanupAcknowledged: boolean;
    readonly utilityExitClean: boolean;
    readonly ownershipObserved: boolean;
    readonly residualScanCompleted: boolean;
    readonly utilityResidualAbsent: boolean;
    readonly cliResidualAbsent: boolean;
    readonly scratchCleanupCompleted: boolean;
  };
};

export type CodexProductPackagedProbeResult = {
  readonly schemaVersion: 1;
  readonly fixtureId: 'block13-product-packaged-probe-v1';
  readonly platformVerdict: 'windows_only_macos_deferred';
  readonly classification:
    | 'windows_product_packaged_runtime_verified'
    | 'windows_product_packaged_runtime_failed';
  readonly versions: {
    readonly electron: string;
    readonly nodeRuntime: string;
    readonly codexSdk: '0.144.6';
    readonly codexCli: '0.144.6';
    readonly platformPackage: '0.144.6-win32-x64';
  };
  readonly scenarios: readonly CodexProductPackagedScenarioResult[];
};

export function evaluateCodexProductPackagedProbeGate(input: {
  readonly trigger: string | undefined;
  readonly runId: string | undefined;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly temporaryDirectory: string;
}): CodexProductProbeGateResult {
  if (input.trigger !== '1') return { accepted: false, reason: 'disabled' };
  if (!input.isPackaged) return { accepted: false, reason: 'not_packaged' };
  if (input.platform !== 'win32' || input.architecture !== 'x64') {
    return { accepted: false, reason: 'unsupported_platform' };
  }
  if (!input.runId || !isUuidV4(input.runId)) {
    return { accepted: false, reason: 'invalid_run_id' };
  }
  return {
    accepted: true,
    reason: 'accepted',
    runId: input.runId,
  };
}

export async function executeCodexProductPackagedProbe(input: {
  readonly runScenario: (
    scenario: CodexProductProbeScenario,
    sessionOrdinal: number,
  ) => Promise<CodexProductPackagedScenarioResult>;
  readonly versions: CodexProductPackagedProbeResult['versions'];
}): Promise<CodexProductPackagedProbeResult> {
  const scenarios: CodexProductPackagedScenarioResult[] = [];
  const orderedScenarios = ['success', 'cancel', 'timeout'] as const;
  for (const [index, scenario] of orderedScenarios.entries()) {
    scenarios.push(await input.runScenario(scenario, index + 1));
  }

  const result: CodexProductPackagedProbeResult = {
    schemaVersion: 1,
    fixtureId: 'block13-product-packaged-probe-v1',
    platformVerdict: 'windows_only_macos_deferred',
    classification: scenarios.every(isPassingScenario)
      ? 'windows_product_packaged_runtime_verified'
      : 'windows_product_packaged_runtime_failed',
    versions: input.versions,
    scenarios,
  };
  return result;
}

export async function runOptionalCodexProductPackagedProbe(input: {
  readonly env: NodeJS.ProcessEnv;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly temporaryDirectory: string;
  readonly mainBundleDirectory: string;
  readonly resourcesPath: string;
  readonly executablePath: string;
  readonly fork: ForkCodexUtilityProcess;
  readonly electronVersion: string;
  readonly nodeRuntimeVersion: string;
  readonly exitApp: (code: number) => void;
}): Promise<boolean> {
  const gate = evaluateCodexProductPackagedProbeGate({
    trigger: input.env[CODEX_PRODUCT_PACKAGED_PROBE_TRIGGER],
    runId: input.env[CODEX_PRODUCT_PACKAGED_PROBE_RUN_ID],
    isPackaged: input.isPackaged,
    platform: input.platform,
    architecture: input.architecture,
    temporaryDirectory: input.temporaryDirectory,
  });
  if (!gate.accepted) return false;
  let outputTarget: CodexProductProbeOutputTarget;
  try {
    outputTarget = prepareCodexProductProbeResultPath({
      temporaryDirectory: input.temporaryDirectory,
      runId: gate.runId,
    });
  } catch {
    input.exitApp(1);
    return true;
  }

  const launcher = new CodexUtilityLauncher({
    mainBundleDirectory: input.mainBundleDirectory,
    fork: input.fork,
  });
  const cliExecutablePath = resolvePackagedCodexExecutablePath(input.resourcesPath);
  const result = await executeCodexProductPackagedProbe({
    runScenario: async (scenario, ordinal) => {
      try {
        return await runCodexProductPackagedScenario({
          scenario,
          sessionOrdinal: ordinal,
          launcher,
          utilityExecutablePath: input.executablePath,
          cliExecutablePath,
        });
      } catch {
        return failedScenario(scenario, ordinal);
      }
    },
    versions: {
      electron: input.electronVersion,
      nodeRuntime: input.nodeRuntimeVersion,
      codexSdk: '0.144.6',
      codexCli: '0.144.6',
      platformPackage: '0.144.6-win32-x64',
    },
  });
  try {
    writeSanitizedResult(outputTarget, result);
  } catch {
    input.exitApp(1);
    return true;
  }
  input.exitApp(
    result.classification === 'windows_product_packaged_runtime_verified' ? 0 : 1,
  );
  return true;
}

export async function runCodexProductPackagedScenario(input: {
  readonly scenario: CodexProductProbeScenario;
  readonly sessionOrdinal: number;
  readonly launcher: Pick<CodexUtilityLauncher, 'launch'>;
  readonly utilityExecutablePath: string;
  readonly cliExecutablePath: string;
  readonly cancelDelayMs?: number;
  readonly timeoutDelayMs?: number;
  readonly cleanupGraceMs?: number;
  readonly resultDeadlineMs?: number;
  readonly createProcessGuard?: (input: {
    readonly utilityExecutablePath: string;
    readonly cliExecutablePath: string;
    readonly observationStartedAt: number;
  }) => Pick<
    CodexWindowsProcessGuard,
    'bindUtility' | 'isUtilityOwnedAndRunning' | 'hasObservedOwnership' | 'scanResiduals'
  >;
}): Promise<CodexProductPackagedScenarioResult> {
  const token: AiAttemptToken = {
    attempt: input.sessionOrdinal,
    generation: input.sessionOrdinal,
  };
  const observationStartedAt = Date.now();
  const child = input.launcher.launch();
  const guard = (input.createProcessGuard ?? ((options) => (
    new CodexWindowsProcessGuard(options)
  )))({
    utilityExecutablePath: input.utilityExecutablePath,
    cliExecutablePath: input.cliExecutablePath,
    observationStartedAt,
  });
  const result = deferred<CodexProductProbeResultResponse>();
  const started = deferred<void>();

  const onSpawn = (): void => {
    if (child.pid === undefined) {
      started.reject(new Error('Codex utility process identifier unavailable.'));
      return;
    }
    guard.bindUtility(child.pid);
    child.postMessage({
      version: 1,
      origin: 'main',
      type: 'ai.product-probe.start',
      token,
      scenario: input.scenario,
      fixtureId: 'block13-product-packaged-probe-v1',
    });
  };
  const onMessage = (message: unknown): void => {
    if (!isCodexProductProbeResponse(message)
      || message.token.attempt !== token.attempt
      || message.token.generation !== token.generation
      || message.scenario !== input.scenario) {
      return;
    }
    if (message.type === 'ai.product-probe.started') {
      started.resolve();
    } else {
      result.resolve(message);
    }
  };
  const onExit = (): void => {
    started.reject(new Error('Codex utility exited before starting.'));
    result.reject(new Error('Codex utility exited before returning a result.'));
  };
  child.on('spawn', onSpawn);
  child.on('message', onMessage);
  child.on('exit', onExit);

  const driver = new CodexUtilityProcessCleanupDriver({
    process: child,
    token,
    isOwnedAndRunning: () => guard.isUtilityOwnedAndRunning(),
    scanResiduals: () => guard.scanResiduals(),
  });
  const cleanup = new CodexUtilityCleanupController({
    driver,
    graceMs: input.cleanupGraceMs ?? 5_000,
  });

  try {
    await within(started.promise, 15_000);
    let cleanupObservation: AiRuntimeCleanupObservation | undefined;
    if (input.scenario === 'cancel') {
      await waitForOwnership(guard, 5_000);
      await delay(input.cancelDelayMs ?? 50);
      cleanupObservation = await cleanup.terminate('explicit_cancel');
    } else if (input.scenario === 'timeout') {
      await waitForOwnership(guard, 5_000);
      await delay(input.timeoutDelayMs ?? 1_000);
      cleanupObservation = await cleanup.terminate('timeout');
    }
    const utilityResult = await within(
      result.promise,
      input.resultDeadlineMs ?? 120_000,
    );
    const shutdown = cleanupObservation
      ? undefined
      : await within(driver.requestShutdown(), input.cleanupGraceMs ?? 5_000);
    const residuals = cleanupObservation
      ? cleanupObservation
      : await within(driver.scanResiduals(), input.cleanupGraceMs ?? 5_000);
    const utilityAssertions = utilityResult.assertions;

    return {
      scenario: input.scenario,
      sessionOrdinal: input.sessionOrdinal,
      outcome: utilityResult.outcome,
      assertions: {
        ...utilityAssertions,
        abortRequested: cleanupObservation?.abortRequested ?? false,
        abortObserved:
          cleanupObservation?.abortObserved ?? utilityAssertions.abortObserved,
        timeoutTriggered: input.scenario === 'timeout',
        cleanupAcknowledged:
          cleanupObservation?.cleanupAcknowledged ?? shutdown?.cleanupAcknowledged ?? false,
        utilityExitClean:
          cleanupObservation?.utilityExitClean ?? shutdown?.utilityExitClean ?? false,
        ownershipObserved: guard.hasObservedOwnership(),
        residualScanCompleted: residuals.residualScanCompleted,
        utilityResidualAbsent: residuals.utilityResidualAbsent,
        cliResidualAbsent: residuals.cliResidualAbsent,
      },
    };
  } catch (error) {
    await cleanup.terminate('failed').catch(() => undefined);
    throw error;
  } finally {
    child.removeListener('spawn', onSpawn);
    child.removeListener('message', onMessage);
    child.removeListener('exit', onExit);
  }
}

function isPassingScenario(result: CodexProductPackagedScenarioResult): boolean {
  const { assertions } = result;
  const common =
    assertions.sdkImported
    && assertions.clientConstructed
    && assertions.scratchInsideOsTemp
    && assertions.nonGitWorkspace
    && assertions.skipGitRepoCheck
    && assertions.environmentAllowlisted
    && assertions.cleanupAcknowledged
    && assertions.utilityExitClean
    && assertions.ownershipObserved
    && assertions.residualScanCompleted
    && assertions.utilityResidualAbsent
    && assertions.cliResidualAbsent
    && assertions.scratchCleanupCompleted;
  if (!common) return false;
  if (result.scenario === 'success') {
    return result.outcome === 'success'
      && assertions.finalJsonParsed
      && assertions.strictValidatorAccepted
      && assertions.expectedValueMatched
      && !assertions.abortRequested
      && !assertions.abortObserved
      && !assertions.timeoutTriggered;
  }
  return result.outcome === 'aborted'
    && assertions.abortRequested
    && assertions.abortObserved
    && assertions.timeoutTriggered === (result.scenario === 'timeout');
}

function writeSanitizedResult(
  outputTarget: CodexProductProbeOutputTarget,
  result: CodexProductPackagedProbeResult,
): void {
  assertOwnedRunDirectory(outputTarget);
  writeFileSync(outputTarget.resultPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

export function prepareCodexProductProbeResultPath(input: {
  readonly temporaryDirectory: string;
  readonly runId: string;
}): CodexProductProbeOutputTarget {
  if (!isUuidV4(input.runId)) throw new Error('Invalid product probe run identifier.');
  const systemTemporaryRoot = canonicalDirectory(os.tmpdir());
  const temporaryRoot = canonicalDirectory(input.temporaryDirectory);
  if (!isInsideOrEqual(systemTemporaryRoot, temporaryRoot)) {
    throw new Error('Product probe output root is outside OS temporary storage.');
  }

  const baseDirectory = path.join(temporaryRoot, 'writestorm-task13-11-product');
  if (!existsSync(baseDirectory)) mkdirSync(baseDirectory);
  assertPlainCanonicalDirectory(baseDirectory, temporaryRoot);

  const runDirectory = path.join(baseDirectory, input.runId);
  mkdirSync(runDirectory);
  const identity = assertPlainCanonicalDirectory(runDirectory, temporaryRoot);
  return Object.freeze({
    [preparedOutputTargetBrand]: true as const,
    resultPath: path.join(runDirectory, 'result.json'),
    temporaryRoot,
    baseDirectory,
    runDirectory,
    device: identity.dev,
    inode: identity.ino,
  });
}

function assertOwnedRunDirectory(target: CodexProductProbeOutputTarget): void {
  assertPlainCanonicalDirectory(target.baseDirectory, target.temporaryRoot);
  const identity = assertPlainCanonicalDirectory(
    target.runDirectory,
    target.temporaryRoot,
  );
  if (identity.dev !== target.device || identity.ino !== target.inode) {
    throw new Error('Product probe output directory identity changed.');
  }
  if (existsSync(target.resultPath)) {
    throw new Error('Product probe output already exists.');
  }
}

function canonicalDirectory(directory: string): string {
  if (!path.isAbsolute(directory)) {
    throw new Error('Product probe output root must be absolute.');
  }
  const lexical = path.resolve(directory);
  const entry = lstatSync(lexical);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error('Product probe output root must be a plain directory.');
  }
  const canonical = realpathSync.native(lexical);
  if (!samePath(lexical, canonical)) {
    throw new Error('Product probe output root traverses a link.');
  }
  return canonical;
}

function assertPlainCanonicalDirectory(
  directory: string,
  temporaryRoot: string,
): { readonly dev: number; readonly ino: number } {
  const lexical = path.resolve(directory);
  const entry = lstatSync(lexical);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error('Product probe output path is not a plain directory.');
  }
  const canonical = realpathSync.native(lexical);
  if (!samePath(lexical, canonical)
    || !isInsideOrEqual(temporaryRoot, canonical)) {
    throw new Error('Product probe output path escaped OS temporary storage.');
  }
  return { dev: entry.dev, ino: entry.ino };
}

function isInsideOrEqual(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function samePath(first: string, second: string): boolean {
  return process.platform === 'win32'
    ? first.toLowerCase() === second.toLowerCase()
    : first === second;
}

function failedScenario(
  scenario: CodexProductProbeScenario,
  sessionOrdinal: number,
): CodexProductPackagedScenarioResult {
  return {
    scenario,
    sessionOrdinal,
    outcome: 'runtime_unavailable',
    assertions: {
      sdkImported: false,
      clientConstructed: false,
      scratchInsideOsTemp: false,
      nonGitWorkspace: false,
      skipGitRepoCheck: false,
      environmentAllowlisted: false,
      finalJsonParsed: false,
      strictValidatorAccepted: false,
      expectedValueMatched: false,
      abortRequested: false,
      abortObserved: false,
      timeoutTriggered: scenario === 'timeout',
      cleanupAcknowledged: false,
      utilityExitClean: false,
      ownershipObserved: false,
      residualScanCompleted: false,
      utilityResidualAbsent: false,
      cliResidualAbsent: false,
      scratchCleanupCompleted: false,
    },
  };
}

async function within<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let handle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        handle = setTimeout(
          () => reject(new Error('Codex product probe operation timed out.')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve, reject };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForOwnership(
  guard: Pick<CodexWindowsProcessGuard, 'hasObservedOwnership'>,
  deadlineMs: number,
): Promise<void> {
  const startedAt = Date.now();
  while (!guard.hasObservedOwnership()) {
    if (Date.now() - startedAt >= deadlineMs) {
      throw new Error('Codex product probe process ownership was not observed.');
    }
    await delay(25);
  }
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
