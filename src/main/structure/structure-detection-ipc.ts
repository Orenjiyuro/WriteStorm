import type { ContractRequest, ContractResponse } from '../../shared/contracts';
import type { StructureDetectionStartResult } from '../../shared/contracts/structure';
import { createDomainError } from '../../shared/errors';
import { StructureServiceError, type DetectStructureOptions } from './structure-service';
import { StructureSourceSnapshotError } from './structure-source-snapshot';

export type StructureDetectionIpcDependencies = {
  readonly detect: (
    request: ContractRequest<'structure:detect'>,
  ) => Promise<ContractResponse<'structure:detect'>>;
};

export type StructureDetectionIpcOptions = {
  readonly service: {
    startDetection(
      bookId: ContractRequest<'structure:detect'>['bookId'],
      options: DetectStructureOptions,
    ): Promise<StructureDetectionStartResult>;
  };
  readonly timeoutMs: number;
};

export function createStructureDetectionIpcDependencies(
  options: StructureDetectionIpcOptions,
): StructureDetectionIpcDependencies {
  return {
    detect: async (request) => {
      try {
        return {
          ok: true,
          data: await options.service.startDetection(request.bookId, {
            timeoutMs: options.timeoutMs,
          }),
        };
      } catch (error) {
        if (!(error instanceof StructureServiceError) &&
          !(error instanceof StructureSourceSnapshotError)) {
          throw error;
        }

        return {
          ok: false,
          error: createDomainError({
            code: 'STRUCTURE_ERROR',
            message: error.message,
            recoverable: true,
            details: {
              reason: error.reason,
            },
          }),
        };
      }
    },
  };
}
