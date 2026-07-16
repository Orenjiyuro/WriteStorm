import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { registerProductIpc } from '../../src/main/ipc';
import {
  createJobIpcDependencies,
  type JobIpcService,
} from '../../src/main/jobs/job-ipc';
import { JobServiceError } from '../../src/main/jobs/job-service';
import type {
  JobDetail,
  JobSummary,
  ProductIpcChannel,
} from '../../src/shared/contracts';
import type { BreakdownBookId, JobId } from '../../src/shared/domain';

const jobId = 'job-ipc' as JobId;
const bookId = 'book-ipc' as BreakdownBookId;
const summary: JobSummary = {
  id: jobId,
  bookId,
  state: 'running',
  title: 'Detect structure',
  completedUnits: 0,
  totalUnits: 1,
  checkpointSummary: null,
  failureReason: null,
  updatedAt: '2026-07-16T05:00:00.000Z',
};
const detail: JobDetail = {
  ...summary,
  type: 'structure_detection',
  checkpoints: [],
};

describe('Job IPC', () => {
  it('wires the real Job application service into main composition', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');
    expect(source).toContain('new JobApplicationService(');
    expect(source).toContain('jobs: createJobIpcDependencies(jobApplicationService)');
  });

  it('registers typed list/get/cancel handlers and returns JobDetail from get', async () => {
    const ipcMain = new MockIpcMain();
    const calls: unknown[] = [];
    const jobs = createJobIpcDependencies({
      list(requestedBookId) {
        calls.push(['list', requestedBookId]);
        return [summary];
      },
      get(requestedJobId) {
        calls.push(['get', requestedJobId]);
        return detail;
      },
      async cancel(requestedJobId) {
        calls.push(['cancel', requestedJobId]);
        return { ...summary, state: 'cancelled' };
      },
    });
    registerProductIpc(ipcMain, undefined, { jobs });

    await expect(ipcMain.invoke('jobs:list', {})).resolves.toEqual({ ok: true, data: [summary] });
    await expect(ipcMain.invoke('jobs:list', { bookId })).resolves.toEqual({ ok: true, data: [summary] });
    await expect(ipcMain.invoke('jobs:get', { jobId })).resolves.toEqual({ ok: true, data: detail });
    await expect(ipcMain.invoke('jobs:cancel', { jobId })).resolves.toEqual({
      ok: true,
      data: { ...summary, state: 'cancelled' },
    });
    expect(calls).toEqual([
      ['list', undefined],
      ['list', bookId],
      ['get', jobId],
      ['cancel', jobId],
    ]);
    await expect(ipcMain.invoke('exports:get-status', { bookId })).resolves.toMatchObject({
      ok: false,
      error: { code: 'NOT_IMPLEMENTED' },
    });
  });

  it('keeps invalid payload validation in front of Job handlers', async () => {
    const ipcMain = new MockIpcMain();
    let calls = 0;
    const jobs = createJobIpcDependencies({
      list: () => { calls += 1; return []; },
      get: () => { calls += 1; return null; },
      cancel: async () => { calls += 1; return summary; },
    });
    registerProductIpc(ipcMain, undefined, { jobs });

    await expect(ipcMain.invoke('jobs:get', { id: jobId })).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST', details: { channel: 'jobs:get' } },
    });
    expect(calls).toBe(0);
  });

  it('maps known service failures to stable JOB_ERROR envelopes', async () => {
    const service = {
      list: () => [],
      get: () => null,
      cancel: async () => { throw new JobServiceError('job_not_cancellable'); },
    } satisfies JobIpcService;
    const jobs = createJobIpcDependencies(service);

    await expect(jobs['jobs:cancel']({ jobId })).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'JOB_ERROR',
        recoverable: true,
        details: { reason: 'job_not_cancellable' },
      },
    });
  });
});

type MockListener = (event: { senderFrame: { url: string } }, payload: unknown) => unknown;

class MockIpcMain {
  readonly handlers = new Map<string, MockListener>();

  handle(channel: string, listener: MockListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown): Promise<unknown> {
    const listener = this.handlers.get(channel);
    if (!listener) throw new Error(`Missing handler for ${channel}`);
    return Promise.resolve(listener({ senderFrame: { url: 'writestorm://app/index.html' } }, payload));
  }
}
