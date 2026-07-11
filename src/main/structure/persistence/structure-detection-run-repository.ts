import { z } from 'zod';
import type { SqliteDatabase } from '../../db/sqlite';
import {
  breakdownBookIdSchema,
  jobIdSchema,
  structureDetectionRunIdSchema,
  structureDetectionStartResultSchema,
  structureSourceSnapshotSchema,
} from '../../../shared/contracts/schemas';
import type {
  BreakdownBookId,
  JobState,
  StructureDetectionRunId,
  StructureDetectionRunState,
  StructureDetectionStartResult,
  StructureSourceSnapshot,
} from '../../../shared/domain';

const JOB_TITLE = 'Detect structure';
const COMPLETED_CHECKPOINT = 'Structure draft generated.';
const CANCELLED_REASON = 'cancelled_by_user';

const createQueuedInputSchema = z.object({
  runId: structureDetectionRunIdSchema,
  jobId: jobIdSchema,
  bookId: breakdownBookIdSchema,
  sourceSnapshot: structureSourceSnapshotSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export type CreateQueuedStructureDetectionRunInput = z.infer<typeof createQueuedInputSchema>;

const jobPayloadSchema = z.object({
  title: z.literal(JOB_TITLE),
  completedUnits: z.number().int().min(0).max(1),
  totalUnits: z.literal(1),
  checkpointKind: z.literal('structure_draft'),
  checkpointSummary: z.string().min(1).nullable(),
}).strict();

const jobErrorSchema = z.object({
  failureReason: z.string().min(1),
}).strict();
const updatedAtSchema = z.string().datetime({ offset: true });
const failureReasonSchema = z.string().trim().min(1);

type DetectionRunJobRow = {
  run_id: string;
  run_book_id: string;
  run_job_id: string;
  source_text_id: string;
  source_text_edition: number;
  source_content_hash: string;
  decoded_text_length: number;
  offset_unit: StructureSourceSnapshot['offsetUnit'];
  run_state: StructureDetectionRunState;
  run_failure_reason: string | null;
  run_created_at: string;
  run_updated_at: string;
  job_book_id: string | null;
  job_state: JobState;
  job_payload_json: string;
  job_error_json: string | null;
  job_updated_at: string;
};

type SourceMetadataRow = {
  book_id: string;
  source_edition: number;
  content_hash: string;
  current_source_text_id: string | null;
};

export class StructureDetectionRunRepository {
  constructor(private readonly database: SqliteDatabase) {}

  createQueued(inputValue: CreateQueuedStructureDetectionRunInput): StructureDetectionStartResult {
    const input = createQueuedInputSchema.parse(inputValue);
    const create = this.database.transaction(() => {
      this.assertSourceSnapshotMatchesImport(input.bookId, input.sourceSnapshot);
      const payload = queuedPayload();
      this.database.prepare(`
        INSERT INTO jobs (
          id, book_id, type, state, progress, payload_json, error_json, created_at, updated_at
        ) VALUES (?, ?, 'structure_detection', 'queued', 0, ?, NULL, ?, ?)
      `).run(input.jobId, input.bookId, JSON.stringify(payload), input.createdAt, input.createdAt);
      this.database.prepare(`
        INSERT INTO structure_detection_runs (
          id, job_id, book_id, source_text_id, source_text_edition,
          source_content_hash, decoded_text_length, offset_unit, state,
          failure_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'utf16_code_unit', 'queued', NULL, ?, ?)
      `).run(
        input.runId,
        input.jobId,
        input.bookId,
        input.sourceSnapshot.sourceTextId,
        input.sourceSnapshot.sourceTextEdition,
        input.sourceSnapshot.contentHash,
        input.sourceSnapshot.decodedTextLength,
        input.createdAt,
        input.createdAt,
      );
    });

    create();
    return this.requireById(input.runId);
  }

  getById(runId: StructureDetectionRunId): StructureDetectionStartResult | null {
    const row = this.database.prepare(`
      SELECT
        run.id AS run_id,
        run.book_id AS run_book_id,
        run.job_id AS run_job_id,
        run.source_text_id,
        run.source_text_edition,
        run.source_content_hash,
        run.decoded_text_length,
        run.offset_unit,
        run.state AS run_state,
        run.failure_reason AS run_failure_reason,
        run.created_at AS run_created_at,
        run.updated_at AS run_updated_at,
        job.book_id AS job_book_id,
        job.state AS job_state,
        job.payload_json AS job_payload_json,
        job.error_json AS job_error_json,
        job.updated_at AS job_updated_at
      FROM structure_detection_runs run
      JOIN jobs job ON job.id = run.job_id
      WHERE run.id = ? AND job.type = 'structure_detection'
    `).get(runId) as DetectionRunJobRow | undefined;

    return row ? mapStartResult(row) : null;
  }

  findActiveByBook(bookId: BreakdownBookId): StructureDetectionStartResult | null {
    const row = this.database.prepare(`
      SELECT
        run.id AS run_id,
        run.book_id AS run_book_id,
        run.job_id AS run_job_id,
        run.source_text_id,
        run.source_text_edition,
        run.source_content_hash,
        run.decoded_text_length,
        run.offset_unit,
        run.state AS run_state,
        run.failure_reason AS run_failure_reason,
        run.created_at AS run_created_at,
        run.updated_at AS run_updated_at,
        job.book_id AS job_book_id,
        job.state AS job_state,
        job.payload_json AS job_payload_json,
        job.error_json AS job_error_json,
        job.updated_at AS job_updated_at
      FROM structure_detection_runs run
      JOIN jobs job ON job.id = run.job_id
      WHERE run.book_id = ?
        AND run.state IN ('queued', 'running')
        AND job.type = 'structure_detection'
      ORDER BY run.created_at DESC, run.id DESC
      LIMIT 1
    `).get(bookId) as DetectionRunJobRow | undefined;

    return row ? mapStartResult(row) : null;
  }

  markRunning(
    runId: StructureDetectionRunId,
    updatedAtValue: string,
  ): StructureDetectionStartResult {
    const updatedAt = updatedAtSchema.parse(updatedAtValue);
    return this.transitionActivePair(runId, updatedAt, {
      expectedState: 'queued',
      runState: 'running',
      jobState: 'running',
      progress: 0,
      payload: queuedPayload(),
      runFailureReason: null,
      jobError: null,
    });
  }

  markCompleted(
    runId: StructureDetectionRunId,
    updatedAtValue: string,
  ): StructureDetectionStartResult {
    const updatedAt = updatedAtSchema.parse(updatedAtValue);
    return this.transitionActivePair(runId, updatedAt, {
      expectedState: 'running',
      runState: 'completed',
      jobState: 'completed',
      progress: 1,
      payload: completedPayload(),
      runFailureReason: null,
      jobError: null,
    });
  }

  markFailed(
    runId: StructureDetectionRunId,
    failureReasonValue: string,
    updatedAtValue: string,
  ): StructureDetectionStartResult {
    const failureReason = failureReasonSchema.parse(failureReasonValue);
    const updatedAt = updatedAtSchema.parse(updatedAtValue);
    return this.transitionFromAnyActivePair(runId, updatedAt, {
      runState: 'failed',
      jobState: 'failed',
      progress: 0,
      payload: queuedPayload(),
      runFailureReason: failureReason,
      jobError: { failureReason },
    });
  }

  markCancelled(
    runId: StructureDetectionRunId,
    updatedAtValue: string,
  ): StructureDetectionStartResult {
    const updatedAt = updatedAtSchema.parse(updatedAtValue);
    return this.transitionFromAnyActivePair(runId, updatedAt, {
      runState: 'failed',
      jobState: 'cancelled',
      progress: 0,
      payload: queuedPayload(),
      runFailureReason: CANCELLED_REASON,
      jobError: null,
    });
  }

  private transitionActivePair(
    runId: StructureDetectionRunId,
    updatedAt: string,
    transition: PairedTransition & { readonly expectedState: ActiveDetectionState },
  ): StructureDetectionStartResult {
    const update = this.database.transaction(() => {
      const current = this.requireById(runId);
      assertPairedStates(current);
      if (current.detectionRun.state !== transition.expectedState) {
        throw new Error(
          `Invalid structure detection transition ${current.detectionRun.state} -> ${transition.runState}.`,
        );
      }
      this.writeTransition(current, updatedAt, transition);
    });

    update();
    return this.requireById(runId);
  }

  private transitionFromAnyActivePair(
    runId: StructureDetectionRunId,
    updatedAt: string,
    transition: PairedTransition,
  ): StructureDetectionStartResult {
    const update = this.database.transaction(() => {
      const current = this.requireById(runId);
      assertPairedStates(current);
      if (current.detectionRun.state !== 'queued' && current.detectionRun.state !== 'running') {
        throw new Error(
          `Invalid structure detection transition ${current.detectionRun.state} -> ${transition.runState}.`,
        );
      }
      this.writeTransition(current, updatedAt, transition);
    });

    update();
    return this.requireById(runId);
  }

  private writeTransition(
    current: StructureDetectionStartResult,
    updatedAt: string,
    transition: PairedTransition,
  ): void {
    this.database.prepare(`
      UPDATE jobs
      SET state = ?, progress = ?, payload_json = ?, error_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      transition.jobState,
      transition.progress,
      JSON.stringify(transition.payload),
      transition.jobError === null ? null : JSON.stringify(transition.jobError),
      updatedAt,
      current.job.id,
    );
    this.database.prepare(`
      UPDATE structure_detection_runs
      SET state = ?, failure_reason = ?, updated_at = ?
      WHERE id = ? AND job_id = ?
    `).run(
      transition.runState,
      transition.runFailureReason,
      updatedAt,
      current.detectionRun.id,
      current.job.id,
    );
  }

  private requireById(runId: StructureDetectionRunId): StructureDetectionStartResult {
    const result = this.getById(runId);
    if (!result) {
      throw new Error(`Structure detection run ${runId} was not found.`);
    }
    return result;
  }

  private assertSourceSnapshotMatchesImport(
    bookId: string,
    snapshot: StructureSourceSnapshot,
  ): void {
    const source = this.database.prepare(`
      SELECT
        source.book_id,
        source.source_edition,
        source.content_hash,
        book.source_text_id AS current_source_text_id
      FROM source_texts source
      JOIN books book ON book.id = source.book_id
      WHERE source.id = ?
    `).get(snapshot.sourceTextId) as SourceMetadataRow | undefined;

    if (!source ||
      source.book_id !== bookId ||
      source.source_edition !== snapshot.sourceTextEdition ||
      source.content_hash !== snapshot.contentHash) {
      throw new Error('Structure detection source snapshot must match imported source metadata.');
    }

    if (source.current_source_text_id !== snapshot.sourceTextId) {
      throw new Error('Structure detection must use the book current imported source.');
    }
  }
}

type ActiveDetectionState = Extract<StructureDetectionRunState, 'queued' | 'running'>;

type PairedTransition = {
  readonly runState: StructureDetectionRunState;
  readonly jobState: JobState;
  readonly progress: 0 | 1;
  readonly payload: z.infer<typeof jobPayloadSchema>;
  readonly runFailureReason: string | null;
  readonly jobError: z.infer<typeof jobErrorSchema> | null;
};

function assertPairedStates(current: StructureDetectionStartResult): void {
  if (current.detectionRun.state !== current.job.state) {
    throw new Error(
      `Structure detection Job/run states are inconsistent: ${current.job.state}/${current.detectionRun.state}.`,
    );
  }
}

function mapStartResult(row: DetectionRunJobRow): StructureDetectionStartResult {
  const payload = jobPayloadSchema.parse(JSON.parse(row.job_payload_json));
  const jobError = row.job_error_json === null
    ? null
    : jobErrorSchema.parse(JSON.parse(row.job_error_json));

  return structureDetectionStartResultSchema.parse({
    detectionRun: {
      id: row.run_id,
      bookId: row.run_book_id,
      job: {
        jobId: row.run_job_id,
        checkpointKind: payload.checkpointKind,
      },
      sourceSnapshot: {
        sourceTextId: row.source_text_id,
        sourceTextEdition: row.source_text_edition,
        contentHash: row.source_content_hash,
        decodedTextLength: row.decoded_text_length,
        offsetUnit: row.offset_unit,
      },
      state: row.run_state,
      failureReason: row.run_failure_reason,
      createdAt: row.run_created_at,
      updatedAt: row.run_updated_at,
    },
    job: {
      id: row.run_job_id,
      bookId: row.job_book_id,
      state: row.job_state,
      title: payload.title,
      completedUnits: payload.completedUnits,
      totalUnits: payload.totalUnits,
      checkpointSummary: payload.checkpointSummary,
      failureReason: jobError?.failureReason ?? null,
      updatedAt: row.job_updated_at,
    },
  });
}

function queuedPayload() {
  return {
    title: JOB_TITLE,
    completedUnits: 0,
    totalUnits: 1,
    checkpointKind: 'structure_draft',
    checkpointSummary: null,
  } as const;
}

function completedPayload() {
  return {
    ...queuedPayload(),
    completedUnits: 1,
    checkpointSummary: COMPLETED_CHECKPOINT,
  } as const;
}
