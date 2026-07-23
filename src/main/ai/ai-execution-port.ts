declare const requestBrand: unique symbol;
declare const eventBrand: unique symbol;
declare const handleBrand: unique symbol;

export type AiExecutionCapabilities = {
  readonly structuredOutput: boolean;
  readonly streamedEvents: boolean;
  readonly cancellation: boolean;
};

export interface AiExecutionRequest {
  readonly [requestBrand]: never;
}

export interface AiExecutionEvent {
  readonly [eventBrand]: never;
}

export interface AiExecutionHandle {
  readonly [handleBrand]: never;
}

export interface AiExecutionPort {
  readonly capabilities: AiExecutionCapabilities;
  execute(request: AiExecutionRequest): AiExecutionHandle;
}
