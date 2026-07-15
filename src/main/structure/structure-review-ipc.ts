import type { ContractRequest, ContractResponse } from '../../shared/contracts';
import { createDomainError } from '../../shared/errors';
import { LibraryUnitOfWorkError } from '../library/library-unit-of-work';
import { StructureServiceError } from './structure-service';
import { StructureSourceSnapshotError } from './structure-source-snapshot';

type ReviewChannel =
  | 'structure:get'
  | 'structure:create-draft'
  | 'structure:create-manual-draft'
  | 'structure:discard-draft'
  | 'structure:update-node'
  | 'structure:update-story-range'
  | 'structure:freeze'
  | 'structure:unfreeze';

export type StructureReviewIpcDependencies = {
  readonly [Channel in ReviewChannel]: (
    request: ContractRequest<Channel>,
  ) => Promise<ContractResponse<Channel>>;
};

export type StructureReviewService = {
  getWorkspace(bookId: ContractRequest<'structure:get'>['bookId']): Promise<unknown>;
  createDraft(bookId: ContractRequest<'structure:create-draft'>['bookId'], candidateSetId: ContractRequest<'structure:create-draft'>['candidateSetId'], replacementFrozenSetId?: ContractRequest<'structure:create-draft'>['replacementFrozenSetId']): unknown;
  createManualDraft(bookId: ContractRequest<'structure:create-manual-draft'>['bookId'], expectedFailedDetectionRunId: ContractRequest<'structure:create-manual-draft'>['expectedFailedDetectionRunId']): Promise<unknown>;
  discardDraft(bookId: ContractRequest<'structure:discard-draft'>['bookId'], draftSetId: ContractRequest<'structure:discard-draft'>['draftSetId'], expectedDraftRevision: number): unknown;
  updateNode(bookId: ContractRequest<'structure:update-node'>['bookId'], draftSetId: ContractRequest<'structure:update-node'>['draftSetId'], expectedDraftRevision: number, command: ContractRequest<'structure:update-node'>['command']): unknown;
  updateStoryRange(bookId: ContractRequest<'structure:update-story-range'>['bookId'], draftSetId: ContractRequest<'structure:update-story-range'>['draftSetId'], expectedDraftRevision: number, command: ContractRequest<'structure:update-story-range'>['command']): unknown;
  freeze(bookId: ContractRequest<'structure:freeze'>['bookId'], draftSetId: ContractRequest<'structure:freeze'>['draftSetId'], expectedDraftRevision: number): Promise<unknown>;
  unfreeze(bookId: ContractRequest<'structure:unfreeze'>['bookId'], frozenSetId: ContractRequest<'structure:unfreeze'>['frozenSetId']): unknown;
};

export function createStructureReviewIpcDependencies(
  service: StructureReviewService,
): StructureReviewIpcDependencies {
  const invoke = async <Channel extends ReviewChannel>(
    operation: () => unknown | Promise<unknown>,
  ): Promise<ContractResponse<Channel>> => {
    try {
      return { ok: true, data: await operation() } as ContractResponse<Channel>;
    } catch (error) {
      return structureIpcErrorResponse<Channel>(error);
    }
  };
  return {
    'structure:get': (request) => invoke<'structure:get'>(() => service.getWorkspace(request.bookId)),
    'structure:create-draft': (request) => invoke<'structure:create-draft'>(() => service.createDraft(request.bookId, request.candidateSetId, request.replacementFrozenSetId)),
    'structure:create-manual-draft': (request) => invoke<'structure:create-manual-draft'>(() => service.createManualDraft(request.bookId, request.expectedFailedDetectionRunId)),
    'structure:discard-draft': (request) => invoke<'structure:discard-draft'>(() => service.discardDraft(request.bookId, request.draftSetId, request.expectedDraftRevision)),
    'structure:update-node': (request) => invoke<'structure:update-node'>(() => service.updateNode(request.bookId, request.draftSetId, request.expectedDraftRevision, request.command)),
    'structure:update-story-range': (request) => invoke<'structure:update-story-range'>(() => service.updateStoryRange(request.bookId, request.draftSetId, request.expectedDraftRevision, request.command)),
    'structure:freeze': (request) => invoke<'structure:freeze'>(() => service.freeze(request.bookId, request.draftSetId, request.expectedDraftRevision)),
    'structure:unfreeze': (request) => invoke<'structure:unfreeze'>(() => service.unfreeze(request.bookId, request.frozenSetId)),
  };
}

export function structureIpcErrorResponse<Channel extends ReviewChannel | 'structure:detect' | 'structure:recover-detection'>(
  error: unknown,
): ContractResponse<Channel> {
  let reason: string;
  let message: string;
  let details: Record<string, unknown> = {};
  if (error instanceof StructureServiceError) {
    reason = error.reason;
    message = error.message;
    details = {
      ...(error.expectedDraftRevision === undefined ? {} : { expectedDraftRevision: error.expectedDraftRevision }),
      ...(error.actualDraftRevision === undefined ? {} : { actualDraftRevision: error.actualDraftRevision }),
      ...(error.reason === 'draft_revision_mismatch' ? { refreshRequired: true } : {}),
      ...(error.blockers.length === 0 && error.reason !== 'draft_revision_mismatch'
        ? {} : { blockers: error.blockers }),
    };
  } else if (error instanceof StructureSourceSnapshotError) {
    reason = error.reason;
    message = error.message;
  } else if (error instanceof LibraryUnitOfWorkError) {
    reason = error.code === 'LIBRARY_SESSION_REQUIRED' ? 'no_current_library' : 'library_session_changed';
    message = error.message;
  } else {
    throw error;
  }
  return {
    ok: false,
    error: createDomainError({
      code: 'STRUCTURE_ERROR', message, recoverable: true, details: { reason, ...details },
    }),
  } as ContractResponse<Channel>;
}
