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

export type AiAttemptToken = {
  readonly attempt: number;
  readonly generation: number;
};

type AiExecutionEventMetadata = AiAttemptToken & {
  readonly [eventBrand]: never;
  readonly sequence: number;
};

export type AiExecutionEvent =
  | (AiExecutionEventMetadata & {
    readonly kind: 'progress';
  })
  | (AiExecutionEventMetadata & {
    readonly kind: 'partial';
    readonly content: string;
  })
  | (AiExecutionEventMetadata & {
    readonly kind: 'final';
    readonly content: string;
  })
  | (AiExecutionEventMetadata & {
    readonly kind: 'error';
  });

export type AiExecutionEventInput =
  | (AiAttemptToken & {
    readonly sequence: number;
    readonly kind: 'progress';
  })
  | (AiAttemptToken & {
    readonly sequence: number;
    readonly kind: 'partial';
    readonly content: string;
  })
  | (AiAttemptToken & {
    readonly sequence: number;
    readonly kind: 'final';
    readonly content: string;
  })
  | (AiAttemptToken & {
    readonly sequence: number;
    readonly kind: 'error';
  });

export class AiExecutionEventSchemaError extends Error {
  readonly code = 'AI_EXECUTION_EVENT_INVALID' as const;

  constructor() {
    super('AI execution event is invalid.');
    this.name = 'AiExecutionEventSchemaError';
  }
}

export function createAiExecutionEvent(input: AiExecutionEventInput): AiExecutionEvent {
  if (!isPlainRecord(input)
    || !isPositiveSafeInteger(input.attempt)
    || !isPositiveSafeInteger(input.generation)
    || !isPositiveSafeInteger(input.sequence)) {
    throw new AiExecutionEventSchemaError();
  }

  const baseKeys = ['attempt', 'generation', 'sequence', 'kind'];
  if (input.kind === 'partial' || input.kind === 'final') {
    if (typeof input.content !== 'string'
      || !hasExactKeys(input, [...baseKeys, 'content'])) {
      throw new AiExecutionEventSchemaError();
    }
  } else if ((input.kind !== 'progress' && input.kind !== 'error')
    || !hasExactKeys(input, baseKeys)) {
    throw new AiExecutionEventSchemaError();
  }

  return Object.freeze({ ...input }) as AiExecutionEvent;
}

export interface AiExecutionHandle {
  readonly [handleBrand]: never;
}

export interface AiExecutionPort {
  readonly capabilities: AiExecutionCapabilities;
  execute(request: AiExecutionRequest): AiExecutionHandle;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}
