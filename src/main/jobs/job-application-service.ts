import type { JobDetail, JobSummary } from '../../shared/contracts';
import type { BreakdownBookId, JobId } from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import { LibraryUnitOfWorkError } from '../library/library-unit-of-work';
import { JobService, JobServiceError } from './job-service';
import { mapJobRecordToSummary, mapPersistedJobDetail } from './job-summary-mapper';

export type SourceImportCancellationOwner = {
  cancelImport(jobId: JobId, expectedSessionId: string): Promise<boolean>;
};

export type StructureDetectionCancellationOwner = {
  cancelDetectionAndWait(jobId: JobId, expectedSessionId: string): Promise<boolean>;
};

export class JobApplicationService {
  private readonly now: () => string;
  private readonly inFlightCancellations = new Set<Promise<unknown>>();
  private cancellationPauseDepth = 0;

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

  cancel(jobId: JobId): Promise<JobSummary> {
    if (this.cancellationPauseDepth > 0) {
      return Promise.reject(new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED'));
    }
    const operation = this.cancelPinned(jobId);
    this.inFlightCancellations.add(operation);
    void operation.finally(() => {
      this.inFlightCancellations.delete(operation);
    }).catch(() => undefined);
    return operation;
  }

  pauseCancellations(): void {
    this.cancellationPauseDepth += 1;
  }

  resumeCancellations(): void {
    this.cancellationPauseDepth = Math.max(0, this.cancellationPauseDepth - 1);
  }

  async waitForIdle(): Promise<void> {
    while (this.inFlightCancellations.size > 0) {
      await Promise.allSettled([...this.inFlightCancellations]);
    }
  }

  private async cancelPinned(jobId: JobId): Promise<JobSummary> {
    const pinned = this.options.libraryService.getUnitOfWork().read((session) => ({
      sessionId: session.sessionId,
      job: new JobService({ database: session.database }).get(jobId),
    }));
    const current = pinned.job;
    if (!current) throw new JobServiceError('job_not_found', jobId);

    const ownerCancelled = current.kind === 'source_import'
      ? await this.options.sourceImports.cancelImport(jobId, pinned.sessionId)
      : current.kind === 'structure_detection'
        ? await this.options.structure.cancelDetectionAndWait(jobId, pinned.sessionId)
        : false;

    if (ownerCancelled) {
      const stopped = this.readPinnedJob(jobId, pinned.sessionId);
      if (!stopped || stopped.state !== 'cancelled') {
        throw new JobServiceError('runtime_owner_not_stopped', current.kind);
      }
      return mapJobRecordToSummary(stopped);
    }

    if (current.kind === 'structure_detection') {
      throw new JobServiceError('runtime_owner_not_stopped', current.kind);
    }

    return this.options.libraryService.getUnitOfWork().write((session) => {
      this.assertPinnedSession(session.sessionId, pinned.sessionId);
      const cancelled = new JobService({ database: session.database }).cancel(
        jobId,
        this.now(),
        { runtimeOwner: 'none' },
      );
      return mapJobRecordToSummary(cancelled);
    });
  }

  private readPinnedJob(jobId: JobId, expectedSessionId: string) {
    return this.options.libraryService.getUnitOfWork().read((session) => {
      this.assertPinnedSession(session.sessionId, expectedSessionId);
      return new JobService({ database: session.database }).get(jobId);
    });
  }

  private assertPinnedSession(actualSessionId: string, expectedSessionId: string): void {
    if (actualSessionId !== expectedSessionId) {
      throw new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED');
    }
  }
}
