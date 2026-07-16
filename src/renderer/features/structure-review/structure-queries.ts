import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import type { ContractRequest } from '../../../shared/contracts';
import type { StructureWorkspace } from '../../../shared/contracts/structure';
import type { WritestormApi } from '../../../shared/contracts/preload-api';
import { jobKeys } from '../job-recovery/job-queries';
import { moduleInstanceKeys } from '../module-workbench/module-instance-queries';
import { exportStatusKeys } from '../export-status/export-status-queries';

export const structureKeys = {
  workspace: (sessionId: string, bookId: string) =>
    ['library-session', sessionId, 'structure-workspace', bookId] as const,
};

export function structureWorkspaceQueryOptions(
  sessionId: string,
  bookId: ContractRequest<'structure:get'>['bookId'],
  api: Pick<WritestormApi, 'structure'>,
) {
  return queryOptions({
    queryKey: structureKeys.workspace(sessionId, bookId),
    queryFn: async (): Promise<StructureWorkspace> => {
      const response = await api.structure.get({ bookId });
      if (!response.ok) throw response.error;
      return response.data;
    },
    refetchInterval: (query) => {
      if (query.state.data?.capabilities.blockers.includes('structure_detection_recovery_required')) {
        return false;
      }
      const state = query.state.data?.latestDetectionRun?.state;
      return state === 'queued' || state === 'running' ? 500 : false;
    },
  });
}

export function createStructureActionMutationOptions(
  sessionId: string,
  bookId: ContractRequest<'structure:get'>['bookId'],
  api: Pick<WritestormApi, 'structure'>,
) {
  return mutationOptions({
    mutationFn: async (action: { readonly type: 'detect' } | { readonly type: 'recover-detection' } | {
      readonly type: 'create-draft';
      readonly candidateSetId: ContractRequest<'structure:create-draft'>['candidateSetId'];
      readonly replacementFrozenSetId?: ContractRequest<'structure:create-draft'>['replacementFrozenSetId'];
    } | {
      readonly type: 'create-manual-draft';
      readonly expectedFailedDetectionRunId: ContractRequest<'structure:create-manual-draft'>['expectedFailedDetectionRunId'];
    } | {
      readonly type: 'update-node';
      readonly draftSetId: ContractRequest<'structure:update-node'>['draftSetId'];
      readonly expectedDraftRevision: number;
      readonly command: ContractRequest<'structure:update-node'>['command'];
    } | {
      readonly type: 'update-range';
      readonly draftSetId: ContractRequest<'structure:update-story-range'>['draftSetId'];
      readonly expectedDraftRevision: number;
      readonly command: ContractRequest<'structure:update-story-range'>['command'];
    } | {
      readonly type: 'discard-draft';
      readonly draftSetId: ContractRequest<'structure:discard-draft'>['draftSetId'];
      readonly expectedDraftRevision: number;
    } | {
      readonly type: 'freeze';
      readonly draftSetId: ContractRequest<'structure:freeze'>['draftSetId'];
      readonly expectedDraftRevision: number;
    } | {
      readonly type: 'unfreeze';
      readonly frozenSetId: ContractRequest<'structure:unfreeze'>['frozenSetId'];
    }): Promise<void> => {
      const response = action.type === 'detect'
        ? await api.structure.detect({ bookId })
        : action.type === 'recover-detection' ? await api.structure.recoverDetection({ bookId })
        : action.type === 'create-draft' ? await api.structure.createDraft({
          bookId,
          candidateSetId: action.candidateSetId,
          ...(action.replacementFrozenSetId === undefined
            ? {} : { replacementFrozenSetId: action.replacementFrozenSetId }),
        }) : action.type === 'create-manual-draft' ? await api.structure.createManualDraft({
          bookId, expectedFailedDetectionRunId: action.expectedFailedDetectionRunId,
        }) : action.type === 'update-node' ? await api.structure.updateNode({
          bookId, draftSetId: action.draftSetId,
          expectedDraftRevision: action.expectedDraftRevision, command: action.command,
        }) : action.type === 'update-range' ? await api.structure.updateStoryRange({
          bookId, draftSetId: action.draftSetId,
          expectedDraftRevision: action.expectedDraftRevision, command: action.command,
        }) : action.type === 'discard-draft' ? await api.structure.discardDraft({
          bookId, draftSetId: action.draftSetId, expectedDraftRevision: action.expectedDraftRevision,
        }) : action.type === 'freeze' ? await api.structure.freeze({
          bookId, draftSetId: action.draftSetId, expectedDraftRevision: action.expectedDraftRevision,
        }) : await api.structure.unfreeze({
          bookId, frozenSetId: action.frozenSetId,
        });
      if (!response.ok) throw response.error;
    },
    onSuccess: async (_data, action, _context, mutation) => {
      const queryClient = mutation.client as QueryClient;
      const invalidations: Promise<unknown>[] = [];
      if (action.type === 'freeze') {
        invalidations.push(queryClient.invalidateQueries({
          queryKey: moduleInstanceKeys.instances(sessionId, bookId),
        }));
      }
      if (action.type === 'freeze' || action.type === 'unfreeze') {
        invalidations.push(queryClient.invalidateQueries({
          queryKey: exportStatusKeys.status(sessionId, bookId),
        }));
      }
      await Promise.all(invalidations);
    },
    onSettled: async (_data, _error, _action, _context, mutation) => {
      const queryClient = mutation.client as QueryClient;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: structureKeys.workspace(sessionId, bookId) }),
        queryClient.invalidateQueries({ queryKey: jobKeys.all(sessionId) }),
      ]);
    },
  });
}
