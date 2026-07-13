import { randomUUID } from 'node:crypto';
import type { LibraryService } from '../library/library-service';
import type { SqliteDatabase } from '../db/sqlite';
import { BookService } from '../books/book-service';
import { SourceTextService } from '../source-text/source-text-service';
import { JobService } from '../jobs/job-service';
import type { StructureDetectionStartResult } from '../../shared/contracts/structure';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  JobId,
  StructureDetectionRun,
  StructureDetectionRunId,
  StructureSetId,
} from '../../shared/domain';
import { StructureCandidateRepository } from './persistence/structure-candidate-repository';
import { StructureDetectionRunRepository } from './persistence/structure-detection-run-repository';
import {
  loadCurrentStructureSourceSnapshot,
  type LoadedStructureSourceSnapshot,
} from './structure-source-snapshot';
import { validateStructureSet, type StructureValidationResult } from './validation/structure-validator';
import { UtilityWorkerRunnerError } from './worker/structure-worker-runner';
import type {
  StructureWorkerDetectionInput,
  StructureWorkerDetectionResult,
} from './worker/structure-worker-protocol';

export type StructureServiceWorker = {
  detect(
    input: StructureWorkerDetectionInput,
    timeoutMs: number,
    options?: { readonly signal?: AbortSignal },
  ): Promise<{
    readonly result: StructureWorkerDetectionResult;
    readonly workerPid: number;
  }>;
};

export type StructureServiceOptions = {
  readonly libraryService: LibraryService;
  readonly worker: StructureServiceWorker;
  readonly now?: () => string;
  readonly createRunId?: () => StructureDetectionRunId;
  readonly createJobId?: () => JobId;
  readonly createCandidateSetId?: () => StructureSetId;
  readonly schedule?: (operation: () => void) => void;
};

export type DetectStructureOptions = {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
};

export type StructureServiceDetectionSuccess = {
  readonly status: 'candidate_ready' | 'needs_manual_review';
  readonly candidate: CandidateStructureSet;
  readonly validation: StructureValidationResult;
  readonly detectionRun: StructureDetectionRun;
  readonly job: ReturnType<StructureDetectionRunRepository['markCompleted']>['job'];
};

export type StructureServiceDetectionFailure = {
  readonly status: 'structure_detection_failed';
  readonly failureCode: 'no_reliable_chapter';
  readonly recoveryActions: readonly string[];
  readonly candidate: null;
  readonly detectionRun: StructureDetectionRun;
  readonly job: ReturnType<StructureDetectionRunRepository['markFailed']>['job'];
};

export type StructureServiceDetectionResult =
  | StructureServiceDetectionSuccess
  | StructureServiceDetectionFailure;

export type StructureServiceErrorReason =
  | 'no_current_library'
  | 'library_session_changed'
  | 'source_snapshot_stale'
  | 'structure_detection_in_progress'
  | 'structure_detection_recovery_required'
  | 'structure_validation_failed'
  | 'candidate_persistence_failed'
  | 'structure_worker_failed'
  | UtilityWorkerRunnerError['code'];

export class StructureServiceError extends Error {
  constructor(
    readonly reason: StructureServiceErrorReason,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'StructureServiceError';
  }
}

type PreparedDetection = {
  readonly sessionId: string;
  readonly bookId: BreakdownBookId;
  readonly source: LoadedStructureSourceSnapshot;
  readonly runId: StructureDetectionRunId;
  readonly started: StructureDetectionStartResult;
};

type ActiveDetection = PreparedDetection & {
  readonly options: DetectStructureOptions;
  readonly controller: AbortController;
  readonly completion: Promise<void>;
  resolveCompletion: () => void;
  cancelled: boolean;
  removeCallerAbortListener: () => void;
};

export class StructureService {
  private readonly libraryService: StructureServiceOptions['libraryService'];
  private readonly worker: StructureServiceWorker;
  private readonly books: BookService;
  private readonly sourceTexts: SourceTextService;
  private readonly now: () => string;
  private readonly createRunId: () => StructureDetectionRunId;
  private readonly createJobId: () => JobId;
  private readonly createCandidateSetId: () => StructureSetId;
  private readonly schedule: (operation: () => void) => void;
  private readonly activeByJobId = new Map<JobId, ActiveDetection>();
  private readonly activeByBookId = new Map<BreakdownBookId, ActiveDetection>();

  constructor(options: StructureServiceOptions) {
    this.libraryService = options.libraryService;
    this.books = new BookService({ libraryService: options.libraryService });
    this.sourceTexts = new SourceTextService({ libraryService: options.libraryService });
    this.worker = options.worker;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createRunId = options.createRunId ?? (() => randomUUID() as StructureDetectionRunId);
    this.createJobId = options.createJobId ?? (() => randomUUID() as JobId);
    this.createCandidateSetId = options.createCandidateSetId ?? (() => randomUUID() as StructureSetId);
    this.schedule = options.schedule ?? ((operation) => setImmediate(operation));
  }

  get activeCount(): number {
    return this.activeByJobId.size;
  }

  async startDetection(
    bookId: BreakdownBookId,
    options: DetectStructureOptions,
  ): Promise<StructureDetectionStartResult> {
    if (this.activeByBookId.has(bookId)) {
      throw new StructureServiceError(
        'structure_detection_in_progress',
        'A structure detection is already running for this book.',
      );
    }

    const prepared = await this.prepareDetection(bookId);
    const active = createActiveDetection(prepared, options);
    this.activeByJobId.set(prepared.started.job.id, active);
    this.activeByBookId.set(bookId, active);
    this.attachCallerCancellation(active);
    this.schedule(() => {
      void this.executeActive(active);
    });
    return prepared.started;
  }

  async waitForIdle(): Promise<void> {
    await Promise.all([...this.activeByJobId.values()].map((active) => active.completion));
  }

  cancelDetection(jobId: JobId): boolean {
    const active = this.activeByJobId.get(jobId);
    if (!active || active.cancelled) {
      return false;
    }

    this.writeFor(active, (database) => {
      new StructureDetectionRunRepository(database).markCancelled(active.runId, this.now());
      new JobService({ database }).transition(active.started.job.id, 'cancelled', this.now());
    });
    active.cancelled = true;
    active.controller.abort();
    return true;
  }

  cancelAll(): number {
    let cancelledCount = 0;
    for (const jobId of [...this.activeByJobId.keys()]) {
      if (this.cancelDetection(jobId)) {
        cancelledCount += 1;
      }
    }
    return cancelledCount;
  }

  private async prepareDetection(bookId: BreakdownBookId): Promise<PreparedDetection> {
    const current = this.libraryService.getCurrent();
    if (!current) this.throwNoCurrentLibrary();
    const source = await loadCurrentStructureSourceSnapshot({ books: this.books, sourceTexts: this.sourceTexts }, bookId);
    const runId = this.createRunId();
    const jobId = this.createJobId();
    const createdAt = this.now();
    const started = this.libraryService.getUnitOfWork().write((session) => {
      if (session.sessionId !== current.sessionId) this.throwSessionChanged();
      const runs = new StructureDetectionRunRepository(session.database);
      if (runs.findActiveByBook(bookId)) {
        throw new StructureServiceError(
          'structure_detection_recovery_required',
          'An unfinished structure detection exists in this library and must be recovered first.',
        );
      }
      new JobService({ database: session.database }).createQueued({
        id: jobId,
        bookId,
        kind: 'structure_detection',
        totalUnits: 1,
        payloadSchemaVersion: 1,
        payload: {
          title: 'Detect structure',
          sourceTextId: source.snapshot.sourceTextId,
          sourceTextEdition: source.snapshot.sourceTextEdition,
          contentHash: source.snapshot.contentHash,
        },
        createdAt,
        updatedAt: createdAt,
      });
      return runs.createQueued({ runId, jobId, bookId, sourceSnapshot: source.snapshot, createdAt });
    });
    return { sessionId: current.sessionId, bookId, source, runId, started };
  }

  private async executeActive(active: ActiveDetection): Promise<void> {
    try {
      if (active.cancelled) {
        return;
      }
      this.writeFor(active, (database) => {
        new StructureDetectionRunRepository(database).markRunning(active.runId, this.now());
        new JobService({ database }).transition(active.started.job.id, 'running', this.now());
      });
      await this.executePrepared(active, {
        timeoutMs: active.options.timeoutMs,
        signal: active.controller.signal,
      }, active);
    } catch {
      this.persistUnexpectedBackgroundFailure(active);
    } finally {
      active.removeCallerAbortListener();
      this.activeByJobId.delete(active.started.job.id);
      this.activeByBookId.delete(active.bookId);
      active.resolveCompletion();
    }
  }

  private async executePrepared(
    prepared: PreparedDetection,
    options: DetectStructureOptions,
    active?: ActiveDetection,
  ): Promise<StructureServiceDetectionResult> {
    let workerResult: Awaited<ReturnType<StructureServiceWorker['detect']>>;
    try {
      workerResult = await this.worker.detect({
        bookTitle: prepared.source.bookTitle,
        sourceText: prepared.source.sourceText,
      }, options.timeoutMs, options.signal ? { signal: options.signal } : undefined);
    } catch (error) {
      if (active?.cancelled) {
        throw error;
      }
      if (error instanceof UtilityWorkerRunnerError) {
        if (error.code === 'UTILITY_WORKER_CANCELLED') {
          this.failOrCancel(prepared, 'cancelled', 'cancelled_by_user');
        } else {
          this.failOrCancel(prepared, 'failed', error.code);
        }
        throw new StructureServiceError(error.code, error.message, { cause: error });
      }
      this.failOrCancel(prepared, 'failed', 'structure_worker_failed');
      throw new StructureServiceError(
        'structure_worker_failed',
        'Structure worker failed without a recognized lifecycle error.',
        { cause: error },
      );
    }

    if (active?.cancelled) {
      throw new StructureServiceError('UTILITY_WORKER_CANCELLED', 'Structure detection was cancelled.');
    }
    await this.assertSourceStillCurrent(prepared);

    if (workerResult.result.structure.status === 'structure_detection_failed') {
      const failed = this.failOrCancel(prepared, 'failed', 'structure_detection_failed');
      return {
        status: 'structure_detection_failed',
        failureCode: workerResult.result.structure.failureCode,
        recoveryActions: workerResult.result.structure.recoveryActions,
        candidate: null,
        ...failed,
      };
    }

    const candidate = buildCandidate(
      prepared.bookId,
      prepared.runId,
      prepared.source,
      workerResult.result,
      this.createCandidateSetId(),
      this.now(),
    );
    const validation = validateStructureSet({
      structureSet: candidate,
      currentSourceSnapshot: prepared.source.snapshot,
      sourceText: prepared.source.sourceText,
      purpose: 'candidate_review',
    });
    if (!validation.valid) {
      this.failOrCancel(prepared, 'failed', 'structure_validation_failed');
      throw new StructureServiceError(
        'structure_validation_failed',
        'Structure candidate failed aggregate validation.',
      );
    }

    let completed: ReturnType<StructureDetectionRunRepository['markCompleted']>;
    try {
      completed = this.writeFor(prepared, (database) => {
        new StructureCandidateRepository(database).replaceCurrentCandidate(candidate);
        new StructureDetectionRunRepository(database).markCompleted(prepared.runId, this.now());
        new JobService({ database }).completeWithCheckpoint(prepared.started.job.id, {
          bookId: prepared.bookId,
          completedUnits: 1,
          totalUnits: 1,
          updatedAt: this.now(),
          checkpoint: {
            id: randomUUID(),
            kind: 'structure_detection_completed',
            payloadSchemaVersion: 1,
            payload: {
              title: 'Detect structure',
              sourceTextId: prepared.source.snapshot.sourceTextId,
              sourceTextEdition: prepared.source.snapshot.sourceTextEdition,
              contentHash: prepared.source.snapshot.contentHash,
            },
            createdAt: this.now(),
          },
        });
        return new StructureDetectionRunRepository(database).getById(prepared.runId)!;
      });
    } catch (error) {
      this.failOrCancel(prepared, 'failed', 'candidate_persistence_failed');
      throw new StructureServiceError(
        'candidate_persistence_failed',
        'Structure candidate and completed checkpoint could not be committed.',
        { cause: error },
      );
    }

    return {
      status: requiresManualReview(workerResult.result, validation)
        ? 'needs_manual_review'
        : 'candidate_ready',
      candidate,
      validation,
      ...completed,
    };
  }

  private attachCallerCancellation(active: ActiveDetection): void {
    const signal = active.options.signal;
    if (!signal) {
      return;
    }
    const cancel = (): void => {
      this.cancelDetection(active.started.job.id);
    };
    signal.addEventListener('abort', cancel, { once: true });
    active.removeCallerAbortListener = () => signal.removeEventListener('abort', cancel);
    if (signal.aborted) {
      cancel();
    }
  }

  private persistUnexpectedBackgroundFailure(active: ActiveDetection): void {
    if (active.cancelled) {
      return;
    }
    const current = this.readFor(active, (database) =>
      new StructureDetectionRunRepository(database).getById(active.runId));
    if (current?.detectionRun.state === 'queued' || current?.detectionRun.state === 'running') {
      this.failOrCancel(active, 'failed', 'structure_worker_failed');
    }
  }

  private throwNoCurrentLibrary(): never {
    throw new StructureServiceError('no_current_library', 'Open or create a library before detecting structure.');
  }

  private throwSessionChanged(): never {
    throw new StructureServiceError('library_session_changed', 'The current library changed while structure detection was running.');
  }

  private readFor<T>(prepared: PreparedDetection, operation: (database: SqliteDatabase) => T): T {
    return this.libraryService.getUnitOfWork().read((session) => {
      if (session.sessionId !== prepared.sessionId) this.throwSessionChanged();
      return operation(session.database);
    });
  }

  private writeFor<T>(prepared: PreparedDetection, operation: (database: SqliteDatabase) => T): T {
    return this.libraryService.getUnitOfWork().write((session) => {
      if (session.sessionId !== prepared.sessionId) this.throwSessionChanged();
      return operation(session.database);
    });
  }

  private failOrCancel(
    prepared: PreparedDetection,
    jobState: 'failed' | 'cancelled',
    reason: string,
  ): StructureDetectionStartResult {
    return this.writeFor(prepared, (database) => {
      const runs = new StructureDetectionRunRepository(database);
      if (jobState === 'cancelled') {
        runs.markCancelled(prepared.runId, this.now());
        new JobService({ database }).transition(prepared.started.job.id, 'cancelled', this.now());
      } else {
        runs.markFailed(prepared.runId, reason, this.now());
        new JobService({ database }).fail(prepared.started.job.id, this.now(), { errorCode: reason });
      }
      return runs.getById(prepared.runId)!;
    });
  }

  private async assertSourceStillCurrent(prepared: PreparedDetection): Promise<void> {
    if (this.libraryService.getCurrent()?.sessionId !== prepared.sessionId) {
      this.throwSessionChanged();
    }

    let current: LoadedStructureSourceSnapshot;
    try {
      current = await loadCurrentStructureSourceSnapshot({ books: this.books, sourceTexts: this.sourceTexts }, prepared.bookId);
    } catch (error) {
      this.failOrCancel(prepared, 'failed', 'source_snapshot_stale');
      throw new StructureServiceError(
        'source_snapshot_stale',
        'The imported source changed while structure detection was running.',
        { cause: error },
      );
    }
    if (!sameSourceSnapshot(prepared.source, current)) {
      this.failOrCancel(prepared, 'failed', 'source_snapshot_stale');
      throw new StructureServiceError(
        'source_snapshot_stale',
        'The imported source changed while structure detection was running.',
      );
    }
  }
}

function createActiveDetection(
  prepared: PreparedDetection,
  options: DetectStructureOptions,
): ActiveDetection {
  let resolveCompletion = (): void => undefined;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  return {
    ...prepared,
    options,
    controller: new AbortController(),
    completion,
    resolveCompletion,
    cancelled: false,
    removeCallerAbortListener: () => undefined,
  };
}

function buildCandidate(
  bookId: BreakdownBookId,
  runId: StructureDetectionRunId,
  source: LoadedStructureSourceSnapshot,
  result: StructureWorkerDetectionResult,
  id: StructureSetId,
  now: string,
): CandidateStructureSet {
  if (result.structure.status === 'structure_detection_failed') {
    throw new Error('A failed structure detection cannot become a candidate.');
  }
  return {
    id,
    bookId,
    sourceSnapshot: source.snapshot,
    nodes: result.structure.nodes,
    storyRanges: result.storyRanges?.ranges ?? [],
    storyRangeMode: 'included',
    stage: 'candidate',
    detectionRunId: runId,
    draftRevision: null,
    structureEdition: null,
    createdAt: now,
    updatedAt: now,
  };
}

function requiresManualReview(
  result: StructureWorkerDetectionResult,
  validation: StructureValidationResult,
): boolean {
  return result.structure.status === 'needs_manual_review' ||
    result.storyRanges?.status !== 'story_ranges_ready' ||
    validation.issues.some((issue) => issue.severity === 'review');
}

function sameSourceSnapshot(
  left: LoadedStructureSourceSnapshot,
  right: LoadedStructureSourceSnapshot,
): boolean {
  return left.bookTitle === right.bookTitle &&
    left.sourceText === right.sourceText &&
    left.snapshot.sourceTextId === right.snapshot.sourceTextId &&
    left.snapshot.sourceTextEdition === right.snapshot.sourceTextEdition &&
    left.snapshot.contentHash === right.snapshot.contentHash &&
    left.snapshot.decodedTextLength === right.snapshot.decodedTextLength &&
    left.snapshot.offsetUnit === right.snapshot.offsetUnit;
}
