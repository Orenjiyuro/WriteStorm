import type { ContractRequest, ContractResponse } from '../../shared/contracts';
import type { StructureDetectionStartResult } from '../../shared/contracts/structure';
import { type DetectStructureOptions } from './structure-service';
import { structureIpcErrorResponse } from './structure-review-ipc';

export type StructureDetectionIpcDependencies = {
  readonly detect: (
    request: ContractRequest<'structure:detect'>,
  ) => Promise<ContractResponse<'structure:detect'>>;
  readonly recoverDetection: (
    request: ContractRequest<'structure:recover-detection'>,
  ) => Promise<ContractResponse<'structure:recover-detection'>>;
};

export type StructureDetectionIpcOptions = {
  readonly service: {
    startDetection(
      bookId: ContractRequest<'structure:detect'>['bookId'],
      options: DetectStructureOptions,
    ): Promise<StructureDetectionStartResult>;
    recoverDetection?(
      bookId: ContractRequest<'structure:recover-detection'>['bookId'],
    ): StructureDetectionStartResult;
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
        return structureIpcErrorResponse<'structure:detect'>(error);
      }
    },
    recoverDetection: async (request) => {
      try {
        if (!options.service.recoverDetection) throw new Error('Structure detection recovery is unavailable.');
        return { ok: true, data: options.service.recoverDetection(request.bookId) };
      } catch (error) {
        return structureIpcErrorResponse<'structure:recover-detection'>(error);
      }
    },
  };
}
