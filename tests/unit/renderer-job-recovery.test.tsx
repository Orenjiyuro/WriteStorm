import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { JobRecoveryPanel } from '../../src/renderer/features/job-recovery/JobRecoveryPanel';
import type { JobDetail, JobSummary } from '../../src/shared/contracts';
import type { BreakdownBookId, JobId } from '../../src/shared/domain';

const bookId = 'book-job-recovery' as BreakdownBookId;
const failedJobId = 'job-failed-import' as JobId;
const resumableJobId = 'job-resumable-structure' as JobId;

const failedSummary: JobSummary = {
  id: failedJobId,
  bookId: null,
  state: 'failed',
  title: 'Import source',
  completedUnits: 0,
  totalUnits: 1,
  checkpointSummary: null,
  failureReason: 'SOURCE_IMPORT_WORKER_FAILED',
  updatedAt: '2026-07-16T08:00:00.000Z',
};

const resumableSummary: JobSummary = {
  id: resumableJobId,
  bookId,
  state: 'resumable',
  title: 'Detect structure',
  completedUnits: 1,
  totalUnits: 3,
  checkpointSummary: 'One durable checkpoint.',
  failureReason: 'STRUCTURE_WORKER_INTERRUPTED',
  updatedAt: '2026-07-16T09:00:00.000Z',
};

describe('JobRecoveryPanel', () => {
  it('shows Library-wide state, progress, failure reason, and durable checkpoints', () => {
    const detail: JobDetail = {
      ...resumableSummary,
      type: 'structure_detection',
      checkpoints: [{
        id: 'checkpoint-structure-1',
        jobId: resumableJobId,
        sequence: 1,
        kind: 'structure_detection_completed',
        payloadSchemaVersion: 1,
        payload: { structureSetId: 'set-1' },
        createdAt: '2026-07-16T08:55:00.000Z',
      }],
    };

    const markup = renderToStaticMarkup(createElement(JobRecoveryPanel, {
      jobs: [resumableSummary, failedSummary],
      selectedJobId: resumableJobId,
      detail,
      loading: false,
      detailLoading: false,
      error: null,
      cancelPending: false,
      bookTitles: { [bookId]: 'Recovery Book' },
      onSelectJob: vi.fn(),
      onCancelJob: vi.fn(),
    }));

    expect(markup).toContain('Jobs &amp; recovery');
    expect(markup).toContain('2 jobs');
    expect(markup).toContain('Library-level / unbound');
    expect(markup).toContain('Recovery Book');
    expect(markup).toContain('RESUMABLE');
    expect(markup).toContain('FAILED');
    expect(markup).toContain('1 / 3 units');
    expect(markup).toContain('STRUCTURE_WORKER_INTERRUPTED');
    expect(markup).toContain('Checkpoint 1');
    expect(markup).toContain('structure_detection_completed');
    expect(markup).not.toContain('[object Object]');
  });

  it('enables cancel for a resumable runtime-owned Job and keeps recovery actions honest', () => {
    const detail: JobDetail = {
      ...resumableSummary,
      type: 'structure_detection',
      checkpoints: [],
    };
    const markup = renderToStaticMarkup(createElement(JobRecoveryPanel, {
      jobs: [resumableSummary],
      selectedJobId: resumableJobId,
      detail,
      loading: false,
      detailLoading: false,
      error: null,
      cancelPending: false,
      onSelectJob: vi.fn(),
      onCancelJob: vi.fn(),
    }));

    expect(markup).toMatch(/<button[^>]*>Cancel job<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Resume<\/button>/);
    expect(markup).toContain('Resume is not implemented');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Keep draft<\/button>/);
    expect(markup).toContain('Structure draft recovery is not implemented');
  });

  it('does not invent Keep draft or Cancel for import and transactional module-shell Jobs', () => {
    const importMarkup = renderToStaticMarkup(createElement(JobRecoveryPanel, {
      jobs: [failedSummary],
      selectedJobId: failedJobId,
      detail: { ...failedSummary, type: 'source_import', checkpoints: [] },
      loading: false,
      detailLoading: false,
      error: null,
      cancelPending: false,
      onSelectJob: vi.fn(),
      onCancelJob: vi.fn(),
    }));
    const moduleSummary: JobSummary = {
      ...resumableSummary,
      id: 'job-module-shell' as JobId,
      state: 'completed',
      title: 'Create analysis module shells',
      completedUnits: 7,
      totalUnits: 7,
      failureReason: null,
    };
    const moduleMarkup = renderToStaticMarkup(createElement(JobRecoveryPanel, {
      jobs: [moduleSummary],
      selectedJobId: moduleSummary.id,
      detail: { ...moduleSummary, type: 'analysis_module_shell_creation', checkpoints: [] },
      loading: false,
      detailLoading: false,
      error: null,
      cancelPending: false,
      onSelectJob: vi.fn(),
      onCancelJob: vi.fn(),
    }));

    expect(importMarkup).not.toContain('Keep draft');
    expect(importMarkup).not.toContain('Cancel job');
    expect(moduleMarkup).not.toContain('Keep draft');
    expect(moduleMarkup).not.toContain('Cancel job');
  });
});
