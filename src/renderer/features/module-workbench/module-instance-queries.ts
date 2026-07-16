import { queryOptions } from '@tanstack/react-query';
import type {
  ContractRequest,
  ModuleInstanceSummary,
} from '../../../shared/contracts';
import type { WritestormApi } from '../../../shared/contracts/preload-api';

export const moduleInstanceKeys = {
  instances: (sessionId: string, bookId: string) =>
    ['library-session', sessionId, 'module-instances', bookId] as const,
};

export function moduleInstancesQueryOptions(
  sessionId: string,
  bookId: ContractRequest<'modules:list-instances'>['bookId'],
  api: Pick<WritestormApi, 'modules'>,
) {
  return queryOptions({
    queryKey: moduleInstanceKeys.instances(sessionId, bookId),
    queryFn: async (): Promise<ModuleInstanceSummary[]> => {
      const response = await api.modules.listInstances({ bookId });
      if (!response.ok) throw response.error;
      return response.data;
    },
  });
}
