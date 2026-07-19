import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { utilityProcess } from 'electron';
import {
  CODEX_FEASIBILITY_PROTOCOL_VERSION,
  diagnoseCodexFeasibilityResponse,
  isCodexFeasibilityResponse,
  type CodexCapabilityProbeInput,
  type CodexCapabilityProbeResult,
  type CodexFeasibilityRequest,
  type CodexFeasibilityResponseDiagnostic,
  type CodexFeasibilityUtilityErrorCode,
  type CodexLifecycleProbeInput,
  type CodexLifecycleProbeResult,
  type CodexLifecycleTrigger,
  type CodexOutputSchemaProbeInput,
  type CodexOutputSchemaProbeResult,
  type CodexRuntimeInspection,
} from './protocol';

export type CodexFeasibilityUtilityHandle = {
  readonly pid: number | undefined;
  on(event: 'spawn', listener: () => void): unknown;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  removeListener(event: 'spawn', listener: () => void): unknown;
  removeListener(event: 'message', listener: (message: unknown) => void): unknown;
  removeListener(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: unknown): void;
  kill(): boolean;
};

export type ForkCodexFeasibilityUtility = (
  modulePath: string,
  args: string[],
  options: {
    readonly serviceName: string;
    readonly stdio: 'pipe';
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
  },
) => CodexFeasibilityUtilityHandle;

export type CodexFeasibilityRunnerFailureReason =
  | 'timeout'
  | 'crash'
  | 'protocol'
  | 'inspection_failed'
  | 'capability_failed'
  | 'output_schema_failed'
  | 'lifecycle_failed';

export type CodexTimeoutCleanupSummary = {
  readonly classification: 'graceful' | 'forced';
  readonly abortRequested: boolean;
  readonly abortObserved: boolean;
  readonly sdkPromiseSettled: boolean;
  readonly cleanupAcknowledged: boolean;
  readonly utilityExitObserved: boolean;
};

export class CodexFeasibilityRunnerError extends Error {
  readonly code = 'CODEX_FEASIBILITY_UTILITY_FAILED' as const;

  constructor(
    readonly reason: CodexFeasibilityRunnerFailureReason,
    message: string,
    readonly utilityErrorCode?: CodexFeasibilityUtilityErrorCode,
    readonly protocolDiagnostic?: CodexFeasibilityResponseDiagnostic & {
      readonly phase:
        | 'inspect'
        | 'capability'
        | 'output-schema'
        | 'start-lifecycle'
        | 'await-trigger'
        | 'cancel-lifecycle'
        | 'shutdown';
    },
    readonly timeoutCleanup?: CodexTimeoutCleanupSummary,
  ) {
    super(message);
    this.name = 'CodexFeasibilityRunnerError';
  }
}

export type CodexFeasibilityInspectionOutcome = {
  readonly utilityPid: number;
  readonly cleanupAcknowledged: true;
  readonly result: CodexRuntimeInspection;
};

export type CodexFeasibilityCapabilityOutcome = {
  readonly utilityPid: number;
  readonly cleanupAcknowledged: true;
  readonly result: CodexCapabilityProbeResult;
};

export type CodexFeasibilityOutputSchemaOutcome = {
  readonly utilityPid: number;
  readonly cleanupAcknowledged: true;
  readonly result: CodexOutputSchemaProbeResult;
};

export type CodexFeasibilityLifecycleOutcome = {
  readonly utilityPid: number;
  readonly cleanupAcknowledged: true;
  readonly result: CodexLifecycleProbeResult;
};

export class CodexFeasibilityRunner {
  private readonly modulePath: string;
  private readonly fork: ForkCodexFeasibilityUtility;
  private readonly createRequestId: () => string;
  private readonly timeoutGraceMs: number;

  constructor(options: {
    readonly modulePath: string;
    readonly fork?: ForkCodexFeasibilityUtility;
    readonly createRequestId?: () => string;
    readonly timeoutGraceMs?: number;
  }) {
    this.modulePath = options.modulePath;
    this.fork = options.fork ?? electronFork;
    this.createRequestId = options.createRequestId ?? randomUUID;
    this.timeoutGraceMs = options.timeoutGraceMs ?? 5_000;
  }

  inspectRuntime(
    timeoutMs: number,
    options?: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
    },
  ): Promise<CodexFeasibilityInspectionOutcome> {
    const inspectRequestId = this.createRequestId();
    const timeoutCancelRequestId = this.createRequestId();
    const shutdownRequestId = this.createRequestId();
    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Codex Feasibility Utility',
      stdio: 'pipe',
      cwd: options?.utilityWorkingDirectory,
      env: options?.utilityEnvironment,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let phase: 'inspect' | 'shutdown' = 'inspect';
      let inspection: CodexRuntimeInspection | undefined;
      let inspectionFailure: CodexFeasibilityRunnerError | undefined;
      let utilityPid: number | undefined;
      let cleanupAcknowledged = false;
      const timeoutSupervisor = createTimeoutSupervisor({
        child,
        timeoutMs,
        graceMs: this.timeoutGraceMs,
        cancelRequestId: timeoutCancelRequestId,
        shutdownRequestId,
        onFinished: (summary) => fail(runnerFailure('timeout', undefined, summary)),
      });
      const cleanup = (): void => {
        timeoutSupervisor.dispose();
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
      };
      const fail = (error: CodexFeasibilityRunnerError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onSpawn = (): void => {
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: inspectRequestId,
          command: 'inspect-runtime',
        } satisfies CodexFeasibilityRequest);
      };
      const requestShutdown = (): void => {
        phase = 'shutdown';
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: shutdownRequestId,
          command: 'shutdown',
        } satisfies CodexFeasibilityRequest);
      };
      const onMessage = (message: unknown): void => {
        if (timeoutSupervisor.consumeMessage(message)) return;
        if (settled || !isCodexFeasibilityResponse(message)) {
          fail(runnerProtocolFailure(message, phase));
          child.kill();
          return;
        }

        if (utilityPid !== undefined && message.utilityPid !== utilityPid) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        utilityPid = message.utilityPid;

        if (phase === 'inspect') {
          if (message.command !== 'inspect-runtime' || message.requestId !== inspectRequestId) {
            fail(runnerFailure('protocol'));
            child.kill();
            return;
          }
          if (message.ok) {
            inspection = message.result;
          } else {
            inspectionFailure = runnerFailure('inspection_failed', message.error.code);
          }
          requestShutdown();
          return;
        }

        if (message.command !== 'shutdown' || message.requestId !== shutdownRequestId) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        cleanupAcknowledged = message.cleanupAcknowledged;
      };
      const onExit = (code: number): void => {
        if (timeoutSupervisor.consumeExit()) return;
        if (settled) return;
        if (phase !== 'shutdown' || !cleanupAcknowledged || code !== 0) {
          fail(runnerFailure('crash'));
          return;
        }

        if (inspectionFailure) {
          fail(inspectionFailure);
          return;
        }
        if (!inspection || utilityPid === undefined) {
          fail(runnerFailure('protocol'));
          return;
        }
        settled = true;
        cleanup();
        resolve({ utilityPid, cleanupAcknowledged: true, result: inspection });
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
    });
  }

  runCapabilityProbe(
    input: CodexCapabilityProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
    },
  ): Promise<CodexFeasibilityCapabilityOutcome> {
    const capabilityRequestId = this.createRequestId();
    const timeoutCancelRequestId = this.createRequestId();
    const shutdownRequestId = this.createRequestId();
    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Codex Feasibility Utility',
      stdio: 'pipe',
      cwd: options.utilityWorkingDirectory,
      env: options.utilityEnvironment,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let phase: 'capability' | 'shutdown' = 'capability';
      let capabilityResult: CodexCapabilityProbeResult | undefined;
      let capabilityFailure: CodexFeasibilityRunnerError | undefined;
      let utilityPid: number | undefined;
      let cleanupAcknowledged = false;
      const timeoutSupervisor = createTimeoutSupervisor({
        child,
        timeoutMs,
        graceMs: this.timeoutGraceMs,
        cancelRequestId: timeoutCancelRequestId,
        shutdownRequestId,
        onFinished: (summary) => fail(runnerFailure('timeout', undefined, summary)),
      });
      const cleanup = (): void => {
        timeoutSupervisor.dispose();
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
      };
      const fail = (error: CodexFeasibilityRunnerError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onSpawn = (): void => {
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: capabilityRequestId,
          command: 'run-capability-probe',
          input,
        } satisfies CodexFeasibilityRequest);
      };
      const requestShutdown = (): void => {
        phase = 'shutdown';
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: shutdownRequestId,
          command: 'shutdown',
        } satisfies CodexFeasibilityRequest);
      };
      const onMessage = (message: unknown): void => {
        if (timeoutSupervisor.consumeMessage(message)) return;
        if (settled || !isCodexFeasibilityResponse(message)) {
          fail(runnerProtocolFailure(message, phase));
          child.kill();
          return;
        }


        if (utilityPid !== undefined && message.utilityPid !== utilityPid) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        utilityPid = message.utilityPid;

        if (phase === 'capability') {
          if (message.command !== 'run-capability-probe' || message.requestId !== capabilityRequestId) {
            fail(runnerFailure('protocol'));
            child.kill();
            return;
          }
          if (message.ok) {
            capabilityResult = message.result;
          } else {
            capabilityFailure = runnerFailure('capability_failed', message.error.code);
          }
          requestShutdown();
          return;
        }

        if (message.command !== 'shutdown' || message.requestId !== shutdownRequestId) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        cleanupAcknowledged = message.cleanupAcknowledged;
      };
      const onExit = (code: number): void => {
        if (timeoutSupervisor.consumeExit()) return;
        if (settled) return;
        if (phase !== 'shutdown' || !cleanupAcknowledged || code !== 0) {
          fail(runnerFailure('crash'));
          return;
        }
        if (capabilityFailure) {
          fail(capabilityFailure);
          return;
        }
        if (!capabilityResult || utilityPid === undefined) {
          fail(runnerFailure('protocol'));
          return;
        }
        settled = true;
        cleanup();
        resolve({ utilityPid, cleanupAcknowledged: true, result: capabilityResult });
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
    });
  }

  runOutputSchemaProbe(
    input: CodexOutputSchemaProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
    },
  ): Promise<CodexFeasibilityOutputSchemaOutcome> {
    const probeRequestId = this.createRequestId();
    const timeoutCancelRequestId = this.createRequestId();
    const shutdownRequestId = this.createRequestId();
    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Codex Feasibility Utility',
      stdio: 'pipe',
      cwd: options.utilityWorkingDirectory,
      env: options.utilityEnvironment,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let phase: 'output-schema' | 'shutdown' = 'output-schema';
      let probeResult: CodexOutputSchemaProbeResult | undefined;
      let probeFailure: CodexFeasibilityRunnerError | undefined;
      let utilityPid: number | undefined;
      let cleanupAcknowledged = false;
      const timeoutSupervisor = createTimeoutSupervisor({
        child,
        timeoutMs,
        graceMs: this.timeoutGraceMs,
        cancelRequestId: timeoutCancelRequestId,
        shutdownRequestId,
        onFinished: (summary) => fail(runnerFailure('timeout', undefined, summary)),
      });
      const cleanup = (): void => {
        timeoutSupervisor.dispose();
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
      };
      const fail = (error: CodexFeasibilityRunnerError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onSpawn = (): void => {
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: probeRequestId,
          command: 'run-output-schema-probe',
          input,
        } satisfies CodexFeasibilityRequest);
      };
      const requestShutdown = (): void => {
        phase = 'shutdown';
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: shutdownRequestId,
          command: 'shutdown',
        } satisfies CodexFeasibilityRequest);
      };
      const onMessage = (message: unknown): void => {
        if (timeoutSupervisor.consumeMessage(message)) return;
        if (settled || !isCodexFeasibilityResponse(message)) {
          fail(runnerProtocolFailure(message, phase));
          child.kill();
          return;
        }
        if (utilityPid !== undefined && message.utilityPid !== utilityPid) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        utilityPid = message.utilityPid;

        if (phase === 'output-schema') {
          if (message.command !== 'run-output-schema-probe' || message.requestId !== probeRequestId) {
            fail(runnerFailure('protocol'));
            child.kill();
            return;
          }
          if (message.ok) probeResult = message.result;
          else probeFailure = runnerFailure('output_schema_failed', message.error.code);
          requestShutdown();
          return;
        }

        if (message.command !== 'shutdown' || message.requestId !== shutdownRequestId) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        cleanupAcknowledged = message.cleanupAcknowledged;
      };
      const onExit = (code: number): void => {
        if (timeoutSupervisor.consumeExit()) return;
        if (settled) return;
        if (phase !== 'shutdown' || !cleanupAcknowledged || code !== 0) {
          fail(runnerFailure('crash'));
          return;
        }
        if (probeFailure) {
          fail(probeFailure);
          return;
        }
        if (!probeResult || utilityPid === undefined) {
          fail(runnerFailure('protocol'));
          return;
        }
        settled = true;
        cleanup();
        resolve({ utilityPid, cleanupAcknowledged: true, result: probeResult });
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
    });
  }

  runLifecycleProbe(
    input: CodexLifecycleProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
      readonly waitForTrigger: (context: { readonly utilityPid: number }) => Promise<CodexLifecycleTrigger>;
    },
  ): Promise<CodexFeasibilityLifecycleOutcome> {
    const startRequestId = this.createRequestId();
    const cancelRequestId = this.createRequestId();
    const timeoutCancelRequestId = this.createRequestId();
    const shutdownRequestId = this.createRequestId();
    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Codex Feasibility Utility',
      stdio: 'pipe',
      cwd: options.utilityWorkingDirectory,
      env: options.utilityEnvironment,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let phase: 'start-lifecycle' | 'await-trigger' | 'cancel-lifecycle' | 'shutdown' = 'start-lifecycle';
      let lifecycleResult: CodexLifecycleProbeResult | undefined;
      let lifecycleFailure: CodexFeasibilityRunnerError | undefined;
      let utilityPid: number | undefined;
      let cleanupAcknowledged = false;
      const timeoutSupervisor = createTimeoutSupervisor({
        child,
        timeoutMs,
        graceMs: this.timeoutGraceMs,
        cancelRequestId: timeoutCancelRequestId,
        shutdownRequestId,
        onFinished: (summary) => fail(runnerFailure('timeout', undefined, summary)),
      });
      const cleanup = (): void => {
        timeoutSupervisor.dispose();
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
      };
      const fail = (error: CodexFeasibilityRunnerError): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onSpawn = (): void => {
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: startRequestId,
          command: 'start-lifecycle-probe',
          input,
        } satisfies CodexFeasibilityRequest);
      };
      const requestShutdown = (): void => {
        phase = 'shutdown';
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: shutdownRequestId,
          command: 'shutdown',
        } satisfies CodexFeasibilityRequest);
      };
      const requestCancel = (trigger: CodexLifecycleTrigger): void => {
        if (settled || phase !== 'await-trigger') return;
        phase = 'cancel-lifecycle';
        child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: cancelRequestId,
          command: 'cancel-lifecycle-probe',
          trigger,
        } satisfies CodexFeasibilityRequest);
      };
      const onMessage = (message: unknown): void => {
        if (timeoutSupervisor.consumeMessage(message)) return;
        if (settled || !isCodexFeasibilityResponse(message)) {
          fail(runnerProtocolFailure(message, phase));
          child.kill();
          return;
        }
        if (utilityPid !== undefined && message.utilityPid !== utilityPid) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        utilityPid = message.utilityPid;

        if (phase === 'start-lifecycle') {
          if (message.command !== 'start-lifecycle-probe' || message.requestId !== startRequestId) {
            fail(runnerFailure('protocol'));
            child.kill();
            return;
          }
          if (!message.ok) {
            lifecycleFailure = runnerFailure('lifecycle_failed', message.error.code);
            requestShutdown();
            return;
          }
          phase = 'await-trigger';
          void options.waitForTrigger({ utilityPid: message.utilityPid }).then(
            requestCancel,
            () => {
              fail(runnerFailure('lifecycle_failed'));
              child.kill();
            },
          );
          return;
        }

        if (phase === 'cancel-lifecycle') {
          if (message.command !== 'cancel-lifecycle-probe' || message.requestId !== cancelRequestId) {
            fail(runnerFailure('protocol'));
            child.kill();
            return;
          }
          if (message.ok) lifecycleResult = message.result;
          else lifecycleFailure = runnerFailure('lifecycle_failed', message.error.code);
          requestShutdown();
          return;
        }

        if (phase !== 'shutdown' || message.command !== 'shutdown' || message.requestId !== shutdownRequestId) {
          fail(runnerFailure('protocol'));
          child.kill();
          return;
        }
        cleanupAcknowledged = message.cleanupAcknowledged;
      };
      const onExit = (code: number): void => {
        if (timeoutSupervisor.consumeExit()) return;
        if (settled) return;
        if (phase !== 'shutdown' || !cleanupAcknowledged || code !== 0) {
          fail(runnerFailure('crash'));
          return;
        }
        if (lifecycleFailure) {
          fail(lifecycleFailure);
          return;
        }
        if (!lifecycleResult || utilityPid === undefined) {
          fail(runnerFailure('protocol'));
          return;
        }
        settled = true;
        cleanup();
        resolve({ utilityPid, cleanupAcknowledged: true, result: lifecycleResult });
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
    });
  }
}

function createTimeoutSupervisor(options: {
  readonly child: CodexFeasibilityUtilityHandle;
  readonly timeoutMs: number;
  readonly graceMs: number;
  readonly cancelRequestId: string;
  readonly shutdownRequestId: string;
  readonly onFinished: (summary: CodexTimeoutCleanupSummary) => void;
}): {
  consumeMessage(message: unknown): boolean;
  consumeExit(): boolean;
  dispose(): void;
} {
  let active = false;
  let disposed = false;
  let finished = false;
  let forced = false;
  let abortRequested = false;
  let abortObserved = false;
  let sdkPromiseSettled = false;
  let cleanupAcknowledged = false;
  let stage: 'cancel' | 'shutdown' | 'exit' = 'cancel';
  let graceTimer: NodeJS.Timeout | undefined;
  const timeoutTimer = setTimeout(() => {
    if (disposed) return;
    active = true;
    options.child.postMessage({
      version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
      origin: 'main',
      requestId: options.cancelRequestId,
      command: 'cancel-active-probe',
    } satisfies CodexFeasibilityRequest);
    armGraceTimer();
  }, options.timeoutMs);

  const finish = (utilityExitObserved: boolean): void => {
    if (finished) return;
    finished = true;
    active = false;
    clearTimeout(timeoutTimer);
    if (graceTimer) clearTimeout(graceTimer);
    options.onFinished({
      classification: forced ? 'forced' : 'graceful',
      abortRequested,
      abortObserved,
      sdkPromiseSettled,
      cleanupAcknowledged,
      utilityExitObserved,
    });
  };
  const forceUtilityExit = (): void => {
    if (forced || finished) return;
    forced = true;
    stage = 'exit';
    options.child.kill();
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(() => finish(false), options.graceMs);
  };
  function armGraceTimer(): void {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(forceUtilityExit, options.graceMs);
  }

  return {
    consumeMessage(message) {
      if (!active) return false;
      if (!isCodexFeasibilityResponse(message)) {
        forceUtilityExit();
        return true;
      }
      if (stage === 'cancel'
        && message.command === 'cancel-active-probe'
        && message.requestId === options.cancelRequestId) {
        abortRequested = message.abortRequested;
        abortObserved = message.abortObserved;
        sdkPromiseSettled = message.sdkPromiseSettled;
        stage = 'shutdown';
        options.child.postMessage({
          version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
          origin: 'main',
          requestId: options.shutdownRequestId,
          command: 'shutdown',
        } satisfies CodexFeasibilityRequest);
        armGraceTimer();
        return true;
      }
      if (stage === 'shutdown'
        && message.command === 'shutdown'
        && message.requestId === options.shutdownRequestId) {
        cleanupAcknowledged = message.cleanupAcknowledged;
        stage = 'exit';
        armGraceTimer();
        return true;
      }
      // The aborted operation may publish its normal sanitized response before
      // cancel acknowledgement. Timeout supervision owns and discards it.
      return true;
    },
    consumeExit() {
      if (!active) return false;
      finish(true);
      return true;
    },
    dispose() {
      disposed = true;
      clearTimeout(timeoutTimer);
      if (graceTimer) clearTimeout(graceTimer);
    },
  };
}

function runnerFailure(
  reason: CodexFeasibilityRunnerFailureReason,
  utilityErrorCode?: CodexFeasibilityUtilityErrorCode,
  timeoutCleanup?: CodexTimeoutCleanupSummary,
): CodexFeasibilityRunnerError {
  const messages = {
    timeout: 'Codex feasibility utility timed out.',
    crash: 'Codex feasibility utility exited before graceful cleanup.',
    protocol: 'Codex feasibility utility returned an invalid response.',
    inspection_failed: 'Codex feasibility utility could not inspect the installed runtime.',
    capability_failed: 'Codex feasibility utility could not run the capability probe.',
    output_schema_failed: 'Codex feasibility utility could not run the output schema probe.',
    lifecycle_failed: 'Codex feasibility utility could not run the lifecycle probe.',
  } as const;
  return new CodexFeasibilityRunnerError(
    reason,
    messages[reason],
    utilityErrorCode,
    undefined,
    timeoutCleanup,
  );
}

function runnerProtocolFailure(
  message: unknown,
  phase:
    | 'inspect'
    | 'capability'
    | 'output-schema'
    | 'start-lifecycle'
    | 'await-trigger'
    | 'cancel-lifecycle'
    | 'shutdown',
): CodexFeasibilityRunnerError {
  return new CodexFeasibilityRunnerError(
    'protocol',
    'Codex feasibility utility returned an invalid response.',
    undefined,
    { phase, ...diagnoseCodexFeasibilityResponse(message) },
  );
}

export function resolveCodexFeasibilityUtilityPath(mainBundleDirectory: string): string {
  return path.join(mainBundleDirectory, 'utility-entry.js');
}

export function createElectronCodexFeasibilityRunner(
  mainBundleDirectory: string,
): CodexFeasibilityRunner {
  return new CodexFeasibilityRunner({
    modulePath: resolveCodexFeasibilityUtilityPath(mainBundleDirectory),
  });
}

const electronFork: ForkCodexFeasibilityUtility = (modulePath, args, options) => (
  utilityProcess.fork(modulePath, args, options) as CodexFeasibilityUtilityHandle
);
