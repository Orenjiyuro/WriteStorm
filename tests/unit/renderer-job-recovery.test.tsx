import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { JobRecoveryPanel } from '../../src/renderer/features/job-recovery/JobRecoveryPanel';
import type { ExportStatusDto, JobDetail, JobSummary } from '../../src/shared/contracts';
import {
  EXPORT_EXCLUDED_CONTENT_KINDS,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  type BreakdownBookId,
  type JobId,
} from '../../src/shared/domain';

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
const exportStatus: ExportStatusDto = {
  bookId,
  targets: [
    {
      kind: 'markdown_package',
      availability: 'blocked',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
      preview: emptyExportPreview(),
    },
    {
      kind: 'machine_package',
      availability: 'unavailable',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
      preview: emptyExportPreview(),
    },
  ],
  owners: [...EXPORT_OWNER_RUNTIME_POLICY],
  excludedContent: [...EXPORT_EXCLUDED_CONTENT_KINDS],
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

  it('shows Export readiness as a separate non-Job summary without changing JobSummary data', () => {
    const jobs: readonly JobSummary[] = [resumableSummary];
    const jobsBeforeRender = structuredClone(jobs);
    const markup = renderToStaticMarkup(createElement(JobRecoveryPanel, {
      jobs,
      selectedJobId: resumableJobId,
      detail: null,
      loading: false,
      detailLoading: false,
      error: null,
      cancelPending: false,
      exportReadiness: {
        bookTitle: 'Recovery Book',
        status: exportStatus,
        loading: false,
        error: null,
      },
      onSelectJob: vi.fn(),
      onCancelJob: vi.fn(),
    }));

    expect(markup).toContain('1 job');
    expect(markup).toContain('Export readiness (not a Job)');
    expect(markup).toContain('Recovery Book');
    expect(markup).toContain('Markdown package');
    expect(markup).toContain('Blocked');
    expect(markup).toContain('Machine package');
    expect(markup).toContain('Unavailable');
    expect(markup).toContain('export_execution_not_admitted');
    expect(markup).toContain('data-not-job="true"');
    expect(markup.match(/class="job-state-badge"/g)).toHaveLength(1);
    expect(jobs).toEqual(jobsBeforeRender);
    expect(jobs).toHaveLength(1);
    expect(jobs.some((job) => 'targets' in job || 'availability' in job)).toBe(false);
  });

  it('keeps AppRouter JobSummary input separate from opened-Book export readiness', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');
    const jobRecoveryStart = source.indexOf('jobRecovery={{');
    const jobRecoveryEnd = source.indexOf('\n      }}', jobRecoveryStart);
    const jobRecoverySource = source.slice(jobRecoveryStart, jobRecoveryEnd);

    expect(jobRecoverySource).toContain('jobs: jobsQuery.data ?? []');
    expect(jobRecoverySource).toContain('exportReadiness: openedBook ?');
    expect(jobRecoverySource).toContain('status: exportStatusQuery.data ?? null');
    expect(jobRecoverySource).not.toContain('jobs: [');
    expect(jobRecoverySource).not.toContain("type: 'export'");
  });
});

function emptyExportPreview(): ExportStatusDto['targets'][number]['preview'] {
  return {
    structure: { status: 'not_frozen', structureEdition: null },
    moduleInstances: {
      expectedCount: 7,
      actualCount: 0,
      nonEmptyBodyCount: 0,
      statusCounts: {
        not_generated: 0,
        generated_pending_review: 0,
        confirmed: 0,
        stale: 0,
        needs_rebuild: 0,
      },
    },
  };
}
