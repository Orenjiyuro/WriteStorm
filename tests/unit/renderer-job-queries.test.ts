import { QueryClient } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createCancelJobMutationOptions,
  jobDetailQueryOptions,
  jobKeys,
  jobListQueryOptions,
  isJobStateActivelyProgressing,
} from '../../src/renderer/features/job-recovery/job-queries';
import type { ContractResponse, JobDetail, JobSummary } from '../../src/shared/contracts';
import type { WritestormApi } from '../../src/shared/contracts/preload-api';
import type { JobId } from '../../src/shared/domain';

const sessionId = 'session-job-query';
const jobId = 'job-query' as JobId;
const summary: JobSummary = {
  id: jobId,
  bookId: null,
  state: 'queued',
  title: 'Import source',
  completedUnits: 0,
  totalUnits: 1,
  checkpointSummary: null,
  failureReason: null,
  updatedAt: '2026-07-16T10:00:00.000Z',
};
const detail: JobDetail = { ...summary, type: 'source_import', checkpoints: [] };

describe('renderer Job queries', () => {
  it('polls only states that may actively progress without a renderer action', () => {
    expect(['queued', 'estimating', 'waiting_confirmation', 'running'].map(
      (state) => isJobStateActivelyProgressing(state as JobSummary['state']),
    )).toEqual([true, true, true, true]);
    expect(['paused', 'failed', 'resumable', 'cancelled', 'completed'].map(
      (state) => isJobStateActivelyProgressing(state as JobSummary['state']),
    )).toEqual([false, false, false, false, false]);
  });

  it('keys Library-wide list and persisted detail by session identity', async () => {
    const queryClient = createQueryClient();
    const list = vi.fn(async (): Promise<ContractResponse<'jobs:list'>> => ({ ok: true, data: [summary] }));
    const get = vi.fn(async (): Promise<ContractResponse<'jobs:get'>> => ({ ok: true, data: detail }));
    const api = jobApi({ list, get });

    await expect(queryClient.fetchQuery(jobListQueryOptions(sessionId, api))).resolves.toEqual([summary]);
    await expect(queryClient.fetchQuery(jobDetailQueryOptions(sessionId, jobId, api))).resolves.toEqual(detail);
    expect(jobKeys.all(sessionId)).toEqual(['library-session', sessionId, 'jobs']);
    expect(jobKeys.detail(sessionId, jobId)).toEqual(['library-session', sessionId, 'job', jobId]);
    expect(list).toHaveBeenCalledWith();
    expect(get).toHaveBeenCalledWith({ jobId });
  });

  it('invalidates list and detail only after a successful cancellation', async () => {
    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const cancel = vi.fn(async (): Promise<ContractResponse<'jobs:cancel'>> => ({
      ok: true,
      data: { ...summary, state: 'cancelled' },
    }));
    const mutation = queryClient.getMutationCache().build(
      queryClient,
      createCancelJobMutationOptions(sessionId, jobApi({ cancel })),
    );

    await mutation.execute(jobId);
    expect(cancel).toHaveBeenCalledWith({ jobId });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: jobKeys.all(sessionId) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: jobKeys.detail(sessionId, jobId) });
  });

  it('connects the current Library query and cancel mutation to the Breakdown shelf', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');
    expect(source).toContain('jobListQueryOptions(');
    expect(source).toContain('jobDetailQueryOptions(');
    expect(source).toContain('createCancelJobMutationOptions(');
    expect(source).toContain('jobRecovery={');
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

function jobApi(overrides: Partial<WritestormApi['jobs']>): Pick<WritestormApi, 'jobs'> {
  const unavailable = async () => { throw new Error('not configured'); };
  return {
    jobs: {
      list: overrides.list ?? unavailable,
      get: overrides.get ?? unavailable,
      cancel: overrides.cancel ?? unavailable,
    },
  };
}
