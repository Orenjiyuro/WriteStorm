import {
  type AiExecutionCapabilities,
  type AiExecutionHandle,
  type AiExecutionPort,
  type AiExecutionRequest,
} from '../../ai-execution-port';
import type { CodexUtilityTransport } from './codex-utility-transport';

export const CODEX_PROVIDER_CAPABILITIES: AiExecutionCapabilities = Object.freeze({
  structuredOutput: false,
  streamedEvents: false,
  cancellation: false,
});

export type CodexProviderAdapterOptions = {
  readonly transport: CodexUtilityTransport;
};

export class CodexProviderAdapter implements AiExecutionPort {
  readonly capabilities = CODEX_PROVIDER_CAPABILITIES;
  private readonly transport: CodexUtilityTransport;

  constructor(options: CodexProviderAdapterOptions) {
    this.transport = options.transport;
  }

  execute(request: AiExecutionRequest): AiExecutionHandle {
    return this.transport.execute(request);
  }
}
