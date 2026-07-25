import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { utilityProcess } from 'electron';
import {
  diagnoseCodexFeasibilityResponse,
  isCodexFeasibilityResponse,
  type CodexCapabilityProbeInput,
  type CodexCapabilityProbeResult,
  type CodexFeasibilityRequestPayload,
  type CodexFeasibilityResponse,
  type CodexFeasibilityResponseDiagnostic,
  type CodexFeasibilityUtilityErrorCode,
  type CodexLifecycleProbeInput,
  type CodexLifecycleProbeResult,
  type CodexLifecycleTrigger,
  type CodexOutputSchemaProbeInput,
  type CodexOutputSchemaProbeResult,
  type CodexRuntimeInspection,
} from './protocol';
import {
  CODEX_FEASIBILITY_OPERATIONS,
  type CodexFeasibilityOperationFailureReason,
  type CodexFeasibilityOperationDescriptor,
  type CodexFeasibilityRunnerPhase,
} from './operations';
import { CodexFeasibilitySessionSupervisor } from './session-supervisor';
import {
  CodexFeasibilityTerminationSupervisor,
  type CodexFeasibilityTerminationOwnership,
  type CodexFeasibilityTerminationSummary,
} from './termination-supervisor';

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
  | CodexFeasibilityOperationFailureReason;

export type CodexTimeoutCleanupSummary = CodexFeasibilityTerminationSummary;

export class CodexFeasibilityRunnerError extends Error {
  readonly code = 'CODEX_FEASIBILITY_UTILITY_FAILED' as const;
  readonly timeoutCleanup: CodexTimeoutCleanupSummary | undefined;

  constructor(
    readonly reason: CodexFeasibilityRunnerFailureReason,
    message: string,
    readonly utilityErrorCode?: CodexFeasibilityUtilityErrorCode,
    readonly protocolDiagnostic?: CodexFeasibilityResponseDiagnostic & {
      readonly phase: CodexFeasibilityRunnerPhase;
    },
    readonly terminationCleanup?: CodexFeasibilityTerminationSummary,
  ) {
    super(message);
    this.name = 'CodexFeasibilityRunnerError';
    this.timeoutCleanup = reason === 'timeout' ? terminationCleanup : undefined;
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

type CodexFeasibilityUtilitySessionOptions = {
  readonly utilityWorkingDirectory?: string;
  readonly utilityEnvironment?: NodeJS.ProcessEnv;
  readonly terminationOwnership?: CodexFeasibilityTerminationOwnership;
};

type CodexFeasibilitySingleOperationCommand =
  | 'inspect-runtime'
  | 'run-capability-probe'
  | 'run-output-schema-probe';

type CodexFeasibilityOperationResult<Command extends CodexFeasibilitySingleOperationCommand> =
  Command extends 'inspect-runtime'
    ? CodexRuntimeInspection
    : Command extends 'run-capability-probe'
      ? CodexCapabilityProbeResult
      : CodexOutputSchemaProbeResult;

type CodexFeasibilityUtilitySessionOutcome<Result> = {
  readonly utilityPid: number;
  readonly cleanupAcknowledged: true;
  readonly result: Result;
};

type CodexFeasibilityUtilitySessionContext = {
  readonly session: CodexFeasibilitySessionSupervisor;
  readonly send: (createMessage: () => unknown) => boolean;
  readonly requestShutdown: () => void;
  readonly beginTermination: (error: CodexFeasibilityRunnerError) => void;
  readonly isTerminating: () => boolean;
};

type CodexFeasibilityUtilitySessionConfig<Result> =
  CodexFeasibilityUtilitySessionOptions & {
    readonly timeoutMs: number;
    readonly fallbackPhase: CodexFeasibilityRunnerPhase;
    readonly start: (context: CodexFeasibilityUtilitySessionContext) => void;
    readonly consumeOperationResponse: (
      message: CodexFeasibilityResponse,
      context: CodexFeasibilityUtilitySessionContext,
    ) => void;
    readonly getResult: () => Result | undefined;
    readonly getFailure: () => CodexFeasibilityRunnerError | undefined;
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
      readonly terminationOwnership?: CodexFeasibilityTerminationOwnership;
    },
  ): Promise<CodexFeasibilityInspectionOutcome> {
    return this.runSingleOperation(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      {},
      timeoutMs,
      options,
    );
  }

  runCapabilityProbe(
    input: CodexCapabilityProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
      readonly terminationOwnership?: CodexFeasibilityTerminationOwnership;
    },
  ): Promise<CodexFeasibilityCapabilityOutcome> {
    return this.runSingleOperation(
      CODEX_FEASIBILITY_OPERATIONS.capability,
      { input },
      timeoutMs,
      options,
    );
  }

  runOutputSchemaProbe(
    input: CodexOutputSchemaProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
      readonly terminationOwnership?: CodexFeasibilityTerminationOwnership;
    },
  ): Promise<CodexFeasibilityOutputSchemaOutcome> {
    return this.runSingleOperation(
      CODEX_FEASIBILITY_OPERATIONS.outputSchema,
      { input },
      timeoutMs,
      options,
    );
  }

  runLifecycleProbe(
    input: CodexLifecycleProbeInput,
    timeoutMs: number,
    options: {
      readonly utilityWorkingDirectory: string;
      readonly utilityEnvironment: NodeJS.ProcessEnv;
      readonly waitForTrigger: (context: { readonly utilityPid: number }) => Promise<CodexLifecycleTrigger>;
      readonly terminationOwnership?: CodexFeasibilityTerminationOwnership;
    },
  ): Promise<CodexFeasibilityLifecycleOutcome> {
    const startRequestId = this.createRequestId();
    const cancelRequestId = this.createRequestId();
    let lifecycleResult: CodexLifecycleProbeResult | undefined;
    let lifecycleFailure: CodexFeasibilityRunnerError | undefined;

    return this.runUtilitySession({
      timeoutMs,
      utilityWorkingDirectory: options.utilityWorkingDirectory,
      utilityEnvironment: options.utilityEnvironment,
      terminationOwnership: options.terminationOwnership,
      fallbackPhase: CODEX_FEASIBILITY_OPERATIONS.startLifecycle.phase,
      start: (context) => {
        context.send(() => context.session.beginOperation(
          CODEX_FEASIBILITY_OPERATIONS.startLifecycle,
          startRequestId,
          { input },
        ));
      },
      consumeOperationResponse: (message, context) => {
        const phase = context.session.currentPhase(
          CODEX_FEASIBILITY_OPERATIONS.startLifecycle.phase,
        );
        if (phase === CODEX_FEASIBILITY_OPERATIONS.startLifecycle.phase) {
          const response = context.session.acceptOperationResponse(
            CODEX_FEASIBILITY_OPERATIONS.startLifecycle,
            startRequestId,
            message,
          );
          if (!response.ok) {
            lifecycleFailure = runnerFailure(
              CODEX_FEASIBILITY_OPERATIONS.startLifecycle.failureReason,
              response.error.code,
            );
            context.requestShutdown();
            return;
          }
          context.session.awaitContinuation('await-trigger');
          void options.waitForTrigger({ utilityPid: response.utilityPid }).then(
            (trigger) => {
              if (context.isTerminating()
                || context.session.isFinal()
                || context.session.currentPhase('await-trigger') !== 'await-trigger') return;
              context.send(() => context.session.beginOperation(
                CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle,
                cancelRequestId,
                { trigger },
              ));
            },
            () => context.beginTermination(runnerFailure(
              CODEX_FEASIBILITY_OPERATIONS.startLifecycle.failureReason,
            )),
          );
          return;
        }
        if (phase !== CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle.phase) {
          throw new Error('Unexpected lifecycle phase.');
        }
        const response = context.session.acceptOperationResponse(
          CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle,
          cancelRequestId,
          message,
        );
        if (response.ok) lifecycleResult = response.result;
        else lifecycleFailure = runnerFailure(
          CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle.failureReason,
          response.error.code,
        );
        context.requestShutdown();
      },
      getResult: () => lifecycleResult,
      getFailure: () => lifecycleFailure,
    });
  }

  private runSingleOperation<Command extends CodexFeasibilitySingleOperationCommand>(
    descriptor: CodexFeasibilityOperationDescriptor<Command> & {
      readonly failureReason: CodexFeasibilityOperationFailureReason;
    },
    payload: CodexFeasibilityRequestPayload<Command>,
    timeoutMs: number,
    options?: CodexFeasibilityUtilitySessionOptions,
  ): Promise<CodexFeasibilityUtilitySessionOutcome<CodexFeasibilityOperationResult<Command>>> {
    const requestId = this.createRequestId();
    let result: CodexFeasibilityOperationResult<Command> | undefined;
    let failure: CodexFeasibilityRunnerError | undefined;

    return this.runUtilitySession({
      timeoutMs,
      utilityWorkingDirectory: options?.utilityWorkingDirectory,
      utilityEnvironment: options?.utilityEnvironment,
      terminationOwnership: options?.terminationOwnership,
      fallbackPhase: descriptor.phase,
      start: (context) => {
        context.send(() => context.session.beginOperation(descriptor, requestId, payload));
      },
      consumeOperationResponse: (message, context) => {
        const response = context.session.acceptOperationResponse(
          descriptor,
          requestId,
          message,
        ) as CodexFeasibilityResponse;
        if (response.ok) {
          if (!('result' in response)) throw new Error('Operation result missing.');
          result = response.result as CodexFeasibilityOperationResult<Command>;
        } else {
          failure = runnerFailure(
            descriptor.failureReason,
            response.error.code,
          );
        }
        context.requestShutdown();
      },
      getResult: () => result,
      getFailure: () => failure,
    });
  }

  private runUtilitySession<Result>(
    config: CodexFeasibilityUtilitySessionConfig<Result>,
  ): Promise<CodexFeasibilityUtilitySessionOutcome<Result>> {
    const timeoutCancelRequestId = this.createRequestId();
    const shutdownRequestId = this.createRequestId();
    const child = this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm Codex Feasibility Utility',
      stdio: 'pipe',
      cwd: config.utilityWorkingDirectory,
      env: config.utilityEnvironment,
    });

    return new Promise((resolve, reject) => {
      const session = new CodexFeasibilitySessionSupervisor();
      let terminating = false;
      const terminationSupervisor = new CodexFeasibilityTerminationSupervisor<CodexFeasibilityRunnerError>({
        child,
        graceMs: this.timeoutGraceMs,
        cancelRequestId: timeoutCancelRequestId,
        shutdownRequestId,
        ownership: config.terminationOwnership,
        onFinished: (failure, summary) => settleFailure(withTerminationCleanup(failure, summary)),
      });
      terminationSupervisor.armTimeout(config.timeoutMs, runnerFailure('timeout'));
      const cleanup = (): void => {
        terminationSupervisor.dispose();
        child.removeListener('spawn', onSpawn);
        child.removeListener('message', onMessage);
        child.removeListener('exit', onExit);
      };
      const settleFailure = (error: CodexFeasibilityRunnerError): void => {
        if (!session.fail()) return;
        cleanup();
        reject(error);
      };
      const beginTermination = (error: CodexFeasibilityRunnerError): void => {
        terminating = true;
        terminationSupervisor.begin(error);
      };
      const context: CodexFeasibilityUtilitySessionContext = {
        session,
        send: (createMessage) => !terminating
          && sendSessionMessage(child, createMessage, beginTermination),
        requestShutdown: () => {
          context.send(() => session.beginShutdown(shutdownRequestId));
        },
        beginTermination,
        isTerminating: () => terminating,
      };
      const onSpawn = (): void => {
        if (child.pid === undefined) {
          beginTermination(runnerFailure('crash'));
          return;
        }
        try {
          session.bindUtilityPid(child.pid);
          terminationSupervisor.bindUtility(child.pid);
          config.start(context);
        } catch {
          beginTermination(runnerFailure('crash'));
        }
      };
      const onMessage = (message: unknown): void => {
        if (terminationSupervisor.consumeMessage(message)) return;
        if (session.isFinal() || !isCodexFeasibilityResponse(message)) {
          beginTermination(runnerProtocolFailure(
            message,
            session.currentPhase(config.fallbackPhase),
          ));
          return;
        }
        try {
          if (session.currentPhase(config.fallbackPhase)
            === CODEX_FEASIBILITY_OPERATIONS.shutdown.phase) {
            session.acceptShutdownResponse(shutdownRequestId, message);
          } else {
            config.consumeOperationResponse(message, context);
          }
        } catch {
          beginTermination(runnerProtocolFailure(
            message,
            session.currentPhase(config.fallbackPhase),
          ));
        }
      };
      const onExit = (code: number): void => {
        if (terminationSupervisor.consumeExit()) return;
        if (session.isFinal()) return;
        try {
          session.acceptUtilityExit(code);
        } catch {
          beginTermination(runnerFailure('crash'));
          terminationSupervisor.consumeExit();
          return;
        }
        const failure = config.getFailure();
        if (failure) {
          settleFailure(failure);
          return;
        }
        const utilityPid = session.getUtilityPid();
        const result = config.getResult();
        if (result === undefined || utilityPid === undefined) {
          settleFailure(runnerFailure('protocol'));
          return;
        }
        session.complete();
        cleanup();
        resolve({ utilityPid, cleanupAcknowledged: true, result });
      };

      child.on('spawn', onSpawn);
      child.on('message', onMessage);
      child.on('exit', onExit);
    });
  }
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

export function sendSessionMessage(
  child: Pick<CodexFeasibilityUtilityHandle, 'postMessage'>,
  createMessage: () => unknown,
  beginTermination: (error: CodexFeasibilityRunnerError) => void,
): boolean {
  try {
    child.postMessage(createMessage());
    return true;
  } catch {
    beginTermination(runnerFailure('crash'));
    return false;
  }
}

function runnerProtocolFailure(
  message: unknown,
  phase: CodexFeasibilityRunnerPhase,
): CodexFeasibilityRunnerError {
  return new CodexFeasibilityRunnerError(
    'protocol',
    'Codex feasibility utility returned an invalid response.',
    undefined,
    { phase, ...diagnoseCodexFeasibilityResponse(message) },
  );
}

function withTerminationCleanup(
  error: CodexFeasibilityRunnerError,
  summary: CodexFeasibilityTerminationSummary,
): CodexFeasibilityRunnerError {
  return new CodexFeasibilityRunnerError(
    error.reason,
    error.message,
    error.utilityErrorCode,
    error.protocolDiagnostic,
    summary,
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
