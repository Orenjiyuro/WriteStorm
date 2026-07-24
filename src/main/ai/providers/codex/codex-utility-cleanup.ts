import {
  createAiRuntimeCleanupObservation,
  type AiRuntimeCleanupObservation,
  type AiRuntimeSession,
  type AiTerminationTrigger,
} from '../../ai-attempt-lifecycle';

type AbortObservation = {
  readonly abortRequested: boolean;
  readonly abortObserved: boolean;
  readonly executionSettled: boolean;
};

type ShutdownObservation = {
  readonly cleanupAcknowledged: boolean;
  readonly utilityExitObserved: boolean;
};

type ForceObservation = {
  readonly utilityKillOwnershipProven: boolean;
  readonly utilityKillAttempted: boolean;
  readonly utilityExitObserved: boolean;
};

type ResidualObservation = {
  readonly residualScanCompleted: boolean;
  readonly utilityResidualAbsent: boolean;
  readonly cliResidualAbsent: boolean;
};

export type CodexUtilityCleanupDriver = {
  requestAbort(trigger: AiTerminationTrigger): Promise<AbortObservation>;
  requestShutdown(): Promise<ShutdownObservation>;
  forceOwnedUtility(): Promise<ForceObservation>;
  scanResiduals(): Promise<ResidualObservation>;
};

export class CodexUtilityCleanupController implements AiRuntimeSession {
  private termination: Promise<AiRuntimeCleanupObservation> | null = null;

  constructor(private readonly input: {
    readonly driver: CodexUtilityCleanupDriver;
    readonly graceMs: number;
  }) {
    if (!Number.isSafeInteger(input.graceMs) || input.graceMs < 1) {
      throw new Error('Codex utility cleanup grace is invalid.');
    }
  }

  terminate(trigger: AiTerminationTrigger): Promise<AiRuntimeCleanupObservation> {
    this.termination ??= this.run(trigger);
    return this.termination;
  }

  private async run(trigger: AiTerminationTrigger): Promise<AiRuntimeCleanupObservation> {
    const abort = await invokeWithin(
      () => this.input.driver.requestAbort(trigger),
      this.input.graceMs,
    ) ?? failedAbort();
    const shutdown = await invokeWithin(
      () => this.input.driver.requestShutdown(),
      this.input.graceMs,
    ) ?? failedShutdown();
    const force = shutdown.utilityExitObserved
      ? failedForce()
      : await invokeWithin(
        () => this.input.driver.forceOwnedUtility(),
        this.input.graceMs,
      ) ?? failedForce();
    const residuals = await invokeWithin(
      () => this.input.driver.scanResiduals(),
      this.input.graceMs,
    ) ?? failedResiduals();
    const utilityExitObserved = shutdown.utilityExitObserved || force.utilityExitObserved;
    const graceful = abort.abortRequested
      && abort.abortObserved
      && abort.executionSettled
      && shutdown.cleanupAcknowledged
      && shutdown.utilityExitObserved
      && residuals.residualScanCompleted
      && residuals.utilityResidualAbsent
      && residuals.cliResidualAbsent;
    const forced = force.utilityKillOwnershipProven
      && force.utilityKillAttempted
      && utilityExitObserved
      && residuals.residualScanCompleted
      && residuals.utilityResidualAbsent
      && residuals.cliResidualAbsent;
    return createAiRuntimeCleanupObservation({
      classification: graceful ? 'graceful' : forced ? 'forced' : 'unverified',
      ...abort,
      ...shutdown,
      utilityExitObserved,
      utilityKillOwnershipProven: force.utilityKillOwnershipProven,
      utilityKillAttempted: force.utilityKillAttempted,
      ...residuals,
    });
  }
}

async function invokeWithin<T>(
  operation: () => Promise<T>,
  milliseconds: number,
): Promise<T | undefined> {
  let handle: NodeJS.Timeout | undefined;
  try {
    let promise: Promise<T>;
    try {
      promise = operation();
    } catch {
      return undefined;
    }
    return await Promise.race([
      promise.catch(() => undefined),
      new Promise<undefined>((resolve) => {
        handle = setTimeout(() => resolve(undefined), milliseconds);
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

function failedAbort(): AbortObservation {
  return {
    abortRequested: false,
    abortObserved: false,
    executionSettled: false,
  };
}

function failedShutdown(): ShutdownObservation {
  return {
    cleanupAcknowledged: false,
    utilityExitObserved: false,
  };
}

function failedForce(): ForceObservation {
  return {
    utilityKillOwnershipProven: false,
    utilityKillAttempted: false,
    utilityExitObserved: false,
  };
}

function failedResiduals(): ResidualObservation {
  return {
    residualScanCompleted: false,
    utilityResidualAbsent: false,
    cliResidualAbsent: false,
  };
}
