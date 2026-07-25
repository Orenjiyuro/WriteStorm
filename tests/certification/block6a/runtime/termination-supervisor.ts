import {
  isCodexFeasibilityResponse,
  type CodexFeasibilityResponse,
} from './protocol';
import {
  CODEX_FEASIBILITY_OPERATIONS,
  createCodexFeasibilityOperationRequest,
  isCodexFeasibilityOperationResponse,
} from './operations';

export type CodexFeasibilityTerminationResiduals = {
  readonly ownershipObserved: boolean;
  readonly residualScanCompleted: boolean;
  readonly utilityResidualAbsent: boolean;
  readonly cliResidualAbsent: boolean;
};

export type CodexFeasibilityTerminationOwnership = {
  bindUtility(utilityPid: number): void;
  isUtilityOwnedAndRunning(): boolean;
  scanResiduals(): Promise<CodexFeasibilityTerminationResiduals>;
};

export type CodexFeasibilityTerminationSummary = {
  readonly classification: 'graceful' | 'forced' | 'unverified';
  readonly abortRequested: boolean;
  readonly abortObserved: boolean;
  readonly sdkPromiseSettled: boolean;
  readonly cleanupAcknowledged: boolean;
  readonly utilityExitObserved: boolean;
  readonly utilityKillOwnershipProven: boolean;
  readonly utilityKillAttempted: boolean;
  readonly residualScanCompleted: boolean;
  readonly utilityResidualAbsent: boolean;
  readonly cliResidualAbsent: boolean;
};

type TerminationChild = {
  postMessage(message: unknown): void;
  kill(): boolean;
};

type TerminationStage = 'idle' | 'cancel' | 'shutdown' | 'exit' | 'forced-exit' | 'finished';

export class CodexFeasibilityTerminationSupervisor<Failure> {
  private stage: TerminationStage = 'idle';
  private failure: Failure | undefined;
  private utilityPid: number | undefined;
  private timeoutTimer: NodeJS.Timeout | undefined;
  private graceTimer: NodeJS.Timeout | undefined;
  private disposed = false;
  private finishing = false;
  private abortRequested = false;
  private abortObserved = false;
  private sdkPromiseSettled = false;
  private cleanupAcknowledged = false;
  private utilityExitObserved = false;
  private utilityKillOwnershipProven = false;
  private utilityKillAttempted = false;

  constructor(private readonly options: {
    readonly child: TerminationChild;
    readonly graceMs: number;
    readonly cancelRequestId: string;
    readonly shutdownRequestId: string;
    readonly ownership?: CodexFeasibilityTerminationOwnership;
    readonly onFinished: (
      failure: Failure,
      summary: CodexFeasibilityTerminationSummary,
    ) => void;
  }) {}

  bindUtility(utilityPid: number): void {
    if (this.utilityPid !== undefined && this.utilityPid !== utilityPid) return;
    this.utilityPid = utilityPid;
    this.options.ownership?.bindUtility(utilityPid);
  }

  armTimeout(timeoutMs: number, failure: Failure): void {
    this.timeoutTimer = setTimeout(() => this.begin(failure), timeoutMs);
  }

  begin(failure: Failure): boolean {
    if (this.disposed || this.stage !== 'idle') return false;
    this.failure = failure;
    this.stage = 'cancel';
    this.post(createCodexFeasibilityOperationRequest(
      CODEX_FEASIBILITY_OPERATIONS.cancelActive,
      this.options.cancelRequestId,
      {},
    ));
    this.armGrace();
    return true;
  }

  consumeMessage(message: unknown): boolean {
    if (!this.isActive()) return false;
    if (!isCodexFeasibilityResponse(message) || !this.matchesBoundUtility(message)) return true;
    if (this.stage === 'cancel' && isCodexFeasibilityOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.cancelActive,
      this.options.cancelRequestId,
      message,
    )) {
      this.abortRequested = message.abortRequested;
      this.abortObserved = message.abortObserved;
      this.sdkPromiseSettled = message.sdkPromiseSettled;
      this.requestShutdown();
      return true;
    }
    if (this.stage === 'shutdown' && isCodexFeasibilityOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.shutdown,
      this.options.shutdownRequestId,
      message,
    )) {
      this.cleanupAcknowledged = message.cleanupAcknowledged;
      this.stage = 'exit';
      this.armGrace();
      return true;
    }
    // A concurrently settling operation response is deliberately ignored. Only
    // the coordinator's exact cancel and shutdown responses advance cleanup.
    return true;
  }

  consumeExit(): boolean {
    if (!this.isActive()) return false;
    this.utilityExitObserved = true;
    void this.finish();
    return true;
  }

  isActive(): boolean {
    return this.stage !== 'idle' && this.stage !== 'finished';
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private requestShutdown(): void {
    if (!this.isActive()) return;
    this.stage = 'shutdown';
    this.post(createCodexFeasibilityOperationRequest(
      CODEX_FEASIBILITY_OPERATIONS.shutdown,
      this.options.shutdownRequestId,
      {},
    ));
    this.armGrace();
  }

  private onGraceExpired(): void {
    if (!this.isActive()) return;
    if (this.stage === 'cancel') {
      // Shutdown is a second cooperative cancellation boundary in the utility.
      // Missing cancel settlement remains false and prevents a graceful result.
      this.requestShutdown();
      return;
    }
    if (this.stage === 'shutdown' || this.stage === 'exit') {
      this.forceOwnedUtilityOrFailClosed();
      return;
    }
    if (this.stage === 'forced-exit') void this.finish();
  }

  private forceOwnedUtilityOrFailClosed(): void {
    this.utilityKillOwnershipProven = this.options.ownership
      ?.isUtilityOwnedAndRunning() === true;
    if (!this.utilityKillOwnershipProven) {
      void this.finish();
      return;
    }
    this.utilityKillAttempted = true;
    this.stage = 'forced-exit';
    try {
      this.options.child.kill();
    } catch {
      // A failed owned-handle kill remains an unverified cleanup result.
    }
    this.armGrace();
  }

  private async finish(): Promise<void> {
    if (this.finishing || this.stage === 'finished' || this.failure === undefined) return;
    this.finishing = true;
    this.clearTimers();
    let residuals: CodexFeasibilityTerminationResiduals = {
      ownershipObserved: false,
      residualScanCompleted: false,
      utilityResidualAbsent: false,
      cliResidualAbsent: false,
    };
    try {
      residuals = await this.options.ownership?.scanResiduals() ?? residuals;
    } catch {
      // Observer failures are represented only by false sanitized assertions.
    }
    const graceful = this.abortRequested
      && this.abortObserved
      && this.sdkPromiseSettled
      && this.cleanupAcknowledged
      && this.utilityExitObserved
      && residuals.ownershipObserved
      && residuals.residualScanCompleted
      && residuals.utilityResidualAbsent
      && residuals.cliResidualAbsent;
    const summary: CodexFeasibilityTerminationSummary = {
      classification: this.utilityKillAttempted
        ? 'forced'
        : graceful ? 'graceful' : 'unverified',
      abortRequested: this.abortRequested,
      abortObserved: this.abortObserved,
      sdkPromiseSettled: this.sdkPromiseSettled,
      cleanupAcknowledged: this.cleanupAcknowledged,
      utilityExitObserved: this.utilityExitObserved,
      utilityKillOwnershipProven: this.utilityKillOwnershipProven,
      utilityKillAttempted: this.utilityKillAttempted,
      residualScanCompleted: residuals.residualScanCompleted,
      utilityResidualAbsent: residuals.utilityResidualAbsent,
      cliResidualAbsent: residuals.cliResidualAbsent,
    };
    const failure = this.failure;
    this.stage = 'finished';
    this.options.onFinished(failure, summary);
  }

  private matchesBoundUtility(message: CodexFeasibilityResponse): boolean {
    return this.utilityPid !== undefined && message.utilityPid === this.utilityPid;
  }

  private post(message: unknown): void {
    try {
      this.options.child.postMessage(message);
    } catch {
      // Grace expiry will attempt only ownership-safe escalation.
    }
  }

  private armGrace(): void {
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = setTimeout(() => this.onGraceExpired(), this.options.graceMs);
  }

  private clearTimers(): void {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
  }
}
