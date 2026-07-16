import {
  jobDetailSchema,
  jobSummarySchema,
  type JobDetail,
  type JobSummary,
} from '../../shared/contracts';
import type { JobType } from '../../shared/domain';
import type { JobRecord, PersistedJobDetail } from './job-repository';

const JOB_TITLES = {
  source_import: 'Import source',
  structure_detection: 'Detect structure',
  structure_edition: 'Freeze structure edition',
  analysis_module_shell_creation: 'Create analysis module shells',
  analysis_module_instance_analysis: 'Analyze module instances',
  export: 'Export',
} as const satisfies Readonly<Record<JobType, string>>;

const COMPLETION_SUMMARIES = {
  source_import: 'Source imported.',
  structure_detection: 'Structure draft generated.',
  structure_edition: 'Structure edition frozen.',
  analysis_module_shell_creation: 'Analysis module shells created.',
  analysis_module_instance_analysis: 'Analysis module batch completed.',
  export: 'Export completed.',
} as const satisfies Readonly<Record<JobType, string>>;

export function mapJobRecordToSummary(job: JobRecord): JobSummary {
  return jobSummarySchema.parse({
    id: job.id,
    bookId: job.bookId,
    state: job.state,
    title: JOB_TITLES[job.kind],
    completedUnits: job.completedUnits,
    totalUnits: job.totalUnits,
    checkpointSummary: job.state === 'completed' ? COMPLETION_SUMMARIES[job.kind] : null,
    failureReason: job.errorCode,
    updatedAt: job.updatedAt,
  });
}

export function mapPersistedJobDetail(detail: PersistedJobDetail): JobDetail {
  return jobDetailSchema.parse({
    ...mapJobRecordToSummary(detail.job),
    type: detail.job.kind,
    checkpoints: detail.checkpoints,
  });
}
