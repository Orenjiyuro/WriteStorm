export type CodexUtilityProtocolTerminationDependencies = {
  readonly cancelActiveSdkProbe: () => Promise<unknown>;
  readonly scheduleExit: (code: number) => void;
};

const MALFORMED_REQUEST_EXIT_CODE = 28;

export class CodexUtilityProtocolTerminationSupervisor {
  private termination: Promise<void> | undefined;

  constructor(
    private readonly dependencies: CodexUtilityProtocolTerminationDependencies,
  ) {}

  isTerminating(): boolean {
    return this.termination !== undefined;
  }

  beginMalformedRequestTermination(): boolean {
    if (this.termination) return false;

    this.termination = this.cancelAndScheduleExit();
    return true;
  }

  async waitUntilExitScheduled(): Promise<void> {
    await this.termination;
  }

  private async cancelAndScheduleExit(): Promise<void> {
    try {
      await this.dependencies.cancelActiveSdkProbe();
    } catch {
      // Malformed protocol input cannot receive a safe response. Exit remains
      // fail-closed after the active-turn settlement attempt without exposing errors.
    }
    this.dependencies.scheduleExit(MALFORMED_REQUEST_EXIT_CODE);
  }
}
