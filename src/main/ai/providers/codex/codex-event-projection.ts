import { Buffer } from 'node:buffer';
import {
  createAiExecutionEvent,
  type AiAttemptToken,
  type AiExecutionEvent,
  type AiExecutionEventInput,
} from '../../ai-execution-port';
import { AI_ATTEMPT_RESOURCE_CEILINGS } from '../../ai-attempt-controller';

export type CodexEventProjectionRejection =
  | 'event_too_large'
  | 'malformed_event'
  | 'unsupported_event';

export class CodexEventProjectionError extends Error {
  readonly code = 'CODEX_EVENT_PROJECTION_REJECTED' as const;

  constructor(readonly classification: CodexEventProjectionRejection) {
    super('Codex event projection was rejected.');
    this.name = 'CodexEventProjectionError';
  }
}

export function projectCodexStreamLine(input: {
  readonly token: AiAttemptToken;
  readonly sequence: number;
  readonly line: string;
  readonly maxEventBytes: number;
}): AiExecutionEvent {
  if (typeof input.line !== 'string'
    || !Number.isSafeInteger(input.maxEventBytes)
    || input.maxEventBytes < 1
    || input.maxEventBytes > AI_ATTEMPT_RESOURCE_CEILINGS.maxEventBytes
    || Buffer.byteLength(input.line, 'utf8') > input.maxEventBytes) {
    throw new CodexEventProjectionError('event_too_large');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input.line);
  } catch {
    throw new CodexEventProjectionError('malformed_event');
  }
  if (!isPlainRecord(raw) || typeof raw.type !== 'string') {
    throw new CodexEventProjectionError('malformed_event');
  }

  const metadata = {
    ...input.token,
    sequence: input.sequence,
  };
  switch (raw.type) {
    case 'thread.started':
      if (typeof raw.thread_id !== 'string') malformed();
      return createAiExecutionEvent({ ...metadata, kind: 'progress' });
    case 'turn.started':
      return createAiExecutionEvent({ ...metadata, kind: 'progress' });
    case 'turn.completed':
      if (!isPlainRecord(raw.usage)) malformed();
      return createAiExecutionEvent({ ...metadata, kind: 'progress' });
    case 'turn.failed':
      if (!isPlainRecord(raw.error) || typeof raw.error.message !== 'string') malformed();
      return createAiExecutionEvent({ ...metadata, kind: 'error' });
    case 'error':
      if (typeof raw.message !== 'string') malformed();
      return createAiExecutionEvent({ ...metadata, kind: 'error' });
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      return projectItemEvent(metadata, raw);
    default:
      throw new CodexEventProjectionError('unsupported_event');
  }
}

function projectItemEvent(
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
  const projected: AiExecutionEventInput = raw.type === 'item.completed'
    ? { ...metadata, kind: 'final', content: raw.item.text }
    : { ...metadata, kind: 'partial', content: raw.item.text };
  return createAiExecutionEvent(projected);
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
