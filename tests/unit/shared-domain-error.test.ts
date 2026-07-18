import { describe, expect, it } from 'vitest';
import {
  createDomainError,
  createNotImplementedError,
  DOMAIN_ERROR_CODES,
} from '../../src/shared/errors';
import type { DomainError } from '../../src/shared/errors';

const notImplementedError = createNotImplementedError('books:list');

const recoverableError = createDomainError({
  code: 'INVALID_REQUEST',
  message: 'Request payload did not match the channel contract.',
  recoverable: true,
  details: {
    channel: 'books:list',
    issueCount: 1,
    path: ['bookId'],
    received: null,
  },
});

const invalidDetails = createDomainError({
  code: 'INVALID_REQUEST',
  message: 'Invalid details.',
  recoverable: true,
  details: {
    // @ts-expect-error DomainError details must stay JSON-safe across IPC.
    generatedAt: new Date(),
  },
});

const invalidCode: DomainError = {
  // @ts-expect-error DomainError code must come from the stable allowlist.
  code: 'RANDOM_ERROR',
  message: 'Unstable code.',
  recoverable: false,
};

describe('shared domain errors', () => {
  it('keeps a stable code allowlist for cross-process errors', () => {
    expect(DOMAIN_ERROR_CODES).toEqual([
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
      'JOB_ERROR',
      'EXPORT_ERROR',
      'TYPE_LIBRARY_ERROR',
      'INTERNAL_ERROR',
    ]);
  });

  it('creates JSON-serializable domain errors with stable fields', () => {
    expect(recoverableError).toEqual({
      code: 'INVALID_REQUEST',
      message: 'Request payload did not match the channel contract.',
      recoverable: true,
      details: {
        channel: 'books:list',
        issueCount: 1,
        path: ['bookId'],
        received: null,
      },
    });
    expect(JSON.parse(JSON.stringify(recoverableError))).toEqual(recoverableError);
  });

  it('creates stable NOT_IMPLEMENTED errors for product channels without mock data', () => {
    expect(notImplementedError).toEqual({
      code: 'NOT_IMPLEMENTED',
      message: 'Channel books:list is not implemented.',
      recoverable: false,
      details: {
        channel: 'books:list',
      },
    });
  });
});
