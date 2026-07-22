export const AI_EXECUTION_PORT_CONTRACT_VERSION = 1 as const;

export type AiExecutionCapabilities = {
  readonly structuredOutput: boolean;
  readonly streamedEvents: boolean;
  readonly cancellation: boolean;
};

/**
 * Thin application-owned seam implemented by one independently gated adapter.
 * Later tasks bind concrete request, event and lifecycle types without widening
 * this contract into a registry or a persistence boundary.
 */
export type AiExecutionPort<Request, Execution> = {
  readonly contractVersion: typeof AI_EXECUTION_PORT_CONTRACT_VERSION;
  readonly capabilities: AiExecutionCapabilities;
  execute(request: Request): Execution;
};
