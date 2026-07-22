import {
  AI_EXECUTION_PORT_CONTRACT_VERSION,
  type AiExecutionCapabilities,
  type AiExecutionPort,
} from '../../ai-execution-port';
import type { CodexUtilityTransport } from './codex-utility-transport';

export type CodexProviderAdapterOptions<Request, Execution> = {
  readonly capabilities: AiExecutionCapabilities;
  readonly transport: CodexUtilityTransport<Request, Execution>;
};

export class CodexProviderAdapter<Request, Execution>
implements AiExecutionPort<Request, Execution> {
  readonly contractVersion = AI_EXECUTION_PORT_CONTRACT_VERSION;
  readonly capabilities: AiExecutionCapabilities;
  private readonly transport: CodexUtilityTransport<Request, Execution>;

  constructor(options: CodexProviderAdapterOptions<Request, Execution>) {
    this.capabilities = Object.freeze({ ...options.capabilities });
    this.transport = options.transport;
  }

  execute(request: Request): Execution {
    return this.transport.execute(request);
  }
}
