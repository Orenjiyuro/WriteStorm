import { randomUUID } from 'node:crypto';
import type { LibraryContext, LibraryService } from '../library/library-service';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  JobId,
  StructureDetectionRun,
  StructureDetectionRunId,
  StructureDetectionStartResult,
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
  readonly libraryService: Pick<LibraryService, 'getCurrentContext'>;
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
  readonly context: LibraryContext;
  readonly bookId: BreakdownBookId;
  readonly source: LoadedStructureSourceSnapshot;
  readonly runs: StructureDetectionRunRepository;
  readonly candidates: StructureCandidateRepository;
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
  private readonly now: () => string;
  private readonly createRunId: () => StructureDetectionRunId;
  private readonly createJobId: () => JobId;
  private readonly createCandidateSetId: () => StructureSetId;
  private readonly schedule: (operation: () => void) => void;
  private readonly activeByJobId = new Map<JobId, ActiveDetection>();
  private readonly activeByBookId = new Map<BreakdownBookId, ActiveDetection>();

  constructor(options: StructureServiceOptions) {
    this.libraryService = options.libraryService;
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

    active.runs.markCancelled(active.runId, this.now());
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
    const context = this.requireCurrentContext();
    const source = await loadCurrentStructureSourceSnapshot(context, bookId);
    const runs = new StructureDetectionRunRepository(context.database);
    if (runs.findActiveByBook(bookId)) {
      throw new StructureServiceError(
        'structure_detection_recovery_required',
        'An unfinished structure detection exists in this library and must be recovered first.',
      );
    }
    const candidates = new StructureCandidateRepository(context.database);
    const runId = this.createRunId();
    const started = runs.createQueued({
      runId,
      jobId: this.createJobId(),
      bookId,
      sourceSnapshot: source.snapshot,
      createdAt: this.now(),
    });
    return { context, bookId, source, runs, candidates, runId, started };
  }

  private async executeActive(active: ActiveDetection): Promise<void> {
    try {
      if (active.cancelled) {
        return;
      }
      active.runs.markRunning(active.runId, this.now());
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
          prepared.runs.markCancelled(prepared.runId, this.now());
        } else {
          prepared.runs.markFailed(prepared.runId, error.code, this.now());
        }
        throw new StructureServiceError(error.code, error.message, { cause: error });
      }
      prepared.runs.markFailed(prepared.runId, 'structure_worker_failed', this.now());
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
      const failed = prepared.runs.markFailed(prepared.runId, 'structure_detection_failed', this.now());
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
      prepared.runs.markFailed(prepared.runId, 'structure_validation_failed', this.now());
      throw new StructureServiceError(
        'structure_validation_failed',
        'Structure candidate failed aggregate validation.',
      );
    }

    let completed: ReturnType<StructureDetectionRunRepository['markCompleted']>;
    try {
      const commit = prepared.context.database.transaction(() => {
        prepared.candidates.replaceCurrentCandidate(candidate);
        return prepared.runs.markCompleted(prepared.runId, this.now());
      });
      completed = commit();
    } catch (error) {
      prepared.runs.markFailed(prepared.runId, 'candidate_persistence_failed', this.now());
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
    const current = active.runs.getById(active.runId);
    if (current?.detectionRun.state === 'queued' || current?.detectionRun.state === 'running') {
      active.runs.markFailed(active.runId, 'structure_worker_failed', this.now());
    }
  }

  private requireCurrentContext(): LibraryContext {
    const context = this.libraryService.getCurrentContext();
    if (!context) {
      throw new StructureServiceError(
        'no_current_library',
        'Open or create a library before detecting structure.',
      );
    }
    return context;
  }

  private async assertSourceStillCurrent(prepared: PreparedDetection): Promise<void> {
    if (this.libraryService.getCurrentContext()?.sessionId !== prepared.context.sessionId) {
      prepared.runs.markFailed(prepared.runId, 'library_session_changed', this.now());
      throw new StructureServiceError(
        'library_session_changed',
        'The current library changed while structure detection was running.',
      );
    }

    let current: LoadedStructureSourceSnapshot;
    try {
      current = await loadCurrentStructureSourceSnapshot(prepared.context, prepared.bookId);
    } catch (error) {
      prepared.runs.markFailed(prepared.runId, 'source_snapshot_stale', this.now());
      throw new StructureServiceError(
        'source_snapshot_stale',
        'The imported source changed while structure detection was running.',
        { cause: error },
      );
    }
    if (!sameSourceSnapshot(prepared.source, current)) {
      prepared.runs.markFailed(prepared.runId, 'source_snapshot_stale', this.now());
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
