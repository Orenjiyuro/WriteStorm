import { queryOptions } from '@tanstack/react-query';
import type {
  ContractRequest,
  ExportStatusDto,
} from '../../../shared/contracts';
import type { WritestormApi } from '../../../shared/contracts/preload-api';

export const exportStatusKeys = {
  status: (sessionId: string, bookId: string) =>
    ['library-session', sessionId, 'export-status', bookId] as const,
};

export function exportStatusQueryOptions(
  sessionId: string,
  bookId: ContractRequest<'exports:get-status'>['bookId'],
  api: Pick<WritestormApi, 'exports'>,
) {
  return queryOptions({
    queryKey: exportStatusKeys.status(sessionId, bookId),
    queryFn: async (): Promise<ExportStatusDto> => {
      const response = await api.exports.getStatus({ bookId });
      if (!response.ok) throw response.error;
      return response.data;
    },
  });
}
