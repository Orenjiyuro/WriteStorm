import {
  CODEX_FEASIBILITY_OPERATIONS,
  createCodexFeasibilityOperationRequest,
  isCodexFeasibilityOperationResponse,
  type CodexFeasibilityOperationDescriptor,
  type CodexFeasibilityRunnerPhase,
} from './operations';
import type {
  CodexFeasibilityCommand,
  CodexFeasibilityRequestFor,
  CodexFeasibilityRequestPayload,
  CodexFeasibilityResponse,
  CodexFeasibilityResponseFor,
} from './protocol';

export type CodexFeasibilitySessionState =
  | 'created'
  | 'operation-active'
  | 'operation-settled'
  | 'awaiting-continuation'
  | 'shutdown-active'
  | 'shutdown-acknowledged'
  | 'utility-exited'
  | 'completed'
  | 'failed';

export type CodexFeasibilitySessionStateErrorCode =
  | 'OPERATION_ALREADY_ACTIVE'
  | 'INVALID_STATE_TRANSITION'
  | 'UNEXPECTED_OPERATION_RESPONSE'
  | 'UTILITY_PID_MISMATCH'
  | 'UNEXPECTED_SHUTDOWN_RESPONSE'
  | 'UNEXPECTED_UTILITY_EXIT';

export class CodexFeasibilitySessionStateError extends Error {
  constructor(readonly code: CodexFeasibilitySessionStateErrorCode) {
    super('Codex feasibility session state transition was rejected.');
    this.name = 'CodexFeasibilitySessionStateError';
  }
}

type ActiveOperation = {
  readonly operation: string;
  readonly command: CodexFeasibilityCommand;
  readonly phase: CodexFeasibilityRunnerPhase;
  readonly requestId: string;
};

export type CodexFeasibilitySessionSnapshot = {
  readonly state: CodexFeasibilitySessionState;
  readonly phase: CodexFeasibilityRunnerPhase | null;
  readonly operationCount: number;
  readonly utilityPid: number | null;
  readonly cleanupAcknowledged: boolean;
  readonly utilityExitObserved: boolean;
  readonly finalSettlement: 'completed' | 'failed' | null;
};

export class CodexFeasibilitySessionSupervisor {
  private state: CodexFeasibilitySessionState = 'created';
  private phase: CodexFeasibilityRunnerPhase | null = null;
  private activeOperation: ActiveOperation | undefined;
  private operationCount = 0;
  private utilityPid: number | undefined;
  private cleanupAcknowledged = false;
  private utilityExitObserved = false;
  private finalSettlement: 'completed' | 'failed' | null = null;

  bindUtilityPid(utilityPid: number): void {
    if (this.state !== 'created' || !Number.isInteger(utilityPid) || utilityPid <= 0) {
      throw new CodexFeasibilitySessionStateError('INVALID_STATE_TRANSITION');
    }
    this.acceptUtilityPid(utilityPid);
  }

  beginOperation<Command extends CodexFeasibilityCommand>(
    descriptor: CodexFeasibilityOperationDescriptor<Command>,
    requestId: string,
    payload: CodexFeasibilityRequestPayload<Command>,
  ): CodexFeasibilityRequestFor<Command> {
    if (this.state === 'operation-active' || this.state === 'shutdown-active') {
      throw new CodexFeasibilitySessionStateError('OPERATION_ALREADY_ACTIVE');
    }
    if (this.state !== 'created' && this.state !== 'awaiting-continuation') {
      throw new CodexFeasibilitySessionStateError('INVALID_STATE_TRANSITION');
    }
    const request = createCodexFeasibilityOperationRequest(descriptor, requestId, payload);
    this.activeOperation = {
      operation: descriptor.operation,
      command: descriptor.command,
      phase: descriptor.phase,
      requestId,
    };
    this.phase = descriptor.phase;
    this.operationCount += 1;
    this.state = 'operation-active';
    return request;
  }

  acceptOperationResponse<Command extends CodexFeasibilityCommand>(
    descriptor: CodexFeasibilityOperationDescriptor<Command>,
    requestId: string,
    response: CodexFeasibilityResponse,
  ): CodexFeasibilityResponseFor<Command> {
    const active = this.activeOperation;
    if (this.state !== 'operation-active'
      || !active
      || active.operation !== descriptor.operation
      || active.command !== descriptor.command
      || active.requestId !== requestId
      || !isCodexFeasibilityOperationResponse(descriptor, requestId, response)) {
      throw new CodexFeasibilitySessionStateError('UNEXPECTED_OPERATION_RESPONSE');
    }
    this.acceptUtilityPid(response.utilityPid);
    this.activeOperation = undefined;
    this.phase = descriptor.phase;
    this.state = 'operation-settled';
    return response;
  }

  awaitContinuation(phase: 'await-trigger'): void {
    if (this.state !== 'operation-settled') {
      throw new CodexFeasibilitySessionStateError('INVALID_STATE_TRANSITION');
    }
    this.phase = phase;
    this.state = 'awaiting-continuation';
  }

  beginShutdown(requestId: string): CodexFeasibilityRequestFor<'shutdown'> {
    if (this.state === 'operation-active' || this.state === 'shutdown-active') {
      throw new CodexFeasibilitySessionStateError('OPERATION_ALREADY_ACTIVE');
    }
    if (this.state !== 'operation-settled') {
      throw new CodexFeasibilitySessionStateError('INVALID_STATE_TRANSITION');
    }
    const descriptor = CODEX_FEASIBILITY_OPERATIONS.shutdown;
    const request = createCodexFeasibilityOperationRequest(descriptor, requestId, {});
    this.activeOperation = {
      operation: descriptor.operation,
      command: descriptor.command,
      phase: descriptor.phase,
      requestId,
    };
    this.phase = descriptor.phase;
    this.state = 'shutdown-active';
    return request;
  }

  acceptShutdownResponse(
    requestId: string,
    response: CodexFeasibilityResponse,
  ): CodexFeasibilityResponseFor<'shutdown'> {
    const descriptor = CODEX_FEASIBILITY_OPERATIONS.shutdown;
    const active = this.activeOperation;
    if (this.state !== 'shutdown-active'
      || !active
      || active.operation !== descriptor.operation
      || active.requestId !== requestId
      || !isCodexFeasibilityOperationResponse(descriptor, requestId, response)) {
      throw new CodexFeasibilitySessionStateError('UNEXPECTED_SHUTDOWN_RESPONSE');
    }
    this.acceptUtilityPid(response.utilityPid);
    this.activeOperation = undefined;
    this.cleanupAcknowledged = response.cleanupAcknowledged;
    this.phase = descriptor.phase;
    this.state = 'shutdown-acknowledged';
    return response;
  }

  acceptUtilityExit(code: number): void {
    if (this.state !== 'shutdown-acknowledged' || code !== 0) {
      throw new CodexFeasibilitySessionStateError('UNEXPECTED_UTILITY_EXIT');
    }
    this.utilityExitObserved = true;
    this.state = 'utility-exited';
  }

  complete(): boolean {
    if (this.finalSettlement !== null) return false;
    if (this.state !== 'utility-exited') {
      throw new CodexFeasibilitySessionStateError('INVALID_STATE_TRANSITION');
    }
    this.finalSettlement = 'completed';
    this.state = 'completed';
    return true;
  }

  fail(): boolean {
    if (this.finalSettlement !== null) return false;
    this.finalSettlement = 'failed';
    this.activeOperation = undefined;
    this.state = 'failed';
    return true;
  }

  isFinal(): boolean {
    return this.finalSettlement !== null;
  }

  currentPhase(fallback: CodexFeasibilityRunnerPhase): CodexFeasibilityRunnerPhase {
    return this.phase ?? fallback;
  }

  getUtilityPid(): number | undefined {
    return this.utilityPid;
  }

  snapshot(): CodexFeasibilitySessionSnapshot {
    return {
      state: this.state,
      phase: this.phase,
      operationCount: this.operationCount,
      utilityPid: this.utilityPid ?? null,
      cleanupAcknowledged: this.cleanupAcknowledged,
      utilityExitObserved: this.utilityExitObserved,
      finalSettlement: this.finalSettlement,
    };
  }

  private acceptUtilityPid(utilityPid: number): void {
    if (this.utilityPid !== undefined && this.utilityPid !== utilityPid) {
      throw new CodexFeasibilitySessionStateError('UTILITY_PID_MISMATCH');
    }
    this.utilityPid = utilityPid;
  }
}
