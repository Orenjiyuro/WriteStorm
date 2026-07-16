import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';
import type { JobDetail, JobSummary } from '../../../shared/contracts';
import type { WritestormApi } from '../../../shared/contracts/preload-api';
import type { JobId } from '../../../shared/domain';

const ACTIVELY_PROGRESSING_JOB_STATES = new Set([
  'queued',
  'estimating',
  'waiting_confirmation',
  'running',
]);

export function isJobStateActivelyProgressing(state: JobSummary['state']): boolean {
  return ACTIVELY_PROGRESSING_JOB_STATES.has(state);
}

export const jobKeys = {
  all: (sessionId: string) => ['library-session', sessionId, 'jobs'] as const,
  detail: (sessionId: string, jobId: JobId) =>
    ['library-session', sessionId, 'job', jobId] as const,
};

export function jobListQueryOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'jobs'>,
) {
  return queryOptions({
    queryKey: jobKeys.all(sessionId),
    queryFn: async (): Promise<JobSummary[]> => {
      const response = await api.jobs.list();
      if (!response.ok) throw response.error;
      return response.data;
    },
    refetchInterval: (query) => query.state.data?.some(
      (job) => isJobStateActivelyProgressing(job.state),
    ) ? 500 : false,
  });
}

export function jobDetailQueryOptions(
  sessionId: string,
  jobId: JobId,
  api: Pick<WritestormApi, 'jobs'>,
) {
  return queryOptions({
    queryKey: jobKeys.detail(sessionId, jobId),
    queryFn: async (): Promise<JobDetail | null> => {
      const response = await api.jobs.get({ jobId });
      if (!response.ok) throw response.error;
      return response.data;
    },
    refetchInterval: (query) => query.state.data &&
      isJobStateActivelyProgressing(query.state.data.state) ? 500 : false,
  });
}

export function createCancelJobMutationOptions(
  sessionId: string,
  api: Pick<WritestormApi, 'jobs'>,
) {
  return mutationOptions({
    mutationFn: async (jobId: JobId): Promise<JobSummary> => {
      const response = await api.jobs.cancel({ jobId });
      if (!response.ok) throw response.error;
      return response.data;
    },
    onSuccess: async (_result, jobId, _context, mutation) => {
      const queryClient = mutation.client as QueryClient;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jobKeys.all(sessionId) }),
        queryClient.invalidateQueries({ queryKey: jobKeys.detail(sessionId, jobId) }),
      ]);
    },
  });
}
