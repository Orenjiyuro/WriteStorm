import type { Codex } from '@openai/codex-sdk';
import type {
  AiExecutionEvent,
  AiExecutionHandle,
  AiExecutionPort,
  AiExecutionRequest,
} from '../../src/main/ai/ai-execution-port';

declare const port: AiExecutionPort;
declare const sdkClient: Codex;

// @ts-expect-error The application port is deliberately non-generic.
type ForbiddenProviderParameterizedPort = AiExecutionPort<Codex, Codex>;

// @ts-expect-error A provider SDK object cannot cross the application request boundary.
port.execute(sdkClient);

// @ts-expect-error Plain or provider-owned objects cannot mint the sealed request brand.
const forbiddenRequest: AiExecutionRequest = sdkClient;

// @ts-expect-error Plain or provider-owned objects cannot mint the sealed event brand.
const forbiddenEvent: AiExecutionEvent = sdkClient;

// @ts-expect-error Plain or provider-owned objects cannot mint the sealed handle brand.
const forbiddenHandle: AiExecutionHandle = sdkClient;

void (0 as unknown as ForbiddenProviderParameterizedPort);
void forbiddenRequest;
void forbiddenEvent;
void forbiddenHandle;
