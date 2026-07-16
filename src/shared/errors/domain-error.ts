export const DOMAIN_ERROR_CODES = [
  'NOT_IMPLEMENTED',
  'INVALID_REQUEST',
  'INVALID_RESPONSE',
  'UNTRUSTED_IPC_SENDER',
  'LIBRARY_ERROR',
  'LIBRARY_DATABASE_NOT_WRITESTORM',
  'DEV_SCHEMA_RESET_REQUIRED',
  'LIBRARY_SCHEMA_INCOMPATIBLE',
  'IMPORT_ERROR',
  'STRUCTURE_ERROR',
  'MODULE_ERROR',
  'INTERNAL_ERROR',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type DomainErrorDetails = {
  [key: string]: JsonValue;
};

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  recoverable: boolean;
  details?: DomainErrorDetails;
};

export function createDomainError(error: DomainError): DomainError {
  return {
    code: error.code,
    message: error.message,
    recoverable: error.recoverable,
    ...(error.details ? { details: error.details } : {}),
  };
}

export function createNotImplementedError(channel: string): DomainError {
  return createDomainError({
    code: 'NOT_IMPLEMENTED',
    message: `Channel ${channel} is not implemented.`,
    recoverable: false,
    details: {
      channel,
    },
  });
}
