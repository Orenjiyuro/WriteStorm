import type {
  ContractRequest,
  ContractResponse,
} from '../../shared/contracts';
import type {
  BookClassificationTarget,
  BookTypeBindingDetail,
  BreakdownBookId,
  TypeLibraryReleaseOptions,
} from '../../shared/domain';
import { createDomainError } from '../../shared/errors';
import {
  TypeLibraryServiceError,
  type TypeLibraryServiceErrorReason,
  type UpdateBookTypeBindingCommand,
} from './type-library-service';

export type TypeLibraryIpcService = {
  listReleaseOptions(version?: number): TypeLibraryReleaseOptions;
  getBookBindingDetail(bookId: BreakdownBookId): BookTypeBindingDetail | null;
  updateBookBinding(command: UpdateBookTypeBindingCommand): BookClassificationTarget;
};

export type TypeLibraryIpcDependencies = {
  readonly 'type-library:list-options': (
    request: ContractRequest<'type-library:list-options'>,
  ) => Promise<ContractResponse<'type-library:list-options'>>;
  readonly 'type-library:get-book-binding': (
    request: ContractRequest<'type-library:get-book-binding'>,
  ) => Promise<ContractResponse<'type-library:get-book-binding'>>;
  readonly 'type-library:update-book-binding': (
    request: ContractRequest<'type-library:update-book-binding'>,
  ) => Promise<ContractResponse<'type-library:update-book-binding'>>;
};

export function createTypeLibraryIpcDependencies(
  service: TypeLibraryIpcService,
): TypeLibraryIpcDependencies {
  return {
    'type-library:list-options': async (request) => invoke(
      () => service.listReleaseOptions(request.version),
    ),
    'type-library:get-book-binding': async (request) => invoke(
      () => service.getBookBindingDetail(request.bookId),
    ),
    'type-library:update-book-binding': async (request) => invoke(
      () => service.updateBookBinding(request),
    ),
  };
}

async function invoke<T>(operation: () => T): Promise<{
  readonly ok: true;
  readonly data: T;
} | {
  readonly ok: false;
  readonly error: ReturnType<typeof createDomainError>;
}> {
  try {
    return { ok: true, data: operation() };
  } catch (error) {
    if (!(error instanceof TypeLibraryServiceError)) throw error;
    return {
      ok: false,
      error: createDomainError({
        code: 'TYPE_LIBRARY_ERROR',
        message: error.message,
        recoverable: isRecoverable(error.reason),
        details: { reason: error.reason },
      }),
    };
  }
}

function isRecoverable(reason: TypeLibraryServiceErrorReason): boolean {
  return reason !== 'invalid_persisted_book_type_binding';
}
