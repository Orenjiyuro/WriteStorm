import type {
  ContractRequest,
  ContractResponse,
  ModuleInstanceSummary,
} from '../../shared/contracts';
import { createDomainError } from '../../shared/errors';
import {
  AnalysisModuleInstanceServiceError,
} from './analysis-module-instance-service';

export type AnalysisModuleInstanceListService = {
  list(bookId: ContractRequest<'modules:list-instances'>['bookId']): ModuleInstanceSummary[];
};

export type AnalysisModuleInstanceIpcDependencies = {
  readonly 'modules:list-instances': (
    request: ContractRequest<'modules:list-instances'>,
  ) => Promise<ContractResponse<'modules:list-instances'>>;
};

export function createAnalysisModuleInstanceIpcDependencies(
  service: AnalysisModuleInstanceListService,
): AnalysisModuleInstanceIpcDependencies {
  return {
    'modules:list-instances': async (request) => {
      try {
        return { ok: true, data: service.list(request.bookId) };
      } catch (error) {
        if (!(error instanceof AnalysisModuleInstanceServiceError)) throw error;
        return {
          ok: false,
          error: createDomainError({
            code: 'MODULE_ERROR',
            message: error.message,
            recoverable: isRecoverableModuleBlocker(error.reason),
            details: { reason: error.reason, blockers: [error.reason] },
          }),
        };
      }
    },
  };
}

function isRecoverableModuleBlocker(
  reason: AnalysisModuleInstanceServiceError['reason'],
): boolean {
  switch (reason) {
    case 'no_current_library':
    case 'book_not_found':
    case 'structure_not_frozen':
    case 'structure_snapshot_mismatch':
      return true;
    case 'module_contract_unavailable':
    case 'book_scope_instances_incomplete':
      return false;
  }
}
