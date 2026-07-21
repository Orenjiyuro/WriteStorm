import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { MessageEvent as ElectronMessageEvent } from 'electron';
import {
  CODEX_FEASIBILITY_PROTOCOL_VERSION,
  isCodexFeasibilityRequest,
  type CodexAuthClassification,
  type CodexCapabilityProbeInput,
  type CodexCapabilityProbeOutcome,
  type CodexCapabilityProbeResult,
  type CodexFeasibilityResponse,
  type CodexFeasibilityUtilityErrorCode,
  type CodexLifecycleProbeInput,
  type CodexLifecycleProbeResult,
  type CodexLifecycleTrigger,
  type CodexOutputSchemaProbeInput,
  type CodexOutputSchemaProbeResult,
  type CodexRuntimeInspection,
} from './protocol';
import { buildCodexCliEnvironment } from './environment';
import { CODEX_FEASIBILITY_OPERATIONS } from './operations';
import { validateMinimalStructuredOutput } from './structured-output';
import {
  classifyCodexTurnRuntimeFailureOrigin,
  resolveCodexFeasibilityTurnDeadlineMs,
  settleCodexTurnWithinDeadline,
} from './turn-deadline';

export { buildCodexCliEnvironment } from './environment';

type PackageManifest = { readonly name?: string; readonly version: string };
type CodexWithResolvedExecutable = { readonly exec?: { readonly executablePath?: unknown } };
type FailureClassification = {
  readonly outcome: Exclude<CodexCapabilityProbeOutcome, 'success'>;
  readonly authClassification: Exclude<CodexAuthClassification, 'authenticated'>;
  readonly safeFailureCode: 'SDK_RUNTIME_UNAVAILABLE';
};
type LifecycleSettlement = Omit<CodexLifecycleProbeResult, 'scenario' | 'trigger' | 'abortRequested'>;
type ActiveLifecycleProbe = {
  readonly scenario: CodexLifecycleProbeInput['scenario'];
  readonly controller: AbortController;
  readonly settlement: Promise<LifecycleSettlement>;
};
type ActiveSdkProbe = {
  readonly controller: AbortController;
  readonly settlement: Promise<{ readonly abortObserved: boolean }>;
};

let activeLifecycleProbe: ActiveLifecycleProbe | undefined;
let activeSdkProbe: ActiveSdkProbe | undefined;

const packageByTarget = {
  'win32-x64': '@openai/codex-win32-x64',
  'win32-arm64': '@openai/codex-win32-arm64',
  'darwin-x64': '@openai/codex-darwin-x64',
  'darwin-arm64': '@openai/codex-darwin-arm64',
  'linux-x64': '@openai/codex-linux-x64',
  'linux-arm64': '@openai/codex-linux-arm64',
} as const;
const windowsPackagedCodexRelativePath = path.join(
  'app.asar.unpacked',
  'node_modules',
  '@openai',
  'codex-win32-x64',
  'vendor',
  'x86_64-pc-windows-msvc',
  'bin',
  'codex.exe',
);
const PINNED_CODEX_SDK_FEASIBILITY_VERSION = '0.144.6';
const utilityModuleAnchor = resolveUtilityModuleAnchor();
const utilityModuleRequire = createRequire(utilityModuleAnchor);

export function resolveUtilityModuleAnchor(
  commonJsFilename: string | null | undefined = typeof __filename === 'string'
    ? __filename
    : undefined,
  workingDirectory: string = process.cwd(),
): string {
  return commonJsFilename ?? path.join(workingDirectory, 'package.json');
}

async function inspectInstalledRuntime(): Promise<
  | { readonly ok: true; readonly result: CodexRuntimeInspection }
  | { readonly ok: false; readonly code: CodexFeasibilityUtilityErrorCode }
> {
  let Codex: (typeof import('@openai/codex-sdk'))['Codex'];
  try {
    ({ Codex } = await import('@openai/codex-sdk'));
  } catch {
    return { ok: false, code: 'SDK_IMPORT_FAILED' };
  }

  const packageName = packageByTarget[`${process.platform}-${process.arch}` as keyof typeof packageByTarget];
  if (!packageName) return { ok: false, code: 'UNSUPPORTED_PLATFORM' };

  let client: InstanceType<typeof Codex>;
  try {
    const codexPathOverride = resolvePackagedCodexPath(process.resourcesPath);
    client = new Codex(codexPathOverride ? { codexPathOverride } : undefined);
  } catch {
    return { ok: false, code: 'SDK_CONSTRUCT_FAILED' };
  }

  const sdkPackagePath = resolvePackageManifestPath('@openai/codex-sdk');
  if (!sdkPackagePath) return { ok: false, code: 'SDK_PACKAGE_MANIFEST_UNRESOLVED' };
  const cliPackagePath = resolvePackageManifestPath('@openai/codex');
  if (!cliPackagePath) return { ok: false, code: 'CLI_PACKAGE_MANIFEST_UNRESOLVED' };
  const platformPackagePath = resolvePackageManifestPath(packageName);
  if (!platformPackagePath) return { ok: false, code: 'PLATFORM_PACKAGE_MANIFEST_UNRESOLVED' };

  const platformPackageRoot = path.dirname(platformPackagePath);
  const executablePath = (client as unknown as CodexWithResolvedExecutable).exec?.executablePath;
  if (typeof executablePath !== 'string') {
    return { ok: false, code: 'PROJECT_LOCAL_CLI_PATH_MISSING' };
  }
  if (!isFile(executablePath)) {
    return { ok: false, code: 'PROJECT_LOCAL_CLI_FILE_MISSING' };
  }
  if (!isInsideProjectPlatformPackage(executablePath, platformPackageRoot)) {
    return { ok: false, code: 'PROJECT_LOCAL_CLI_OUTSIDE_PACKAGE' };
  }

  try {
    return {
      ok: true,
      result: {
        sdkVersion: readManifest(sdkPackagePath).version,
        cliVersion: readManifest(cliPackagePath).version,
        platformPackageVersion: readManifest(platformPackagePath).version,
        nodeRuntime: process.versions.node,
        platform: process.platform,
        architecture: process.arch,
        sdkImported: true,
        sdkClientConstructed: true,
        projectLocalCliResolved: true,
      },
    };
  } catch {
    return { ok: false, code: 'PACKAGE_MANIFEST_READ_FAILED' };
  }
}

async function runCapabilityProbe(input: CodexCapabilityProbeInput): Promise<
  | { readonly ok: true; readonly result: CodexCapabilityProbeResult }
  | { readonly ok: false; readonly code: CodexFeasibilityUtilityErrorCode }
> {
  const syntheticInput = process.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
  const expectedResponse = process.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED;
  if (!syntheticInput || !expectedResponse) {
    return { ok: false, code: 'SYNTHETIC_INPUT_MISSING' };
  }

  let Codex: (typeof import('@openai/codex-sdk'))['Codex'];
  try {
    ({ Codex } = await import('@openai/codex-sdk'));
  } catch {
    return { ok: false, code: 'SDK_IMPORT_FAILED' };
  }

  let client: InstanceType<typeof Codex>;
  try {
    const codexPathOverride = resolvePackagedCodexPath(process.resourcesPath);
    client = new Codex({
      ...(codexPathOverride ? { codexPathOverride } : {}),
      env: buildCodexCliEnvironment(process.env, {
        authMode: input.authMode,
        isolatedCodexHome: input.isolatedCodexHome,
      }),
    });
  } catch {
    return { ok: false, code: 'SDK_CONSTRUCT_FAILED' };
  }

  const resultBase = {
    scenario: input.scenario,
    utilityCwdMatchedExpected: pathsEqual(process.cwd(), input.expectedUtilityWorkingDirectory),
    explicitWorkingDirectoryRequested: input.workingDirectory !== undefined,
    skipGitRepoCheck: input.skipGitRepoCheck,
    envPolicy: 'explicit_allowlist_no_api_credentials' as const,
  };

  try {
    const thread = client.startThread({
      workingDirectory: input.workingDirectory,
      skipGitRepoCheck: input.skipGitRepoCheck,
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchMode: 'disabled',
    });
    const controller = new AbortController();
    const turnPromise = thread.run(syntheticInput, { signal: controller.signal });
    const active = registerActiveSdkProbe(controller, turnPromise.then(
      () => ({ abortObserved: false }),
      (error: unknown) => Promise.reject(error),
    ));
    const turn = await settleCodexTurnWithinDeadline(
      controller,
      turnPromise,
      resolveCodexFeasibilityTurnDeadlineMs(input.authMode),
    ).finally(() => clearActiveSdkProbe(active));
    return {
      ok: true,
      result: {
        ...resultBase,
        outcome: 'success',
        authClassification: 'authenticated',
        runtimeFailureOrigin: null,
        safeFailureCode: null,
        finalResponseMatched: validateMinimalStructuredOutput(
          turn.finalResponse,
          expectedResponse,
        ).accepted,
      },
    };
  } catch (error) {
    const classification = classifyCodexFailure(error);
    return {
      ok: true,
      result: {
        ...resultBase,
        ...classification,
        runtimeFailureOrigin: classifyCodexTurnRuntimeFailureOrigin(error),
        finalResponseMatched: null,
      },
    };
  }
}

async function runOutputSchemaProbe(input: CodexOutputSchemaProbeInput): Promise<
  | { readonly ok: true; readonly result: CodexOutputSchemaProbeResult }
  | { readonly ok: false; readonly code: CodexFeasibilityUtilityErrorCode }
> {
  const syntheticInput = process.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
  const expectedResponse = process.env.WRITESTORM_CODEX_SYNTHETIC_EXPECTED;
  if (!syntheticInput || !expectedResponse) {
    return { ok: false, code: 'SYNTHETIC_INPUT_MISSING' };
  }

  let Codex: (typeof import('@openai/codex-sdk'))['Codex'];
  try {
    ({ Codex } = await import('@openai/codex-sdk'));
  } catch {
    return { ok: false, code: 'SDK_IMPORT_FAILED' };
  }

  let client: InstanceType<typeof Codex>;
  try {
    const codexPathOverride = resolvePackagedCodexPath(process.resourcesPath);
    client = new Codex({
      ...(codexPathOverride ? { codexPathOverride } : {}),
      env: buildCodexCliEnvironment(process.env, { authMode: 'current' }),
    });
  } catch {
    return { ok: false, code: 'SDK_CONSTRUCT_FAILED' };
  }

  const outputSchema: unknown = input.scenario === 'valid-minimal'
    ? {
        type: 'object',
        properties: { status: { type: 'string', enum: [expectedResponse] } },
        required: ['status'],
        additionalProperties: false,
      }
    : [];
  const installedSdkVersion = resolveInstalledCodexSdkVersion();
  const thread = client.startThread({
    workingDirectory: input.workingDirectory,
    skipGitRepoCheck: false,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });

  try {
    const controller = new AbortController();
    const turnPromise = thread.run(syntheticInput, { outputSchema, signal: controller.signal });
    const active = registerActiveSdkProbe(controller, turnPromise.then(
      () => ({ abortObserved: false }),
      (error: unknown) => Promise.reject(error),
    ));
    const turn = await settleCodexTurnWithinDeadline(
      controller,
      turnPromise,
      resolveCodexFeasibilityTurnDeadlineMs('current'),
    ).finally(() => clearActiveSdkProbe(active));
    if (input.scenario === 'invalid-schema') {
      return {
        ok: true,
        result: {
          scenario: input.scenario,
          outcome: 'invalid_schema_not_rejected',
          authClassification: 'unverified',
          runtimeFailureOrigin: null,
          safeFailureCode: null,
          finalJsonParsed: null,
          strictValidatorAccepted: null,
          expectedValueMatched: null,
          invalidSchemaRejectedBySdk: false,
        },
      };
    }
    const validation = validateMinimalStructuredOutput(turn.finalResponse, expectedResponse);
    return {
      ok: true,
      result: {
        scenario: input.scenario,
        outcome: validation.accepted ? 'success' : 'output_validation_failed',
        authClassification: 'authenticated',
        runtimeFailureOrigin: null,
        safeFailureCode: null,
        finalJsonParsed: validation.classification !== 'invalid_json',
        strictValidatorAccepted: validation.accepted,
        expectedValueMatched: validation.expectedValueMatched,
        invalidSchemaRejectedBySdk: false,
      },
    };
  } catch (error) {
    if (isPinnedSdkLocalOutputSchemaGuardProbe(
      input.scenario,
      outputSchema,
      installedSdkVersion,
    )) {
      return {
        ok: true,
        result: {
          scenario: input.scenario,
          outcome: 'invalid_schema_rejected',
          authClassification: 'unverified',
          runtimeFailureOrigin: null,
          safeFailureCode: null,
          finalJsonParsed: null,
          strictValidatorAccepted: null,
          expectedValueMatched: null,
          invalidSchemaRejectedBySdk: true,
        },
      };
    }
    const classification = classifyCodexFailure(error);
    return {
      ok: true,
      result: {
        scenario: input.scenario,
        outcome: classification.outcome === 'git_repo_required'
          ? 'runtime_failed'
          : classification.outcome,
        authClassification: classification.authClassification,
        runtimeFailureOrigin: classifyCodexTurnRuntimeFailureOrigin(error),
        safeFailureCode: classification.safeFailureCode,
        finalJsonParsed: null,
        strictValidatorAccepted: null,
        expectedValueMatched: null,
        invalidSchemaRejectedBySdk: false,
      },
    };
  }
}

async function startLifecycleProbe(input: CodexLifecycleProbeInput): Promise<
  | { readonly ok: true; readonly result: { readonly scenario: CodexLifecycleProbeInput['scenario']; readonly turnStarted: true } }
  | { readonly ok: false; readonly code: CodexFeasibilityUtilityErrorCode }
> {
  if (activeLifecycleProbe) return { ok: false, code: 'LIFECYCLE_ALREADY_ACTIVE' };
  const syntheticInput = process.env.WRITESTORM_CODEX_SYNTHETIC_INPUT;
  if (!syntheticInput) return { ok: false, code: 'SYNTHETIC_INPUT_MISSING' };

  let Codex: (typeof import('@openai/codex-sdk'))['Codex'];
  try {
    ({ Codex } = await import('@openai/codex-sdk'));
  } catch {
    return { ok: false, code: 'SDK_IMPORT_FAILED' };
  }

  let client: InstanceType<typeof Codex>;
  try {
    const codexPathOverride = resolvePackagedCodexPath(process.resourcesPath);
    client = new Codex({
      ...(codexPathOverride ? { codexPathOverride } : {}),
      env: buildCodexCliEnvironment(process.env, { authMode: 'current' }),
    });
  } catch {
    return { ok: false, code: 'SDK_CONSTRUCT_FAILED' };
  }

  const controller = new AbortController();
  const thread = client.startThread({
    workingDirectory: input.workingDirectory,
    skipGitRepoCheck: false,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });
  const settlement: Promise<LifecycleSettlement> = thread.run(
    syntheticInput,
    { signal: controller.signal },
  ).then(
    (): LifecycleSettlement => ({
      outcome: 'completed_before_abort',
      authClassification: 'authenticated',
      abortObserved: false,
      sdkPromiseSettled: true,
    }),
    (error: unknown): LifecycleSettlement => {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          outcome: 'aborted',
          authClassification: 'unverified',
          abortObserved: true,
          sdkPromiseSettled: true,
        };
      }
      const classification = classifyCodexFailure(error);
      return {
        outcome: classification.outcome === 'git_repo_required'
          ? 'runtime_failed'
          : classification.outcome,
        authClassification: classification.authClassification,
        abortObserved: false,
        sdkPromiseSettled: true,
      };
    },
  );
  activeLifecycleProbe = { scenario: input.scenario, controller, settlement };
  registerActiveSdkProbe(controller, settlement.then((result) => ({
    abortObserved: result.abortObserved,
  })));
  return { ok: true, result: { scenario: input.scenario, turnStarted: true } };
}

async function cancelLifecycleProbe(trigger: CodexLifecycleTrigger): Promise<
  | { readonly ok: true; readonly result: CodexLifecycleProbeResult }
  | { readonly ok: false; readonly code: CodexFeasibilityUtilityErrorCode }
> {
  const active = activeLifecycleProbe;
  if (!active) return { ok: false, code: 'LIFECYCLE_NOT_ACTIVE' };
  active.controller.abort();
  const settlement = await active.settlement;
  activeLifecycleProbe = undefined;
  activeSdkProbe = undefined;
  return {
    ok: true,
    result: {
      scenario: active.scenario,
      trigger,
      abortRequested: true,
      ...settlement,
    },
  };
}

async function cancelActiveSdkProbe(): Promise<{
  readonly abortRequested: boolean;
  readonly abortObserved: boolean;
  readonly sdkPromiseSettled: true;
}> {
  const active = activeSdkProbe;
  if (!active) return { abortRequested: false, abortObserved: false, sdkPromiseSettled: true };
  active.controller.abort();
  const settlement = await active.settlement;
  if (activeSdkProbe === active) activeSdkProbe = undefined;
  activeLifecycleProbe = undefined;
  return { abortRequested: true, abortObserved: settlement.abortObserved, sdkPromiseSettled: true };
}

function registerActiveSdkProbe(
  controller: AbortController,
  turn: Promise<{ readonly abortObserved: boolean }>,
): ActiveSdkProbe {
  const active = {
    controller,
    settlement: turn.then(
      (result) => result,
      (error: unknown) => ({ abortObserved: error instanceof Error && error.name === 'AbortError' }),
    ),
  };
  activeSdkProbe = active;
  return active;
}

function clearActiveSdkProbe(active: ActiveSdkProbe): void {
  if (activeSdkProbe === active) activeSdkProbe = undefined;
}

export function classifyCodexFailure(_error: unknown): FailureClassification {
  return {
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    safeFailureCode: 'SDK_RUNTIME_UNAVAILABLE',
  };
}

export function isPinnedSdkLocalOutputSchemaGuardProbe(
  scenario: CodexOutputSchemaProbeInput['scenario'],
  outputSchema: unknown,
  installedSdkVersion: string | undefined,
): boolean {
  return installedSdkVersion === PINNED_CODEX_SDK_FEASIBILITY_VERSION
    && scenario === 'invalid-schema'
    && Array.isArray(outputSchema);
}

export function resolveInstalledCodexSdkVersion(): string | undefined {
  const sdkPackagePath = resolvePackageManifestPath('@openai/codex-sdk');
  return sdkPackagePath ? readManifest(sdkPackagePath).version : undefined;
}

export function resolvePackageManifestPath(
  packageName: string,
  moduleAnchor: string = utilityModuleAnchor,
): string | undefined {
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) return undefined;
  const projectRoot = resolveWriteStormPackageRoot(moduleAnchor);
  if (!projectRoot) return undefined;
  const manifestPath = path.join(projectRoot, 'node_modules', ...packageName.split('/'), 'package.json');
  try {
    return readManifest(manifestPath).name === packageName ? manifestPath : undefined;
  } catch {
    return undefined;
  }
}

function resolveWriteStormPackageRoot(moduleAnchor: string): string | undefined {
  let directory = path.dirname(moduleAnchor);
  while (true) {
    try {
      if (readManifest(path.join(directory, 'package.json')).name === 'writestorm') return directory;
    } catch {
      // Continue toward the filesystem root without retaining the local read error.
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function pathsEqual(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function readManifest(manifestPath: string): PackageManifest {
  return utilityModuleRequire(manifestPath) as PackageManifest;
}

function isInside(filePath: string, directoryPath: string): boolean {
  const relativePath = path.relative(directoryPath, filePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

export function isInsideProjectPlatformPackage(
  executablePath: string,
  platformPackageRoot: string,
): boolean {
  if (isInside(executablePath, platformPackageRoot)) return true;
  const asarSegment = `${path.sep}app.asar${path.sep}`;
  if (!platformPackageRoot.includes(asarSegment)) return false;
  const unpackedMirrorRoot = platformPackageRoot.replace(
    asarSegment,
    `${path.sep}app.asar.unpacked${path.sep}`,
  );
  return isInside(executablePath, unpackedMirrorRoot);
}

export function resolvePackagedCodexPath(
  resourcesPath: string,
  isFileAtPath: (candidate: string) => boolean = isFile,
): string | undefined {
  if (process.platform !== 'win32') return undefined;
  const candidate = path.join(resourcesPath, windowsPackagedCodexRelativePath);
  return isFileAtPath(candidate) ? candidate : undefined;
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

const parentPort = process.parentPort;
if (parentPort) {
  parentPort.on('message', (event: ElectronMessageEvent) => {
    const request = event.data;
    if (!isCodexFeasibilityRequest(request)) {
      process.exit(28);
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.shutdown.command) {
      void cancelActiveSdkProbe().then(() => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.shutdown.command,
          ok: true,
          utilityPid: process.pid,
          cleanupAcknowledged: true,
        } satisfies CodexFeasibilityResponse);
        setImmediate(() => process.exit(0));
      });
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.cancelActive.command) {
      void cancelActiveSdkProbe().then((result) => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.cancelActive.command,
          ok: true,
          utilityPid: process.pid,
          ...result,
        } satisfies CodexFeasibilityResponse);
      });
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.startLifecycle.command) {
      void startLifecycleProbe(request.input).then((outcome) => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.startLifecycle.command,
          utilityPid: process.pid,
          ...(outcome.ok
            ? { ok: true as const, result: outcome.result }
            : { ok: false as const, error: { code: outcome.code } }),
        } satisfies CodexFeasibilityResponse);
      });
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle.command) {
      void cancelLifecycleProbe(request.trigger).then((outcome) => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle.command,
          utilityPid: process.pid,
          ...(outcome.ok
            ? { ok: true as const, result: outcome.result }
            : { ok: false as const, error: { code: outcome.code } }),
        } satisfies CodexFeasibilityResponse);
      });
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.capability.command) {
      void runCapabilityProbe(request.input).then((outcome) => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.capability.command,
          utilityPid: process.pid,
          ...(outcome.ok
            ? { ok: true as const, result: outcome.result }
            : { ok: false as const, error: { code: outcome.code } }),
        } satisfies CodexFeasibilityResponse);
      });
      return;
    }

    if (request.command === CODEX_FEASIBILITY_OPERATIONS.outputSchema.command) {
      void runOutputSchemaProbe(request.input).then((outcome) => {
        parentPort.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          requestId: request.requestId,
          command: CODEX_FEASIBILITY_OPERATIONS.outputSchema.command,
          utilityPid: process.pid,
          ...(outcome.ok
            ? { ok: true as const, result: outcome.result }
            : { ok: false as const, error: { code: outcome.code } }),
        } satisfies CodexFeasibilityResponse);
      });
      return;
    }

    void inspectInstalledRuntime().then((outcome) => {
      parentPort.postMessage({
        version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
        requestId: request.requestId,
        command: CODEX_FEASIBILITY_OPERATIONS.inspect.command,
        utilityPid: process.pid,
        ...(outcome.ok
          ? { ok: true as const, result: outcome.result }
          : { ok: false as const, error: { code: outcome.code } }),
      } satisfies CodexFeasibilityResponse);
    });
  });
}
