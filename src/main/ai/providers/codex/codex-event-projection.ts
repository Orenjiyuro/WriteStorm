import { Buffer } from 'node:buffer';
import {
  createAiExecutionEvent,
  type AiAttemptToken,
  type AiExecutionEvent,
  type AiExecutionEventInput,
} from '../../ai-execution-port';
import { AI_ATTEMPT_RESOURCE_CEILINGS } from '../../ai-attempt-controller';
import { CodexRuntimeDiagnosticAuthority } from './codex-runtime-diagnostics';

export type CodexEventProjectionRejection =
  | 'event_too_large'
  | 'resource_limit'
  | 'malformed_event'
  | 'unsupported_event';

export class CodexEventProjectionError extends Error {
  readonly code = 'CODEX_EVENT_PROJECTION_REJECTED' as const;

  constructor(readonly classification: CodexEventProjectionRejection) {
    super('Codex event projection was rejected.');
    this.name = 'CodexEventProjectionError';
  }
}

export class CodexStreamEventProjector {
  private readonly token: AiAttemptToken;
  private readonly maxEventBytes: number;
  private readonly maxTotalBytes: number;
  private readonly maxEventCount: number;
  private sequence = 0;
  private totalRawBytes = 0;
  private rawEventCount = 0;
  private completedAgentText: string | null = null;
  private readonly diagnostics = new CodexRuntimeDiagnosticAuthority();

  constructor(input: {
    readonly token: AiAttemptToken;
    readonly maxEventBytes: number;
    readonly maxTotalBytes: number;
    readonly maxEventCount: number;
  }) {
    if (!Number.isSafeInteger(input.token.attempt)
      || input.token.attempt < 1
      || !Number.isSafeInteger(input.token.generation)
      || input.token.generation < 1
      || !Number.isSafeInteger(input.maxEventBytes)
      || input.maxEventBytes < 1
      || input.maxEventBytes > AI_ATTEMPT_RESOURCE_CEILINGS.maxEventBytes
      || !Number.isSafeInteger(input.maxTotalBytes)
      || input.maxTotalBytes < input.maxEventBytes
      || input.maxTotalBytes > AI_ATTEMPT_RESOURCE_CEILINGS.maxTotalBytes
      || !Number.isSafeInteger(input.maxEventCount)
      || input.maxEventCount < 1
      || input.maxEventCount > AI_ATTEMPT_RESOURCE_CEILINGS.maxEventCount) {
      throw new CodexEventProjectionError('malformed_event');
    }
    this.token = Object.freeze({ ...input.token });
    this.maxEventBytes = input.maxEventBytes;
    this.maxTotalBytes = input.maxTotalBytes;
    this.maxEventCount = input.maxEventCount;
  }

  project(line: string): AiExecutionEvent {
    const rawBytes = typeof line === 'string'
      ? Buffer.byteLength(line, 'utf8')
      : this.maxEventBytes + 1;
    if (typeof line !== 'string' || rawBytes > this.maxEventBytes) {
      throw new CodexEventProjectionError('event_too_large');
    }
    if (this.rawEventCount + 1 > this.maxEventCount
      || this.totalRawBytes + rawBytes > this.maxTotalBytes) {
      throw new CodexEventProjectionError('resource_limit');
    }
    this.rawEventCount += 1;
    this.totalRawBytes += rawBytes;

    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new CodexEventProjectionError('malformed_event');
    }
    if (!isPlainRecord(raw) || typeof raw.type !== 'string') {
      throw new CodexEventProjectionError('malformed_event');
    }

    const metadata = {
      ...this.token,
      sequence: this.sequence + 1,
    };
    const projected = this.projectRecord(metadata, raw);
    this.sequence += 1;
    return projected;
  }

  private projectRecord(
    metadata: AiAttemptToken & { readonly sequence: number },
    raw: Readonly<Record<string, unknown>>,
  ): AiExecutionEvent {
    switch (raw.type) {
      case 'thread.started':
        if (typeof raw.thread_id !== 'string') malformed();
        return createAiExecutionEvent({ ...metadata, kind: 'progress' });
      case 'turn.started':
        return createAiExecutionEvent({ ...metadata, kind: 'progress' });
      case 'turn.completed':
        if (this.completedAgentText === null) malformed();
        return createAiExecutionEvent({
          ...metadata,
          kind: 'final',
          content: this.completedAgentText,
          usage: this.diagnostics.observeUsage(raw.usage),
        });
      case 'turn.failed':
        if (!isPlainRecord(raw.error) || typeof raw.error.message !== 'string') malformed();
        return createAiExecutionEvent({ ...metadata, kind: 'error' });
      case 'error':
        if (typeof raw.message !== 'string') malformed();
        return createAiExecutionEvent({ ...metadata, kind: 'error' });
      case 'item.started':
      case 'item.updated':
      case 'item.completed':
        return this.projectItemEvent(metadata, raw);
      default:
        throw new CodexEventProjectionError('unsupported_event');
    }
  }

  private projectItemEvent(
    metadata: AiAttemptToken & { readonly sequence: number },
    raw: Readonly<Record<string, unknown>>,
  ): AiExecutionEvent {
    if (!isPlainRecord(raw.item) || typeof raw.item.type !== 'string') {
      throw new CodexEventProjectionError('malformed_event');
    }
    if (typeof raw.item.id !== 'string') malformed();
    if (raw.item.type !== 'agent_message') {
      return createAiExecutionEvent({ ...metadata, kind: 'progress' });
    }
    if (raw.type === 'item.started') {
      return createAiExecutionEvent({ ...metadata, kind: 'progress' });
    }
    if (typeof raw.item.text !== 'string') {
      throw new CodexEventProjectionError('malformed_event');
    }
    if (raw.type === 'item.completed') this.completedAgentText = raw.item.text;
    const projected: AiExecutionEventInput = {
      ...metadata,
      kind: 'partial',
      content: raw.item.text,
    };
    return createAiExecutionEvent(projected);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function malformed(): never {
  throw new CodexEventProjectionError('malformed_event');
}
