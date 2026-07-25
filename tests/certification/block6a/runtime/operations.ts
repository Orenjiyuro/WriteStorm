import {
  CODEX_FEASIBILITY_PROTOCOL_VERSION,
  isCodexFeasibilityRequest,
  type CodexFeasibilityCommand,
  type CodexFeasibilityRequestFor,
  type CodexFeasibilityRequestPayload,
  type CodexFeasibilityResponse,
  type CodexFeasibilityResponseFor,
} from './protocol';

export type CodexFeasibilityOperationPhase =
  | 'inspect'
  | 'capability'
  | 'output-schema'
  | 'start-lifecycle'
  | 'cancel-lifecycle'
  | 'cancel-active'
  | 'shutdown';

export type CodexFeasibilityRunnerPhase =
  | CodexFeasibilityOperationPhase
  | 'await-trigger';

export type CodexFeasibilityOperationFailureReason =
  | 'inspection_failed'
  | 'capability_failed'
  | 'output_schema_failed'
  | 'lifecycle_failed';

export type CodexFeasibilityOperationDescriptor<
  Command extends CodexFeasibilityCommand,
> = {
  readonly operation: string;
  readonly command: Command;
  readonly phase: CodexFeasibilityOperationPhase;
  readonly payloadKeys: readonly (
    keyof CodexFeasibilityRequestPayload<Command> & string
  )[];
  readonly failureReason: CodexFeasibilityOperationFailureReason | null;
};

export const CODEX_FEASIBILITY_OPERATIONS = {
  inspect: {
    operation: 'inspect',
    command: 'inspect-runtime',
    phase: 'inspect',
    payloadKeys: [],
    failureReason: 'inspection_failed',
  } as const satisfies CodexFeasibilityOperationDescriptor<'inspect-runtime'>,
  capability: {
    operation: 'capability',
    command: 'run-capability-probe',
    phase: 'capability',
    payloadKeys: ['input'],
    failureReason: 'capability_failed',
  } as const satisfies CodexFeasibilityOperationDescriptor<'run-capability-probe'>,
  outputSchema: {
    operation: 'output-schema',
    command: 'run-output-schema-probe',
    phase: 'output-schema',
    payloadKeys: ['input'],
    failureReason: 'output_schema_failed',
  } as const satisfies CodexFeasibilityOperationDescriptor<'run-output-schema-probe'>,
  startLifecycle: {
    operation: 'start-lifecycle',
    command: 'start-lifecycle-probe',
    phase: 'start-lifecycle',
    payloadKeys: ['input'],
    failureReason: 'lifecycle_failed',
  } as const satisfies CodexFeasibilityOperationDescriptor<'start-lifecycle-probe'>,
  cancelLifecycle: {
    operation: 'cancel-lifecycle',
    command: 'cancel-lifecycle-probe',
    phase: 'cancel-lifecycle',
    payloadKeys: ['trigger'],
    failureReason: 'lifecycle_failed',
  } as const satisfies CodexFeasibilityOperationDescriptor<'cancel-lifecycle-probe'>,
  cancelActive: {
    operation: 'cancel-active',
    command: 'cancel-active-probe',
    phase: 'cancel-active',
    payloadKeys: [],
    failureReason: null,
  } as const satisfies CodexFeasibilityOperationDescriptor<'cancel-active-probe'>,
  shutdown: {
    operation: 'shutdown',
    command: 'shutdown',
    phase: 'shutdown',
    payloadKeys: [],
    failureReason: null,
  } as const satisfies CodexFeasibilityOperationDescriptor<'shutdown'>,
} as const;

export function createCodexFeasibilityOperationRequest<
  Command extends CodexFeasibilityCommand,
>(
  descriptor: CodexFeasibilityOperationDescriptor<Command>,
  requestId: string,
  payload: CodexFeasibilityRequestPayload<Command>,
): CodexFeasibilityRequestFor<Command> {
  const request = {
    version: CODEX_FEASIBILITY_PROTOCOL_VERSION,
    origin: 'main',
    requestId,
    command: descriptor.command,
    ...payload,
  };
  if (!isCodexFeasibilityRequest(request)) {
    throw new Error('Invalid Codex feasibility operation request.');
  }
  return request as CodexFeasibilityRequestFor<Command>;
}

export function isCodexFeasibilityOperationResponse<
  Command extends CodexFeasibilityCommand,
>(
  descriptor: CodexFeasibilityOperationDescriptor<Command>,
  requestId: string,
  response: CodexFeasibilityResponse,
): response is CodexFeasibilityResponseFor<Command> {
  return response.command === descriptor.command && response.requestId === requestId;
}
