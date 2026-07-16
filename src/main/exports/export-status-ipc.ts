import type {
  ContractRequest,
  ContractResponse,
  ExportStatusDto,
} from '../../shared/contracts';
import { createDomainError } from '../../shared/errors';
import {
  ExportStatusServiceError,
} from './export-status-service';

export type ExportStatusIpcService = {
  getStatus(
    bookId: ContractRequest<'exports:get-status'>['bookId'],
  ): ExportStatusDto;
};

export type ExportStatusIpcDependencies = {
  readonly 'exports:get-status': (
    request: ContractRequest<'exports:get-status'>,
  ) => Promise<ContractResponse<'exports:get-status'>>;
};

export function createExportStatusIpcDependencies(
  service: ExportStatusIpcService,
): ExportStatusIpcDependencies {
  return {
    'exports:get-status': async (request) => {
      try {
        return { ok: true, data: service.getStatus(request.bookId) };
      } catch (error) {
        if (!(error instanceof ExportStatusServiceError)) throw error;
        return {
          ok: false,
          error: createDomainError({
            code: 'EXPORT_ERROR',
            message: error.message,
            recoverable: isRecoverableExportStatusError(error.reason),
            details: { reason: error.reason },
          }),
        };
      }
    },
  };
}

function isRecoverableExportStatusError(
  reason: ExportStatusServiceError['reason'],
): boolean {
  return reason === 'no_current_library' || reason === 'book_not_found';
}
