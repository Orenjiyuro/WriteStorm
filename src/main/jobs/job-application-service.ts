import type { JobDetail, JobSummary } from '../../shared/contracts';
import type { BreakdownBookId, JobId } from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import { JobService, JobServiceError } from './job-service';
import { mapJobRecordToSummary, mapPersistedJobDetail } from './job-summary-mapper';

export type SourceImportCancellationOwner = {
  cancelImport(jobId: JobId): Promise<boolean>;
};

export type StructureDetectionCancellationOwner = {
  cancelDetectionAndWait(jobId: JobId): Promise<boolean>;
};

export class JobApplicationService {
  private readonly now: () => string;

  constructor(private readonly options: {
    readonly libraryService: LibraryService;
    readonly sourceImports: SourceImportCancellationOwner;
    readonly structure: StructureDetectionCancellationOwner;
    readonly now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  list(bookId?: BreakdownBookId): JobSummary[] {
    return this.options.libraryService.getUnitOfWork().read((session) =>
      new JobService({ database: session.database }).list(bookId).map(mapJobRecordToSummary));
  }

  get(jobId: JobId): JobDetail | null {
    return this.options.libraryService.getUnitOfWork().read((session) => {
      const detail = new JobService({ database: session.database }).getWithCheckpoints(jobId);
      return detail ? mapPersistedJobDetail(detail) : null;
    });
  }

  async cancel(jobId: JobId): Promise<JobSummary> {
    const current = this.options.libraryService.getUnitOfWork().read((session) =>
      new JobService({ database: session.database }).get(jobId));
    if (!current) throw new JobServiceError('job_not_found', jobId);

    const ownerCancelled = current.kind === 'source_import'
      ? await this.options.sourceImports.cancelImport(jobId)
      : current.kind === 'structure_detection'
        ? await this.options.structure.cancelDetectionAndWait(jobId)
        : false;

    if (ownerCancelled) {
      const stopped = this.options.libraryService.getUnitOfWork().read((session) =>
        new JobService({ database: session.database }).get(jobId));
      if (!stopped || stopped.state !== 'cancelled') {
        throw new JobServiceError('runtime_owner_not_stopped', current.kind);
      }
      return mapJobRecordToSummary(stopped);
    }

    if (current.kind === 'structure_detection') {
      throw new JobServiceError('runtime_owner_not_stopped', current.kind);
    }

    return this.options.libraryService.getUnitOfWork().write((session) => {
      const cancelled = new JobService({ database: session.database }).cancel(
        jobId,
        this.now(),
        { runtimeOwner: 'none' },
      );
      return mapJobRecordToSummary(cancelled);
    });
  }
}
