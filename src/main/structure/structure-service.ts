import { randomUUID } from 'node:crypto';
import type { LibraryService } from '../library/library-service';
import type { SqliteDatabase } from '../db/sqlite';
import { BookService } from '../books/book-service';
import { SourceTextService } from '../source-text/source-text-service';
import { JobService } from '../jobs/job-service';
import {
  structureWorkspaceSchema,
  type StructureDetectionStartResult,
  type StructureWorkspace,
} from '../../shared/contracts/structure';
import type {
  BreakdownBookId,
  CandidateStructureSet,
  DraftStructureSet,
  JobId,
  StorySegmentRangeId,
  StructureNodeId,
  StructureDetectionRun,
  StructureDetectionRunId,
  StructureSetId,
  StructureSet,
} from '../../shared/domain';
import { StructureCandidateRepository } from './persistence/structure-candidate-repository';
import { StructureDetectionRunRepository } from './persistence/structure-detection-run-repository';
import {
  StructureDraftRepository,
  StructureDraftRepositoryError,
  type StructureNodeMetadataCommand,
  type StructureRangeCommand,
} from './persistence/structure-draft-repository';
import {
  loadCurrentStructureSourceSnapshot,
  type LoadedStructureSourceSnapshot,
  StructureSourceSnapshotError,
} from './structure-source-snapshot';
import { validateStructureSet, type StructureValidationResult } from './validation/structure-validator';
import { UtilityWorkerRunnerError } from './worker/structure-worker-runner';
import type {
  StructureWorkerDetectionInput,
  StructureWorkerDetectionResult,
} from './worker/structure-worker-protocol';
import {
  createStructureEditionChange,
  NOOP_STRUCTURE_EDITION_CHANGE_PORT,
  type StructureEditionChangePort,
} from './structure-edition-change-port';
import { AnalysisModuleRepositoryError } from '../modules/analysis-module-repository';
import { AnalysisModuleInstanceEditionChangeError } from '../modules/analysis-module-instance-edition-change-port';

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
  readonly createDraftSetId?: () => StructureSetId;
  readonly createDraftNodeId?: () => StructureNodeId;
  readonly createDraftRangeId?: () => StorySegmentRangeId;
  readonly schedule?: (operation: () => void) => void;
  readonly structureEditionChangePort?: StructureEditionChangePort;
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
  | 'candidate_not_found'
  | 'candidate_stale'
  | 'draft_already_exists'
  | 'draft_not_found'
  | 'draft_revision_mismatch'
  | 'draft_stale'
  | 'draft_validation_failed'
  | 'frozen_not_found'
  | 'frozen_stale'
  | 'node_not_found'
  | 'node_not_low_confidence'
  | 'range_not_found'
  | 'range_not_low_confidence'
  | 'structure_reference_blocked'
  | 'structure_worker_failed'
  | UtilityWorkerRunnerError['code'];

export class StructureServiceError extends Error {
  readonly expectedDraftRevision?: number;
  readonly actualDraftRevision?: number;
  readonly blockers: readonly string[];

  constructor(
    readonly reason: StructureServiceErrorReason,
    message: string,
    options?: {
      readonly cause?: unknown;
      readonly expectedDraftRevision?: number;
      readonly actualDraftRevision?: number;
      readonly blockers?: readonly string[];
    },
  ) {
    super(message, options);
    this.name = 'StructureServiceError';
    this.expectedDraftRevision = options?.expectedDraftRevision;
    this.actualDraftRevision = options?.actualDraftRevision;
    this.blockers = options?.blockers ?? [];
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
  private readonly createDraftSetId: () => StructureSetId;
  private readonly createDraftNodeId: () => StructureNodeId;
  private readonly createDraftRangeId: () => StorySegmentRangeId;
  private readonly schedule: (operation: () => void) => void;
  private readonly structureEditionChangePort: StructureEditionChangePort;
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
    this.createDraftSetId = options.createDraftSetId ?? (() => randomUUID() as StructureSetId);
    this.createDraftNodeId = options.createDraftNodeId ?? (() => randomUUID() as StructureNodeId);
    this.createDraftRangeId = options.createDraftRangeId ?? (() => randomUUID() as StorySegmentRangeId);
    this.schedule = options.schedule ?? ((operation) => setImmediate(operation));
    this.structureEditionChangePort = options.structureEditionChangePort ?? NOOP_STRUCTURE_EDITION_CHANGE_PORT;
  }

  get activeCount(): number {
    return this.activeByJobId.size;
  }

  async getWorkspace(bookId: BreakdownBookId): Promise<StructureWorkspace> {
    const pinned = this.libraryService.getCurrent();
    if (!pinned) this.throwNoCurrentLibrary();
    let source: LoadedStructureSourceSnapshot | null;
    try {
      source = await loadCurrentStructureSourceSnapshot(
        { books: this.books, sourceTexts: this.sourceTexts }, bookId,
      );
    } catch (error) {
      if (!(error instanceof StructureSourceSnapshotError)) throw error;
      if (error.reason === 'book_not_found') throw error;
      source = null;
    }
    return this.libraryService.getUnitOfWork().read((session) => {
      if (session.sessionId !== pinned.sessionId) this.throwSessionChanged();
      const candidates = new StructureCandidateRepository(session.database);
      const drafts = new StructureDraftRepository(session.database);
      const runs = new StructureDetectionRunRepository(session.database);
      const candidate = candidates.getCurrentCandidate(bookId);
      const draft = drafts.findCurrentDraft(bookId);
      const frozen = drafts.getCurrentFrozen(bookId);
      const candidateRun = candidate?.detectionRunId
        ? runs.getById(candidate.detectionRunId)
        : null;
      const latestResult = runs.findLatestByBook(bookId);
      const latest = latestResult?.detectionRun;
      const freshness = {
        candidate: candidate ? workspaceFreshness(candidate, source) : null,
        draft: draft ? workspaceFreshness(draft, source) : null,
        frozen: frozen ? workspaceFreshness(frozen, source) : null,
      };
      const validation = {
        candidate: candidate ? workspaceValidation(candidate, source, 'candidate_review') : null,
        draft: draft ? workspaceValidation(draft, source, 'freeze') : null,
        frozen: frozen ? workspaceValidation(frozen, source, 'freeze') : null,
      };
      const inMemoryActive = this.activeByBookId.has(bookId);
      const persistentActive = latest?.state === 'queued' || latest?.state === 'running';
      const canDetect = source !== null && !inMemoryActive && !persistentActive;
      const blockers: string[] = [];
      if (!source) blockers.push('current_source_unavailable');
      if (inMemoryActive) blockers.push('structure_detection_in_progress');
      if (persistentActive && !inMemoryActive) blockers.push('structure_detection_recovery_required');
      if (candidate && freshness.candidate?.status === 'stale') blockers.push('candidate_stale');
      if (draft && freshness.draft?.status === 'stale') blockers.push('draft_stale');
      if (draft && !validation.draft?.valid) blockers.push('draft_validation_failed');
      if (frozen && freshness.frozen?.status === 'stale') blockers.push('frozen_stale');
      return structureWorkspaceSchema.parse({
        bookId,
        latestDetectionRun: latest ? {
          id: latest.id, jobId: latest.job.jobId, state: latest.state,
          failureReason: latest.failureReason, updatedAt: latest.updatedAt,
        } : null,
        candidate, draft, frozen, freshness, validation,
        capabilities: {
          canDetect,
          canRetryDetection: canDetect && latest?.state === 'failed',
          canCreateDraft: !!candidate && !draft && !frozen && freshness.candidate?.status === 'fresh',
          canCreateReplacementDraft: !!candidate && !draft && !!frozen &&
            freshness.candidate?.status === 'fresh' && freshness.frozen?.status === 'stale' &&
            candidateRun?.detectionRun.state === 'completed' &&
            candidateRun.detectionRun.bookId === bookId &&
            candidateRun.detectionRun.sourceSnapshot.sourceTextId === candidate.sourceSnapshot.sourceTextId &&
            candidateRun.detectionRun.sourceSnapshot.sourceTextEdition === candidate.sourceSnapshot.sourceTextEdition &&
            candidateRun.detectionRun.sourceSnapshot.contentHash === candidate.sourceSnapshot.contentHash &&
            candidateRun.detectionRun.sourceSnapshot.decodedTextLength === candidate.sourceSnapshot.decodedTextLength &&
            candidate.sourceSnapshot.sourceTextEdition > frozen.sourceSnapshot.sourceTextEdition,
          canCreateManualDraft: source !== null && !draft && !frozen &&
            (!candidate || freshness.candidate?.status === 'stale') &&
            latest?.state === 'failed' && !inMemoryActive && !persistentActive,
          canDiscardDraft: !!draft,
          canEditDraft: !!draft && freshness.draft?.status === 'fresh',
          canFreeze: !!draft && freshness.draft?.status === 'fresh' && validation.draft?.valid === true,
          canUnfreeze: !!frozen && !draft && freshness.frozen?.status === 'fresh',
          blockers: [...new Set(blockers)],
        },
      });
    });
  }

  createDraft(
    bookId: BreakdownBookId,
    candidateSetId: StructureSetId,
    replacementFrozenSetId?: StructureSetId,
  ): DraftStructureSet {
    try {
      return this.libraryService.getUnitOfWork().write((session) =>
        new StructureDraftRepository(session.database).createFromCandidate({
          bookId,
          candidateSetId,
          replacementFrozenSetId,
          ids: {
            createSetId: this.createDraftSetId,
            createNodeId: this.createDraftNodeId,
            createRangeId: this.createDraftRangeId,
          },
          now: this.now(),
        }));
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error, blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  async createManualDraft(
    bookId: BreakdownBookId,
    expectedFailedDetectionRunId: StructureDetectionRunId,
  ): Promise<DraftStructureSet> {
    if (this.activeByBookId.has(bookId)) {
      throw new StructureServiceError(
        'structure_detection_in_progress', 'Structure detection is already in progress.', {
          blockers: ['structure_detection_in_progress'],
        },
      );
    }
    const pinned = this.libraryService.getCurrent();
    if (!pinned) this.throwNoCurrentLibrary();
    const source = await loadCurrentStructureSourceSnapshot(
      { books: this.books, sourceTexts: this.sourceTexts }, bookId,
    );
    try {
      return this.libraryService.getUnitOfWork().write((session) => {
        if (session.sessionId !== pinned.sessionId) this.throwSessionChanged();
        if (this.activeByBookId.has(bookId)) {
          throw new StructureServiceError(
            'structure_detection_in_progress', 'Structure detection is already in progress.', {
              blockers: ['structure_detection_in_progress'],
            },
          );
        }
        return new StructureDraftRepository(session.database).createManual({
          bookId, bookTitle: source.bookTitle, sourceSnapshot: source.snapshot,
          expectedFailedDetectionRunId,
          createSetId: this.createDraftSetId, createNodeId: this.createDraftNodeId,
          now: this.now(),
        });
      });
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error, blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  unfreeze(bookId: BreakdownBookId, frozenSetId: StructureSetId): DraftStructureSet {
    try {
      return this.libraryService.getUnitOfWork().write((session) =>
        new StructureDraftRepository(session.database).createFromFrozen({
          bookId,
          frozenSetId,
          ids: {
            createSetId: this.createDraftSetId,
            createNodeId: this.createDraftNodeId,
            createRangeId: this.createDraftRangeId,
          },
          now: this.now(),
        }));
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error, blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  discardDraft(
    bookId: BreakdownBookId,
    draftSetId: StructureSetId,
    expectedDraftRevision: number,
  ): { readonly bookId: BreakdownBookId; readonly discardedDraftSetId: StructureSetId } {
    try {
      return this.libraryService.getUnitOfWork().write((session) =>
        new StructureDraftRepository(session.database).discardCurrent({
          bookId,
          draftSetId,
          expectedDraftRevision,
          now: this.now(),
        }));
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error,
          expectedDraftRevision: error.revision?.expected,
          actualDraftRevision: error.revision?.actual,
          blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  updateNode(
    bookId: BreakdownBookId,
    draftSetId: StructureSetId,
    expectedDraftRevision: number,
    command: StructureNodeMetadataCommand,
  ): DraftStructureSet {
    try {
      return this.libraryService.getUnitOfWork().write((session) =>
        new StructureDraftRepository(session.database).updateNodeMetadata({
          bookId,
          draftSetId,
          expectedDraftRevision,
          command,
          createNodeId: this.createDraftNodeId,
          now: this.now(),
        }));
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error,
          expectedDraftRevision: error.revision?.expected,
          actualDraftRevision: error.revision?.actual,
          blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  updateStoryRange(
    bookId: BreakdownBookId,
    draftSetId: StructureSetId,
    expectedDraftRevision: number,
    command: StructureRangeCommand,
  ): DraftStructureSet {
    try {
      return this.libraryService.getUnitOfWork().write((session) =>
        command.type === 'set-story-range-mode'
          ? new StructureDraftRepository(session.database).setStoryRangeMode({
            bookId, draftSetId, expectedDraftRevision, mode: command.mode, now: this.now(),
          })
          : command.type === 'add-range' || command.type === 'remove-range'
          ? new StructureDraftRepository(session.database).updateRangeCrud({
            bookId, draftSetId, expectedDraftRevision, command,
            createRangeId: this.createDraftRangeId, now: this.now(),
          })
          : command.type === 'set-range-span' || command.type === 'set-range-coverage' ||
            command.type === 'set-range-geometry'
          ? new StructureDraftRepository(session.database).updateRangeGeometry({
            bookId, draftSetId, expectedDraftRevision, command, now: this.now(),
          })
          : new StructureDraftRepository(session.database).updateRangeMetadata({
            bookId, draftSetId, expectedDraftRevision, command, now: this.now(),
          }));
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error,
          expectedDraftRevision: error.revision?.expected,
          actualDraftRevision: error.revision?.actual,
          blockers: error.blockers,
        });
      }
      throw error;
    }
  }

  async freeze(
    bookId: BreakdownBookId,
    draftSetId: StructureSetId,
    expectedDraftRevision: number,
  ): Promise<{ readonly bookId: BreakdownBookId; readonly structureEdition: number }> {
    const pinned = this.libraryService.getCurrent();
    if (!pinned) this.throwNoCurrentLibrary();
    const source = await loadCurrentStructureSourceSnapshot(
      { books: this.books, sourceTexts: this.sourceTexts }, bookId,
    );
    const jobId = this.createJobId();
    try {
      return this.libraryService.getUnitOfWork().write((session) => {
        if (session.sessionId !== pinned.sessionId) this.throwSessionChanged();
        const previousStructureEdition = session.database.prepare(
          'SELECT structure_edition FROM books WHERE id = ?',
        ).pluck().get(bookId) as number | null;
        const frozen = new StructureDraftRepository(session.database).freezeCurrent({
          bookId, draftSetId, expectedDraftRevision,
          currentSourceSnapshot: source.snapshot,
          sourceText: source.sourceText,
          now: this.now(),
        });
        const jobs = new JobService({ database: session.database });
        const payload = {
          title: 'Freeze structure edition' as const,
          structureSetId: frozen.id,
          structureEdition: frozen.structureEdition,
        };
        const createdAt = this.now();
        jobs.createQueued({
          id: jobId, bookId, kind: 'structure_edition', totalUnits: 1,
          payloadSchemaVersion: 1, payload, createdAt, updatedAt: createdAt,
        });
        jobs.transition(jobId, 'running', this.now(), { completedUnits: 0, totalUnits: 1 });
        jobs.completeWithCheckpoint(jobId, {
          bookId, completedUnits: 1, totalUnits: 1, updatedAt: this.now(),
          checkpoint: {
            id: randomUUID(), kind: 'structure_edition_completed', payloadSchemaVersion: 1,
            payload, createdAt: this.now(),
          },
        });
        this.structureEditionChangePort.apply(createStructureEditionChange({
          bookId,
          frozenSetId: frozen.id,
          previousStructureEdition,
          structureEdition: frozen.structureEdition,
        }), { database: session.database });
        return { bookId, structureEdition: frozen.structureEdition };
      });
    } catch (error) {
      if (error instanceof StructureDraftRepositoryError) {
        throw new StructureServiceError(error.reason, error.message, {
          cause: error,
          expectedDraftRevision: error.revision?.expected,
          actualDraftRevision: error.revision?.actual,
          blockers: error.blockers,
        });
      }
      if (
        error instanceof AnalysisModuleInstanceEditionChangeError ||
        error instanceof AnalysisModuleRepositoryError
      ) {
        throw new StructureServiceError('structure_reference_blocked', error.message, {
          cause: error,
          blockers: [error.reason],
        });
      }
      throw error;
    }
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

  recoverDetection(bookId: BreakdownBookId): StructureDetectionStartResult {
    if (this.activeByBookId.has(bookId)) {
      throw new StructureServiceError(
        'structure_detection_in_progress',
        'The active structure detection belongs to this process and cannot be recovered as orphaned.',
      );
    }

    return this.libraryService.getUnitOfWork().write((session) => {
      const runs = new StructureDetectionRunRepository(session.database);
      const orphan = runs.findActiveByBook(bookId);
      if (!orphan) {
        throw new StructureServiceError(
          'structure_detection_recovery_required',
          'No orphaned structure detection is available to recover.',
        );
      }
      runs.markCancelled(orphan.detectionRun.id, this.now());
      new JobService({ database: session.database }).cancel(orphan.job.id, this.now(), {
        runtimeOwner: 'confirmed_stopped',
      });
      return runs.getById(orphan.detectionRun.id)!;
    });
  }

  async waitForIdle(): Promise<void> {
    await Promise.all([...this.activeByJobId.values()].map((active) => active.completion));
  }

  cancelDetection(jobId: JobId): boolean {
    const active = this.activeByJobId.get(jobId);
    if (!active || active.cancelled) {
      return false;
    }

    active.cancelled = true;
    active.controller.abort();
    return true;
  }

  async cancelDetectionAndWait(jobId: JobId): Promise<boolean> {
    const active = this.activeByJobId.get(jobId);
    if (active) {
      this.cancelDetection(jobId);
      await active.completion;
      return true;
    }

    return this.libraryService.getUnitOfWork().write((session) => {
      const runs = new StructureDetectionRunRepository(session.database);
      const orphan = runs.findActiveByJobId(jobId);
      if (!orphan) return false;
      const cancelledAt = this.now();
      runs.markCancelled(orphan.detectionRun.id, cancelledAt);
      new JobService({ database: session.database }).cancel(jobId, cancelledAt, {
        runtimeOwner: 'confirmed_stopped',
      });
      return true;
    });
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
        this.failOrCancel(active, 'cancelled', 'cancelled_by_user');
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
        this.failOrCancel(prepared, 'cancelled', 'cancelled_by_user');
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
      this.failOrCancel(prepared, 'cancelled', 'cancelled_by_user');
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
        new JobService({ database }).cancel(prepared.started.job.id, this.now(), {
          runtimeOwner: 'confirmed_stopped',
        });
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
    originSetId: null,
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

function workspaceFreshness(
  structureSet: StructureSet,
  source: LoadedStructureSourceSnapshot | null,
): { readonly status: 'fresh' | 'stale'; readonly reasons: string[] } {
  if (!source) return { status: 'stale', reasons: ['current_source_unavailable'] };
  const reasons: string[] = [];
  const snapshot = structureSet.sourceSnapshot;
  if (snapshot.sourceTextId !== source.snapshot.sourceTextId) reasons.push('source_text_id_changed');
  if (snapshot.sourceTextEdition !== source.snapshot.sourceTextEdition) reasons.push('source_text_edition_changed');
  if (snapshot.contentHash !== source.snapshot.contentHash) reasons.push('source_content_hash_changed');
  if (snapshot.decodedTextLength !== source.snapshot.decodedTextLength) reasons.push('source_text_length_changed');
  if (snapshot.offsetUnit !== source.snapshot.offsetUnit) reasons.push('source_offset_unit_changed');
  return { status: reasons.length === 0 ? 'fresh' : 'stale', reasons };
}

function workspaceValidation(
  structureSet: StructureSet,
  source: LoadedStructureSourceSnapshot | null,
  purpose: 'candidate_review' | 'freeze',
): NonNullable<StructureWorkspace['validation']['candidate']> {
  if (!source) {
    return {
      valid: false,
      issues: [{
        code: 'current_source_unavailable', message: 'Current source is unavailable.', path: ['sourceSnapshot'],
      }],
    };
  }
  const result = validateStructureSet({
    structureSet,
    currentSourceSnapshot: source.snapshot,
    sourceText: source.sourceText,
    purpose,
  });
  return {
    valid: result.valid,
    issues: result.issues.map((issue) => ({
      code: issue.code,
      message: issue.code,
      path: issue.path.split('.'),
    })),
  };
}
