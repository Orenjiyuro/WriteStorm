import type {
  AiExecutionHandle,
  AiExecutionRequest,
} from '../../ai-execution-port';

export type CodexUtilityTransport = {
  execute(request: AiExecutionRequest): AiExecutionHandle;
};
