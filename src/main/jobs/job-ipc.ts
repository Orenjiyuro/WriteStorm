import type {
  ContractRequest,
  ContractResponse,
  JobDetail,
  JobSummary,
} from '../../shared/contracts';
import { createDomainError } from '../../shared/errors';
import { LibraryUnitOfWorkError } from '../library/library-unit-of-work';
import { JobRepositoryError } from './job-repository';
import { JobServiceError } from './job-service';

export type JobIpcService = {
  list(bookId?: ContractRequest<'jobs:list'>['bookId']): JobSummary[];
  get(jobId: ContractRequest<'jobs:get'>['jobId']): JobDetail | null;
  cancel(jobId: ContractRequest<'jobs:cancel'>['jobId']): Promise<JobSummary>;
};

export type JobIpcDependencies = {
  readonly 'jobs:list': (
    request: ContractRequest<'jobs:list'>,
  ) => Promise<ContractResponse<'jobs:list'>>;
  readonly 'jobs:get': (
    request: ContractRequest<'jobs:get'>,
  ) => Promise<ContractResponse<'jobs:get'>>;
  readonly 'jobs:cancel': (
    request: ContractRequest<'jobs:cancel'>,
  ) => Promise<ContractResponse<'jobs:cancel'>>;
};

export function createJobIpcDependencies(service: JobIpcService): JobIpcDependencies {
  return {
    'jobs:list': async (request) => execute(() => service.list(request.bookId)),
    'jobs:get': async (request) => execute(() => service.get(request.jobId)),
    'jobs:cancel': async (request) => execute(() => service.cancel(request.jobId)),
  };
}

async function execute<T>(operation: () => T | Promise<T>): Promise<{
  readonly ok: true;
  readonly data: T;
} | {
  readonly ok: false;
  readonly error: ReturnType<typeof createDomainError>;
}> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const mapped = mapJobError(error);
    if (!mapped) throw error;
    return { ok: false, error: mapped };
  }
}

function mapJobError(error: unknown): ReturnType<typeof createDomainError> | null {
  if (error instanceof JobServiceError) {
    return createDomainError({
      code: 'JOB_ERROR',
      message: error.message,
      recoverable: isRecoverableJobServiceError(error.reason),
      details: { reason: error.reason },
    });
  }
  if (error instanceof LibraryUnitOfWorkError) {
    return createDomainError({
      code: 'JOB_ERROR',
      message: error.message,
      recoverable: true,
      details: { reason: error.code.toLowerCase() },
    });
  }
  if (error instanceof JobRepositoryError) {
    return createDomainError({
      code: 'JOB_ERROR',
      message: error.message,
      recoverable: false,
      details: { reason: error.reason, recordId: error.recordId },
    });
  }
  return null;
}

function isRecoverableJobServiceError(reason: JobServiceError['reason']): boolean {
  return reason === 'job_not_found' ||
    reason === 'job_not_cancellable' ||
    reason === 'runtime_owner_not_stopped' ||
    reason === 'invalid_transition';
}
