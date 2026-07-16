import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import type { LibraryService } from '../../../src/main/library/library-service';
import { createLibraryUnitOfWork, type InternalLibrarySession } from '../../../src/main/library/library-unit-of-work';
import { StructureCandidateRepository } from '../../../src/main/structure/persistence/structure-candidate-repository';
import { StructureDetectionRunRepository } from '../../../src/main/structure/persistence/structure-detection-run-repository';
import { JobService } from '../../../src/main/jobs/job-service';
import { StructureService, type StructureServiceOptions } from '../../../src/main/structure/structure-service';
import { AnalysisModuleInstanceEditionChangePort } from '../../../src/main/modules/analysis-module-instance-edition-change-port';
import { createStructureEditionChange } from '../../../src/main/structure/structure-edition-change-port';
import { executeStructureWorkerDetection } from '../../../src/main/structure/worker/structure-worker-detection';
import type {
  StructureWorkerDetectionInput,
} from '../../../src/main/structure/worker/structure-worker-protocol';
import { UtilityWorkerRunnerError } from '../../../src/main/structure/worker/structure-worker-runner';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../../../src/shared/domain';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
});

describe('StructureService', () => {
  it('rejects a manual draft before an expected failed detection exists', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'manual-service-draft' as StructureSetId,
      createDraftNodeId: () => 'manual-service-root' as StructureNodeId,
    });
    await expect(service.createManualDraft(
      'book-1' as BreakdownBookId,
      'missing-run' as StructureDetectionRunId,
    )).rejects.toMatchObject({
      reason: 'structure_reference_blocked', blockers: ['failed_detection_run_changed'],
    });
  });

  it('offers manual draft after detection fails for a new source while only a stale candidate remains', async () => {
    const fixture = structureLibraryFixture();
    const initial = structureService(fixture, immediateWorker());
    await initial.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await initial.waitForIdle();

    const replacementText = `${fixture.decodedText}\nnew source edition`;
    const bytes = Buffer.from(replacementText, 'utf8');
    const replacementHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const relativePath = 'source/source-2/example.md';
    const sourcePath = path.join(fixture.context.rootPath, ...relativePath.split('/'));
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, bytes);
    fixture.database.prepare(`INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES ('source-2', 'book-1', 'md', ?, 'utf-8', 2, ?,
      '2026-07-15T13:00:00.000Z', 'example.md', ?)`)
      .run(replacementHash, relativePath, bytes.byteLength);
    fixture.database.prepare("UPDATE books SET current_source_text_id = 'source-2' WHERE id = 'book-1'").run();

    const failed = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_CRASH', 'Detection failed.');
      },
    }, {
      createRunId: () => 'run-2' as StructureDetectionRunId,
      createJobId: () => 'job-2' as JobId,
      createDraftSetId: () => 'manual-after-stale-candidate' as StructureSetId,
      createDraftNodeId: () => 'manual-after-stale-root' as StructureNodeId,
      now: () => '2026-07-15T14:00:00.000Z',
    });
    await failed.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await failed.waitForIdle();

    await expect(failed.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      latestDetectionRun: { state: 'failed' },
      freshness: { candidate: { status: 'stale' } },
      capabilities: { canCreateDraft: false, canCreateManualDraft: true },
    });
    await expect(failed.createManualDraft(
      'book-1' as BreakdownBookId,
      'run-2' as StructureDetectionRunId,
    )).resolves.toMatchObject({
      id: 'manual-after-stale-candidate', originSetId: null, detectionRunId: null,
      sourceSnapshot: { sourceTextId: 'source-2', sourceTextEdition: 2 },
      nodes: [{ id: 'manual-after-stale-root', kind: 'book' }],
    });
  });

  it('keeps manual fallback hidden when a failed retry still has a fresh candidate', async () => {
    const fixture = structureLibraryFixture();
    const initial = structureService(fixture, immediateWorker());
    await initial.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await initial.waitForIdle();
    const failed = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_CRASH', 'Detection failed.');
      },
    }, {
      createRunId: () => 'run-2' as StructureDetectionRunId,
      createJobId: () => 'job-2' as JobId,
      now: () => '2026-07-15T15:00:00.000Z',
    });
    await failed.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await failed.waitForIdle();

    await expect(failed.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      latestDetectionRun: { state: 'failed' },
      freshness: { candidate: { status: 'fresh' } },
      capabilities: { canCreateDraft: true, canCreateManualDraft: false },
    });
    await expect(failed.createManualDraft(
      'book-1' as BreakdownBookId,
      'run-2' as StructureDetectionRunId,
    )).rejects.toMatchObject({
      reason: 'structure_reference_blocked', blockers: ['fresh_candidate_requires_draft'],
    });
  });
  it('exposes only the queued active-registry detection entrypoint', () => {
    const service = new StructureService({
      libraryService: closedLibraryService(),
      worker: cancellationAwareWorker(),
    });

    expect(service).toHaveProperty('startDetection');
    expect(service).not.toHaveProperty('detectStructure');
  });

  it('returns a queued checkpoint before the deferred worker completes in background', async () => {
    const fixture = structureLibraryFixture();
    const deferred = deferredWorkerResult();
    const service = structureService(fixture, {
      detect: () => deferred.promise,
    });

    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });

    expect(started).toMatchObject({
      detectionRun: { id: 'run-1', state: 'queued' },
      job: { id: 'job-1', state: 'queued' },
    });
    expect(service.activeCount).toBe(1);
    expect(currentCandidateCount(fixture.database)).toBe(0);

    deferred.resolve({
      result: executeStructureWorkerDetection({
        bookTitle: 'Example Book',
        sourceText: fixture.decodedText,
      }),
      workerPid: 4242,
    });
    await service.waitForIdle();

    expectDetectionState(fixture.database, 'completed', 'completed');
    expect(currentCandidateCount(fixture.database)).toBe(1);
    expect(service.activeCount).toBe(0);
  });

  it('rejects a second active detection for the same book', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, cancellationAwareWorker());
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'structure_detection_in_progress' });
    await expect(service.createManualDraft(
      'book-1' as BreakdownBookId,
      'run-1' as StructureDetectionRunId,
    )).rejects.toMatchObject({
      reason: 'structure_detection_in_progress', blockers: ['structure_detection_in_progress'],
    });
    expect(() => service.recoverDetection('book-1' as BreakdownBookId))
      .toThrow(expect.objectContaining({ reason: 'structure_detection_in_progress' }));

    expect(service.cancelAll()).toBe(1);
    await service.waitForIdle();
  });

  it('recovers an orphan SQLite run and then permits retry', async () => {
    const fixture = structureLibraryFixture();
    new JobService({ database: fixture.database }).createQueued({
      id: 'orphan-job' as JobId,
      bookId: 'book-1' as BreakdownBookId,
      kind: 'structure_detection',
      totalUnits: 1,
      payloadSchemaVersion: 1,
      payload: {
        title: 'Detect structure',
        sourceTextId: 'source-1',
        sourceTextEdition: 1,
        contentHash: fixture.contentHash,
      },
      createdAt: '2026-07-11T00:00:30.000Z',
      updatedAt: '2026-07-11T00:00:30.000Z',
    });
    new StructureDetectionRunRepository(fixture.database).createQueued({
      runId: 'orphan-run' as StructureDetectionRunId,
      jobId: 'orphan-job' as JobId,
      bookId: 'book-1' as BreakdownBookId,
      sourceSnapshot: {
        sourceTextId: 'source-1' as import('../../../src/shared/domain').SourceTextId,
        sourceTextEdition: 1,
        contentHash: fixture.contentHash,
        decodedTextLength: fixture.decodedText.length,
        offsetUnit: 'utf16_code_unit',
      },
      createdAt: '2026-07-11T00:00:30.000Z',
    });
    const service = structureService(fixture, immediateWorker());

    await expect(service.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      latestDetectionRun: { id: 'orphan-run', state: 'queued' },
      capabilities: {
        canDetect: false,
        canRetryDetection: false,
        blockers: expect.arrayContaining(['structure_detection_recovery_required']),
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'structure_detection_recovery_required' });

    fixture.database.exec(`CREATE TRIGGER fail_orphan_job_cancel
      BEFORE UPDATE OF state ON jobs
      WHEN OLD.id = 'orphan-job' AND NEW.state = 'cancelled'
      BEGIN SELECT RAISE(ABORT, 'forced recovery rollback'); END`);
    expect(() => service.recoverDetection('book-1' as BreakdownBookId)).toThrow('forced recovery rollback');
    expect(fixture.database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'orphan-run'").pluck().get())
      .toBe('queued');
    expect(fixture.database.prepare("SELECT state FROM jobs WHERE id = 'orphan-job'").pluck().get())
      .toBe('queued');
    fixture.database.exec('DROP TRIGGER fail_orphan_job_cancel');

    expect(service.recoverDetection('book-1' as BreakdownBookId)).toMatchObject({
      detectionRun: { id: 'orphan-run', state: 'failed', failureReason: 'cancelled_by_user' },
      job: { id: 'orphan-job', state: 'cancelled' },
    });
    await expect(service.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      capabilities: { canDetect: true, canRetryDetection: true },
    });

    const retried = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    expect(retried.detectionRun.state).toBe('queued');
    await service.waitForIdle();
  });

  it('persists cancellation before aborting the active worker', async () => {
    const fixture = structureLibraryFixture();
    let stateObservedDuringAbort: { run: unknown; job: unknown } | null = null;
    const service = structureService(fixture, cancellationAwareWorker(() => {
      stateObservedDuringAbort = {
        run: fixture.database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get(),
        job: fixture.database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get(),
      };
    }));
    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await new Promise((resolve) => setImmediate(resolve));

    expect(service.cancelDetection(started.job.id)).toBe(true);
    expect(stateObservedDuringAbort).toEqual({ run: 'failed', job: 'cancelled' });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'cancelled');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('contains a background timeout after the queued IPC-style result has returned', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_TIMEOUT', 'Timed out.');
      },
    });
    const started = await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 5 });

    expect(started.job.state).toBe('queued');
    await service.waitForIdle();

    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
    expect(service.activeCount).toBe(0);
  });

  it('rejects detection before a library is open', async () => {
    const service = new StructureService({
      libraryService: closedLibraryService(),
      worker: {
        async detect(input) {
          return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
        },
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'no_current_library' });
  });

  it('reads the current imported snapshot, runs the worker, validates, and atomically completes a candidate', async () => {
    const fixture = structureLibraryFixture();
    const workerInputs: StructureWorkerDetectionInput[] = [];
    const worker = {
      async detect(input: StructureWorkerDetectionInput) {
        workerInputs.push(input);
        return {
          result: executeStructureWorkerDetection(input),
          workerPid: 4242,
        };
      },
    };
    const service = new StructureService({
      libraryService: libraryServiceForFixture(fixture),
      worker,
      createRunId: () => 'run-1' as StructureDetectionRunId,
      createJobId: () => 'job-1' as JobId,
      createCandidateSetId: () => 'candidate-1' as StructureSetId,
      now: sequenceClock(),
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database).getCurrentCandidate(
      'book-1' as BreakdownBookId,
    );

    expect(workerInputs).toEqual([{
      bookTitle: 'Example Book',
      sourceText: fixture.decodedText,
    }]);
    expect(candidate).toMatchObject({
        id: 'candidate-1',
        stage: 'candidate',
        detectionRunId: 'run-1',
        storyRangeMode: 'included',
        sourceSnapshot: {
          sourceTextId: 'source-1',
          sourceTextEdition: 1,
          contentHash: fixture.contentHash,
          decodedTextLength: fixture.decodedText.length,
          offsetUnit: 'utf16_code_unit',
        },
    });
    expect(new StructureDetectionRunRepository(fixture.database).getById(
      'run-1' as StructureDetectionRunId,
    )).toMatchObject({
      detectionRun: { state: 'completed' },
      job: {
        state: 'completed',
        completedUnits: 1,
        checkpointSummary: 'Structure draft generated.',
      },
    });
  });

  it('pins getWorkspace to the library session captured before source IO', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker());
    const workspace = service.getWorkspace('book-1' as BreakdownBookId);
    (fixture.context as { sessionId: string }).sessionId = 'session-2';
    await expect(workspace).rejects.toMatchObject({ reason: 'library_session_changed' });
  });

  it('clones a fresh candidate into a revision-1 draft with globally new lineage ids', async () => {
    const fixture = structureLibraryFixture();
    let nodeIndex = 0;
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-1' as StructureSetId,
      createDraftNodeId: () => `draft-node-${++nodeIndex}` as import('../../../src/shared/domain').StructureNodeId,
      createDraftRangeId: () => 'draft-range-1' as import('../../../src/shared/domain').StorySegmentRangeId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;

    const draft = service.createDraft('book-1' as BreakdownBookId, candidate.id);

    expect(draft).toMatchObject({
      id: 'draft-1', originSetId: candidate.id, stage: 'draft', draftRevision: 1,
      detectionRunId: null, structureEdition: null,
    });
    expect(draft.nodes.map(({ originId }) => originId)).toEqual(candidate.nodes.map(({ id }) => id));
    expect(new Set(draft.nodes.map(({ id }) => id)).size).toBe(draft.nodes.length);
    expect(draft.nodes.every(({ id }) => !candidate.nodes.some((node) => node.id === id))).toBe(true);
    expect(draft.storyRanges.map(({ originId }) => originId))
      .toEqual(candidate.storyRanges.map(({ id }) => id));
    expect(new StructureCandidateRepository(fixture.database).getCurrentCandidate(candidate.bookId)?.id)
      .toBe(candidate.id);
  });

  it('rejects stale candidates and an existing current draft without changing either aggregate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-1' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);
    expect(() => service.createDraft(candidate.bookId, candidate.id))
      .toThrowError(expect.objectContaining({ reason: 'draft_already_exists' }));
    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_sets WHERE stage = 'draft'").pluck().get()).toBe(1);
    expect(draft.id).toBe('draft-1');

    fixture.database.prepare("UPDATE structure_sets SET is_current = 0 WHERE stage = 'draft'").run();
    fixture.database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
    expect(() => service.createDraft(candidate.bookId, candidate.id))
      .toThrowError(expect.objectContaining({ reason: 'candidate_stale' }));
    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_sets WHERE stage = 'draft' AND is_current = 1").pluck().get()).toBe(0);
  });

  it('rolls back a partial draft clone when a generated global id collides', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-rollback' as StructureSetId,
      createDraftNodeId: () => 'duplicate-node' as import('../../../src/shared/domain').StructureNodeId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;

    expect(() => service.createDraft(candidate.bookId, candidate.id)).toThrow();
    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_sets WHERE id = 'draft-rollback'").pluck().get()).toBe(0);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_nodes WHERE structure_set_id = 'draft-rollback'").pluck().get()).toBe(0);
    expect(new StructureCandidateRepository(fixture.database).getCurrentCandidate(candidate.bookId)?.id).toBe(candidate.id);
  });

  it('discards the expected current draft without deleting its historical aggregate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-discard' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);
    const childCount = fixture.database.prepare(
      "SELECT COUNT(*) FROM structure_nodes WHERE structure_set_id = 'draft-discard'",
    ).pluck().get();

    expect(service.discardDraft(candidate.bookId, draft.id, 1)).toEqual({
      bookId: candidate.bookId,
      discardedDraftSetId: draft.id,
    });
    expect(fixture.database.prepare(
      "SELECT is_current FROM structure_sets WHERE id = 'draft-discard'",
    ).pluck().get()).toBe(0);
    expect(fixture.database.prepare(
      "SELECT COUNT(*) FROM structure_nodes WHERE structure_set_id = 'draft-discard'",
    ).pluck().get()).toBe(childCount);
  });

  it('allows stale draft discard but rejects a wrong set or revision without mutation', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-guarded' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);

    expect(() => service.discardDraft(candidate.bookId, draft.id, 2)).toThrowError(
      expect.objectContaining({
        reason: 'draft_revision_mismatch',
        expectedDraftRevision: 2,
        actualDraftRevision: 1,
      }),
    );
    expect(() => service.discardDraft(candidate.bookId, 'other-draft' as StructureSetId, 1))
      .toThrowError(expect.objectContaining({ reason: 'draft_not_found' }));
    expect(fixture.database.prepare(
      "SELECT is_current FROM structure_sets WHERE id = 'draft-guarded'",
    ).pluck().get()).toBe(1);

    fixture.database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
    expect(service.discardDraft(candidate.bookId, draft.id, 1).discardedDraftSetId).toBe(draft.id);
    expect(fixture.database.prepare(
      "SELECT is_current FROM structure_sets WHERE id = 'draft-guarded'",
    ).pluck().get()).toBe(0);
  });

  it('renames one draft node, marks a low-confidence correction, and increments revision once', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-metadata' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);
    const node = draft.nodes[1];
    fixture.database.prepare(`UPDATE structure_nodes
      SET confidence_level = 'low', low_confidence_resolution = 'unresolved'
      WHERE id = ?`).run(node.id);

    const updated = service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'rename-node', nodeId: node.id, title: 'Corrected chapter',
    });

    expect(updated.draftRevision).toBe(2);
    expect(updated.nodes.find(({ id }) => id === node.id)).toMatchObject({
      title: 'Corrected chapter',
      confidence: { level: 'low', lowConfidenceResolution: 'corrected' },
    });
    expect(candidate.nodes.find(({ id }) => id === node.originId)?.title).not.toBe('Corrected chapter');
  });

  it('accepts one unresolved low-confidence node without changing its metadata', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-accept' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);
    const node = draft.nodes[1];
    fixture.database.prepare(`UPDATE structure_nodes
      SET confidence_level = 'low', low_confidence_resolution = 'unresolved'
      WHERE id = ?`).run(node.id);

    const updated = service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'accept-node-low-confidence', nodeId: node.id,
    });
    expect(updated).toMatchObject({ draftRevision: 2 });
    expect(updated.nodes.find(({ id }) => id === node.id)).toMatchObject({
      title: node.title,
      confidence: { level: 'low', lowConfidenceResolution: 'accepted' },
    });
  });

  it('rejects stale, wrong-node and revision-conflicted metadata edits without mutation', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker(), {
      createDraftSetId: () => 'draft-metadata-guarded' as StructureSetId,
    });
    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    const candidate = new StructureCandidateRepository(fixture.database)
      .getCurrentCandidate('book-1' as BreakdownBookId)!;
    const draft = service.createDraft(candidate.bookId, candidate.id);
    const node = draft.nodes[1];

    expect(() => service.updateNode(candidate.bookId, draft.id, 2, {
      type: 'rename-node', nodeId: node.id, title: 'No write',
    })).toThrowError(expect.objectContaining({ reason: 'draft_revision_mismatch' }));
    expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'rename-node', nodeId: 'missing-node' as typeof node.id, title: 'No write',
    })).toThrowError(expect.objectContaining({ reason: 'node_not_found' }));
    fixture.database.prepare("UPDATE source_texts SET content_hash = 'sha256:changed' WHERE id = 'source-1'").run();
    expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'rename-node', nodeId: node.id, title: 'No write',
    })).toThrowError(expect.objectContaining({ reason: 'draft_stale' }));
    expect(fixture.database.prepare("SELECT draft_revision FROM structure_sets WHERE id = 'draft-metadata-guarded'").pluck().get()).toBe(1);
    expect(fixture.database.prepare('SELECT title FROM structure_nodes WHERE id = ?').pluck().get(node.id)).toBe(node.title);
  });

  it('moves a node by atomically reindexing both sibling lists', async () => {
    const { fixture, service, candidate, draft } = await detectedDraftFixture('draft-move');
    const root = draft.nodes.find(({ kind }) => kind === 'book')!;
    const siblings = draft.nodes.filter(({ parentId }) => parentId === root.id);
    const moved = siblings.at(-1)!;

    const updated = service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'move-node', nodeId: moved.id, parentId: root.id, order: 0,
    });

    expect(updated.draftRevision).toBe(2);
    expect(updated.nodes.filter(({ parentId }) => parentId === root.id)
      .sort((left, right) => left.order - right.order)
      .map(({ id, order }) => ({ id, order })))
      .toEqual([moved, ...siblings.filter(({ id }) => id !== moved.id)]
        .map(({ id }, order) => ({ id, order })));
    expect(new StructureCandidateRepository(fixture.database).getCurrentCandidate(candidate.bookId)?.nodes)
      .toEqual(candidate.nodes);
  });

  it('removes an unreferenced leaf and compacts its former sibling order', async () => {
    const { fixture, service, candidate, draft } = await detectedDraftFixture('draft-remove');
    const root = draft.nodes.find(({ kind }) => kind === 'book')!;
    const order = draft.nodes.filter(({ parentId }) => parentId === root.id).length;
    fixture.database.prepare(`INSERT INTO structure_nodes (
      id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, confidence_score, confidence_level,
      created_at, updated_at
    ) VALUES ('removable-node', ?, NULL, 'chapter', 'Removable', ?, ?, 0, 1, 1, 'high', ?, ?)`)
      .run(draft.id, root.id, order, draft.createdAt, draft.updatedAt);

    const updated = service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'remove-node', nodeId: 'removable-node' as import('../../../src/shared/domain').StructureNodeId,
    });

    expect(updated.draftRevision).toBe(2);
    expect(updated.nodes.some(({ id }) => id === 'removable-node')).toBe(false);
    expect(updated.nodes.filter(({ parentId }) => parentId === root.id)
      .sort((left, right) => left.order - right.order).map(({ order: value }) => value))
      .toEqual([...Array(order).keys()]);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM structure_nodes WHERE id = 'removable-node'").pluck().get()).toBe(0);
  });

  it('returns blockers instead of cascading node children or story-range coverage', async () => {
    const { fixture, service, candidate, draft } = await detectedDraftFixture('draft-blocked-remove');
    const root = draft.nodes.find(({ kind }) => kind === 'book')!;
    expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'remove-node', nodeId: root.id,
    })).toThrowError(expect.objectContaining({
      reason: 'structure_reference_blocked',
      blockers: expect.arrayContaining([expect.stringMatching(/^child:/)]),
    }));
    const covered = draft.storyRanges[0]?.coveredChapterIds[0];
    if (covered) {
      expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
        type: 'remove-node', nodeId: covered,
      })).toThrowError(expect.objectContaining({
        reason: 'structure_reference_blocked',
        blockers: expect.arrayContaining([expect.stringMatching(/^story-range:/)]),
      }));
    }
    expect(fixture.database.prepare("SELECT draft_revision FROM structure_sets WHERE id = 'draft-blocked-remove'").pluck().get()).toBe(1);
  });

  it('rejects topology cycles and invalid parent span without changing revision', async () => {
    const { fixture, service, candidate, draft } = await detectedDraftFixture('draft-invalid-move');
    const root = draft.nodes.find(({ kind }) => kind === 'book')!;
    const child = draft.nodes.find(({ parentId }) => parentId === root.id)!;
    expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'move-node', nodeId: root.id, parentId: child.id, order: 0,
    })).toThrowError(expect.objectContaining({
      reason: 'structure_reference_blocked',
      blockers: expect.arrayContaining(['cycle']),
    }));
    fixture.database.prepare(`INSERT INTO structure_nodes (
      id, structure_set_id, origin_id, kind, title, parent_id, sort_order,
      start_offset, end_offset, confidence_score, confidence_level, created_at, updated_at
    ) VALUES ('narrow-volume', ?, NULL, 'volume', 'Narrow', ?, 99, 0, 1, 1, 'high', ?, ?)`)
      .run(draft.id, root.id, draft.createdAt, draft.updatedAt);
    expect(() => service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'move-node', nodeId: child.id,
      parentId: 'narrow-volume' as import('../../../src/shared/domain').StructureNodeId,
      order: 0,
    })).toThrowError(expect.objectContaining({
      reason: 'structure_reference_blocked',
      blockers: expect.arrayContaining(['parent_span']),
    }));
    expect(fixture.database.prepare("SELECT draft_revision FROM structure_sets WHERE id = 'draft-invalid-move'").pluck().get()).toBe(1);
  });

  it('routes set-node-span through the same revision-guarded aggregate transaction', async () => {
    const { service, candidate, draft } = await detectedDraftFixture('draft-span-service');
    const chapter = draft.nodes.find(({ kind }) => kind === 'chapter')!;
    const updated = service.updateNode(candidate.bookId, draft.id, 1, {
      type: 'set-node-span', nodeId: chapter.id,
      startOffset: chapter.startOffset,
      endOffset: chapter.endOffset - 1,
    });
    expect(updated).toMatchObject({ draftRevision: 2 });
    expect(updated.nodes.find(({ id }) => id === chapter.id)?.endOffset).toBe(chapter.endOffset - 1);
  });

  it('routes strict range metadata through the same revision-guarded aggregate transaction', async () => {
    const { service, candidate, draft } = await detectedDraftFixture('draft-range-service');
    const range = draft.storyRanges[0];
    const updated = service.updateStoryRange(candidate.bookId, draft.id, 1, {
      type: 'set-range-function-tags', rangeId: range.id, functionTags: ['setup'],
    });
    expect(updated).toMatchObject({ draftRevision: 2 });
    expect(updated.storyRanges.find(({ id }) => id === range.id)?.suggestedFunctionTags).toEqual(['setup']);
  });

  it('makes cross-chapter range geometry reachable through strict atomic commands', async () => {
    const { service, candidate, draft } = await detectedDraftFixture('draft-range-geometry-service');
    const range = draft.storyRanges[0];
    const chapters = draft.nodes.filter(({ kind }) => kind === 'chapter');
    const narrowed = service.updateStoryRange(candidate.bookId, draft.id, 1, {
      type: 'set-range-geometry', rangeId: range.id,
      startOffset: chapters[0].startOffset, endOffset: chapters[0].endOffset,
      coveredChapterIds: [chapters[0].id],
      boundaryEvidence: [{
        kind: 'chapter_window', startOffset: chapters[0].startOffset, endOffset: chapters[0].endOffset,
      }],
    });
    expect(narrowed).toMatchObject({ draftRevision: 2 });
    const expanded = service.updateStoryRange(candidate.bookId, draft.id, 2, {
      type: 'set-range-geometry', rangeId: range.id,
      startOffset: range.startOffset, endOffset: range.endOffset,
      coveredChapterIds: range.coveredChapterIds,
      boundaryEvidence: [{
        kind: 'chapter_window', startOffset: range.startOffset, endOffset: range.endOffset,
      }],
    });
    expect(expanded).toMatchObject({ draftRevision: 3 });
    expect(expanded.storyRanges[0]).toMatchObject({
      startOffset: range.startOffset, endOffset: range.endOffset,
      coveredChapterIds: range.coveredChapterIds,
    });
  });

  it('routes add/remove range CRUD while keeping range ids main-generated', async () => {
    let rangeIdIndex = 0;
    const { service, candidate, draft } = await detectedDraftFixture('draft-range-crud-service', {
      createDraftRangeId: () => `service-range-${++rangeIdIndex}` as import('../../../src/shared/domain').StorySegmentRangeId,
    });
    const range = draft.storyRanges[0];
    const removed = service.updateStoryRange(candidate.bookId, draft.id, 1, {
      type: 'remove-range', rangeId: range.id,
    });
    expect(removed).toMatchObject({ draftRevision: 2, storyRanges: [] });
    const added = service.updateStoryRange(candidate.bookId, draft.id, 2, {
      type: 'add-range', title: range.title, startOffset: range.startOffset, endOffset: range.endOffset,
      coveredChapterIds: range.coveredChapterIds, functionTags: range.suggestedFunctionTags,
      boundaryEvidence: range.boundaryEvidence, startReason: range.startReason, endReason: range.endReason,
    });
    expect(added).toMatchObject({ draftRevision: 3 });
    expect(added.storyRanges[0]).toMatchObject({ id: 'service-range-2', originId: null });
  });

  it('routes story range mode changes through the revision-guarded aggregate transaction', async () => {
    const { service, candidate, draft } = await detectedDraftFixture('draft-range-mode-service');
    const skipped = service.updateStoryRange(candidate.bookId, draft.id, 1, {
      type: 'set-story-range-mode', mode: 'skipped_by_user',
    });
    expect(skipped).toMatchObject({
      draftRevision: 2, storyRangeMode: 'skipped_by_user', storyRanges: [],
    });
    expect(() => service.updateStoryRange(candidate.bookId, draft.id, 2, {
      type: 'add-range', title: draft.storyRanges[0].title,
      startOffset: draft.storyRanges[0].startOffset, endOffset: draft.storyRanges[0].endOffset,
      coveredChapterIds: draft.storyRanges[0].coveredChapterIds,
      functionTags: draft.storyRanges[0].suggestedFunctionTags,
      boundaryEvidence: draft.storyRanges[0].boundaryEvidence,
      startReason: draft.storyRanges[0].startReason, endReason: draft.storyRanges[0].endReason,
    })).toThrowError(expect.objectContaining({
      reason: 'structure_reference_blocked', blockers: ['story_range_mode_skipped'],
    }));
    const included = service.updateStoryRange(candidate.bookId, draft.id, 2, {
      type: 'set-story-range-mode', mode: 'included',
    });
    expect(included).toMatchObject({
      draftRevision: 3, storyRangeMode: 'included', storyRanges: [],
    });
  });

  it('freezes a validated draft with a completed structure-edition Job and checkpoint', async () => {
    let jobIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture('draft-freeze-service', {
      createJobId: () => `freeze-job-${++jobIndex}` as JobId,
    });
    let revision = 1;
    for (const node of draft.nodes.filter(({ confidence }) =>
      confidence.level === 'low' && confidence.lowConfidenceResolution === 'unresolved')) {
      service.updateNode(candidate.bookId, draft.id, revision, {
        type: 'accept-node-low-confidence', nodeId: node.id,
      });
      revision += 1;
    }
    for (const range of draft.storyRanges.filter(({ confidence }) =>
      confidence.level === 'low' && confidence.lowConfidenceResolution === 'unresolved')) {
      service.updateStoryRange(candidate.bookId, draft.id, revision, {
        type: 'accept-range-low-confidence', rangeId: range.id,
      });
      revision += 1;
    }
    const frozen = await service.freeze(candidate.bookId, draft.id, revision);
    expect(frozen).toEqual({ bookId: candidate.bookId, structureEdition: 1 });
    expect(fixture.database.prepare(`SELECT stage, draft_revision, structure_edition, is_current
      FROM structure_sets WHERE id = ?`).get(draft.id)).toEqual({
      stage: 'frozen', draft_revision: null, structure_edition: 1, is_current: 1,
    });
    expect(fixture.database.prepare(`SELECT kind, state, completed_units, total_units
      FROM jobs WHERE kind = 'structure_edition'`).get()).toEqual({
      kind: 'structure_edition', state: 'completed', completed_units: 1, total_units: 1,
    });
    expect(fixture.database.prepare(`SELECT kind, sequence FROM job_checkpoints
      WHERE kind = 'structure_edition_completed'`).get()).toEqual({
      kind: 'structure_edition_completed', sequence: 1,
    });
  });

  it('rolls set, book edition, Job, and checkpoint back when freeze completion fails', async () => {
    let jobIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture('draft-freeze-rollback', {
      createJobId: () => `rollback-job-${++jobIndex}` as JobId,
    });
    fixture.database.prepare(`UPDATE structure_nodes SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    fixture.database.prepare(`UPDATE story_segment_ranges SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    fixture.database.exec(`CREATE TRIGGER reject_structure_edition_checkpoint
      BEFORE INSERT ON job_checkpoints
      WHEN NEW.kind = 'structure_edition_completed'
      BEGIN SELECT RAISE(ABORT, 'reject structure edition checkpoint'); END`);

    await expect(service.freeze(candidate.bookId, draft.id, 1)).rejects.toThrow(
      'reject structure edition checkpoint',
    );
    expect(fixture.database.prepare(`SELECT stage, draft_revision, structure_edition
      FROM structure_sets WHERE id = ?`).get(draft.id)).toEqual({
      stage: 'draft', draft_revision: 1, structure_edition: null,
    });
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBeNull();
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'")
      .pluck().get()).toBe(0);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM job_checkpoints WHERE kind = 'structure_edition_completed'")
      .pluck().get()).toBe(0);
  });

  it('calls the edition change port once for first and replacement freeze with the new edition visible', async () => {
    let jobIndex = 0;
    let setIndex = 0;
    let nodeIndex = 0;
    let rangeIndex = 0;
    const calls: unknown[] = [];
    const { service, candidate, draft, fixture } = await detectedDraftFixture('unused-port-draft', {
      createJobId: () => `port-job-${++jobIndex}` as JobId,
      createDraftSetId: () => `port-draft-${++setIndex}` as StructureSetId,
      createDraftNodeId: () => `port-node-${++nodeIndex}` as StructureNodeId,
      createDraftRangeId: () => `port-range-${++rangeIndex}` as import('../../../src/shared/domain').StorySegmentRangeId,
      structureEditionChangePort: {
        apply(change, { database }) {
          calls.push({
            change,
            visibleEdition: database.prepare('SELECT structure_edition FROM books WHERE id = ?')
              .pluck().get(change.bookId),
          });
          return undefined;
        },
      },
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    expect(calls).toEqual([]);
    const firstReady = await service.getWorkspace(candidate.bookId);
    await service.freeze(candidate.bookId, draft.id, firstReady.draft!.draftRevision);
    const replacement = service.unfreeze(candidate.bookId, draft.id);
    expect(calls).toHaveLength(1);
    await service.freeze(candidate.bookId, replacement.id, replacement.draftRevision);

    expect(calls).toMatchObject([
      { change: { previousStructureEdition: null, structureEdition: 1 }, visibleEdition: 1 },
      { change: { previousStructureEdition: 1, structureEdition: 2 }, visibleEdition: 2 },
    ]);
  });

  it('does not call the edition change port for create, edit, unfreeze, or discard', async () => {
    const calls: unknown[] = [];
    const { service, candidate, draft } = await detectedDraftFixture('non-freeze-port-draft', {
      createJobId: (() => { let index = 0; return () => `non-freeze-job-${++index}` as JobId; })(),
      createDraftSetId: (() => { let index = 0; return () => `non-freeze-draft-${++index}` as StructureSetId; })(),
      createDraftNodeId: (() => { let index = 0; return () => `non-freeze-node-${++index}` as StructureNodeId; })(),
      createDraftRangeId: (() => { let index = 0; return () => `non-freeze-range-${++index}` as import('../../../src/shared/domain').StorySegmentRangeId; })(),
      structureEditionChangePort: { apply(change) { calls.push(change); return undefined; } },
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    expect(calls).toEqual([]);
    const ready = await service.getWorkspace(candidate.bookId);
    await service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision);
    calls.length = 0;
    const reopened = service.unfreeze(candidate.bookId, draft.id);
    const root = reopened.nodes.find(({ kind }) => kind === 'book')!;
    const edited = service.updateNode(candidate.bookId, reopened.id, reopened.draftRevision, {
      type: 'rename-node', nodeId: root.id, title: 'Renamed after unfreeze',
    });
    service.discardDraft(candidate.bookId, edited.id, edited.draftRevision);
    expect(calls).toEqual([]);
  });

  it('rolls the frozen set, Book edition, Job, and checkpoint back when the edition change port throws', async () => {
    let jobIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture('port-rollback-draft', {
      createJobId: () => `port-rollback-job-${++jobIndex}` as JobId,
      structureEditionChangePort: {
        apply(change, { database }) {
          expect(change.structureEdition).toBe(1);
          expect(database.prepare('SELECT structure_edition FROM books WHERE id = ?')
            .pluck().get(change.bookId)).toBe(1);
          throw new Error('reject downstream invalidation');
        },
      },
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const ready = await service.getWorkspace(candidate.bookId);

    await expect(service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision))
      .rejects.toThrow('reject downstream invalidation');
    expect(fixture.database.prepare('SELECT stage, draft_revision, structure_edition FROM structure_sets WHERE id = ?')
      .get(draft.id)).toEqual({ stage: 'draft', draft_revision: ready.draft!.draftRevision, structure_edition: null });
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?').pluck().get(candidate.bookId))
      .toBeNull();
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'").pluck().get()).toBe(0);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM job_checkpoints WHERE kind = 'structure_edition_completed'")
      .pluck().get()).toBe(0);
  });

  it('creates seven book-scope shells on first freeze and preserves their source edition on replacement', async () => {
    let jobIndex = 0;
    let instanceIndex = 0;
    let draftIndex = 0;
    const instancePort = new AnalysisModuleInstanceEditionChangePort({
      createInstanceId: () => `runtime-instance-${++instanceIndex}` as import('../../../src/shared/domain').AnalysisModuleInstanceId,
      createJobId: () => 'runtime-shell-job' as JobId,
      now: () => '2026-07-15T12:00:00.000Z',
    });
    const { service, candidate, draft, fixture } = await detectedDraftFixture('instance-first-freeze', {
      createJobId: () => `instance-freeze-job-${++jobIndex}` as JobId,
      createDraftSetId: () => `instance-runtime-draft-${++draftIndex}` as StructureSetId,
      structureEditionChangePort: instancePort,
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const firstReady = await service.getWorkspace(candidate.bookId);

    await service.freeze(candidate.bookId, draft.id, firstReady.draft!.draftRevision);

    expect(fixture.database.prepare(`
      SELECT COUNT(*) FROM analysis_module_instances
      WHERE book_id = ? AND scope_kind = 'book'
    `).pluck().get(candidate.bookId)).toBe(7);
    expect(fixture.database.prepare(`
      SELECT DISTINCT source_structure_set_id AS sourceSetId,
        structure_edition AS structureEdition, status
      FROM analysis_module_instances WHERE book_id = ?
    `).all(candidate.bookId)).toEqual([{
      sourceSetId: draft.id,
      structureEdition: 1,
      status: 'not_generated',
    }]);
    const shellJob = fixture.database.prepare(`
      SELECT id, book_id AS bookId, kind, state, completed_units AS completedUnits,
        total_units AS totalUnits, payload_json AS payloadJson
      FROM jobs WHERE kind = 'analysis_module_shell_creation'
    `).get() as {
      id: string; bookId: string; kind: string; state: string;
      completedUnits: number; totalUnits: number; payloadJson: string;
    };
    expect(shellJob).toMatchObject({
      id: 'runtime-shell-job',
      bookId: candidate.bookId,
      kind: 'analysis_module_shell_creation',
      state: 'completed',
      completedUnits: 7,
      totalUnits: 7,
    });
    expect(JSON.parse(shellJob.payloadJson)).toEqual({
      title: 'Create analysis module shells',
      structureSetId: draft.id,
      structureEdition: 1,
      instanceIds: Array.from({ length: 7 }, (_, index) => `runtime-instance-${index + 1}`),
    });
    expect(fixture.database.prepare(`
      SELECT job_id AS jobId, sequence, kind, payload_json AS payloadJson
      FROM job_checkpoints WHERE job_id = ?
    `).get(shellJob.id)).toEqual({
      jobId: 'runtime-shell-job',
      sequence: 1,
      kind: 'analysis_module_shell_creation_completed',
      payloadJson: shellJob.payloadJson,
    });
    instancePort.apply(createStructureEditionChange({
      bookId: candidate.bookId,
      frozenSetId: draft.id,
      previousStructureEdition: null,
      structureEdition: 1,
    }), { database: fixture.database });
    expect(instanceIndex).toBe(7);
    expect(fixture.database.prepare(`
      SELECT COUNT(*) FROM jobs WHERE kind = 'analysis_module_shell_creation'
    `).pluck().get()).toBe(1);

    const replacement = service.unfreeze(candidate.bookId, draft.id);
    await service.freeze(candidate.bookId, replacement.id, replacement.draftRevision);

    expect(instanceIndex).toBe(7);
    expect(fixture.database.prepare(`
      SELECT COUNT(*) FROM jobs WHERE kind = 'analysis_module_shell_creation'
    `).pluck().get()).toBe(1);
    expect(fixture.database.prepare(`
      SELECT COUNT(*) FROM analysis_module_instances WHERE book_id = ?
    `).pluck().get(candidate.bookId)).toBe(7);
    expect(fixture.database.prepare(`
      SELECT DISTINCT source_structure_set_id AS sourceSetId,
        structure_edition AS structureEdition, status
      FROM analysis_module_instances WHERE book_id = ?
    `).all(candidate.bookId)).toEqual([{
      sourceSetId: draft.id,
      structureEdition: 1,
      status: 'needs_rebuild',
    }]);
  });

  it('rolls the freeze and seven-shell batch back when its final checkpoint fails', async () => {
    let jobIndex = 0;
    let instanceIndex = 0;
    const instancePort = new AnalysisModuleInstanceEditionChangePort({
      createInstanceId: () => `checkpoint-instance-${++instanceIndex}` as import('../../../src/shared/domain').AnalysisModuleInstanceId,
      createJobId: () => 'checkpoint-shell-job' as JobId,
      now: () => '2026-07-15T13:00:00.000Z',
    });
    const { service, candidate, draft, fixture } = await detectedDraftFixture('checkpoint-shell-draft', {
      createJobId: () => `checkpoint-freeze-job-${++jobIndex}` as JobId,
      structureEditionChangePort: instancePort,
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const ready = await service.getWorkspace(candidate.bookId);
    fixture.database.exec(`CREATE TRIGGER reject_module_shell_checkpoint
      BEFORE INSERT ON job_checkpoints
      WHEN NEW.kind = 'analysis_module_shell_creation_completed'
      BEGIN SELECT RAISE(ABORT, 'reject module shell checkpoint'); END`);

    await expect(service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision))
      .rejects.toThrow('reject module shell checkpoint');
    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(0);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'analysis_module_shell_creation'")
      .pluck().get()).toBe(0);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'")
      .pluck().get()).toBe(0);
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBeNull();
    expect(fixture.database.prepare('SELECT stage FROM structure_sets WHERE id = ?')
      .pluck().get(draft.id)).toBe('draft');

    fixture.database.exec('DROP TRIGGER reject_module_shell_checkpoint');
    await service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision);
    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(7);
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'analysis_module_shell_creation'")
      .pluck().get()).toBe(1);
  });

  it('rolls back a partial shell insert when the ID factory throws and retries atomically', async () => {
    let jobIndex = 0;
    let instanceAttempt = 0;
    let rejectOnce = true;
    const instancePort = new AnalysisModuleInstanceEditionChangePort({
      createInstanceId: () => {
        instanceAttempt += 1;
        if (rejectOnce && instanceAttempt === 4) {
          rejectOnce = false;
          throw new Error('synthetic runtime instance id failure');
        }
        return `retry-instance-${instanceAttempt}` as import('../../../src/shared/domain').AnalysisModuleInstanceId;
      },
    });
    const { service, candidate, draft, fixture } = await detectedDraftFixture('instance-retry-freeze', {
      createJobId: () => `instance-retry-job-${++jobIndex}` as JobId,
      structureEditionChangePort: instancePort,
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const ready = await service.getWorkspace(candidate.bookId);

    await expect(service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision))
      .rejects.toThrow('synthetic runtime instance id failure');
    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(0);
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBeNull();
    expect(fixture.database.prepare('SELECT stage FROM structure_sets WHERE id = ?')
      .pluck().get(draft.id)).toBe('draft');

    await service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision);

    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(7);
    expect(fixture.database.prepare(`
      SELECT COUNT(*) FROM (
        SELECT book_id, module_id, scope_kind, COUNT(*) AS count
        FROM analysis_module_instances
        GROUP BY book_id, module_id, scope_kind HAVING count > 1
      )
    `).pluck().get()).toBe(0);
  });

  it.each([
    {
      label: 'one book-scope instance is missing',
      corrupt(database: SqliteDatabase, bookId: BreakdownBookId) {
        database.prepare(`
          DELETE FROM analysis_module_instances
          WHERE book_id = ? AND module_id = 'world_rules'
        `).run(bookId);
      },
    },
    {
      label: 'seven instances have a mismatched module ID set',
      corrupt(database: SqliteDatabase, bookId: BreakdownBookId) {
        database.exec('PRAGMA foreign_keys = OFF');
        try {
          database.prepare(`
            UPDATE analysis_module_instances SET module_id = 'corrupt-module-id'
            WHERE book_id = ? AND module_id = 'world_rules'
          `).run(bookId);
        } finally {
          database.exec('PRAGMA foreign_keys = ON');
        }
      },
    },
  ])('maps an incomplete instance contract and rolls replacement freeze back when $label', async ({ corrupt }) => {
    let jobIndex = 0;
    let draftIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture(
      'incomplete-instance-initial-draft',
      {
        createJobId: () => `incomplete-instance-job-${++jobIndex}` as JobId,
        createDraftSetId: () => `incomplete-instance-draft-${++draftIndex}` as StructureSetId,
        structureEditionChangePort: new AnalysisModuleInstanceEditionChangePort(),
      },
    );
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const firstReady = await service.getWorkspace(candidate.bookId);
    await service.freeze(candidate.bookId, draft.id, firstReady.draft!.draftRevision);
    corrupt(fixture.database, candidate.bookId);
    const replacement = service.unfreeze(candidate.bookId, draft.id);

    await expect(service.freeze(candidate.bookId, replacement.id, replacement.draftRevision))
      .rejects.toMatchObject({
        reason: 'structure_reference_blocked',
        blockers: ['book_scope_instances_incomplete'],
      });
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBe(1);
    expect(fixture.database.prepare(`
      SELECT stage, structure_edition AS structureEdition
      FROM structure_sets WHERE id = ?
    `).get(replacement.id)).toEqual({ stage: 'draft', structureEdition: null });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'")
      .pluck().get()).toBe(1);
  });

  it('maps a source snapshot mismatch and rolls replacement freeze back', async () => {
    let jobIndex = 0;
    let draftIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture(
      'source-mismatch-instance-draft',
      {
        createJobId: () => `source-mismatch-job-${++jobIndex}` as JobId,
        createDraftSetId: () => `source-mismatch-draft-${++draftIndex}` as StructureSetId,
        structureEditionChangePort: new AnalysisModuleInstanceEditionChangePort(),
      },
    );
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const firstReady = await service.getWorkspace(candidate.bookId);
    await service.freeze(candidate.bookId, draft.id, firstReady.draft!.draftRevision);
    fixture.database.exec('DROP TRIGGER trg_analysis_module_instances_scope_integrity_update');
    fixture.database.prepare(`
      UPDATE analysis_module_instances SET structure_edition = 99
      WHERE book_id = ? AND module_id = 'world_rules'
    `).run(candidate.bookId);
    const replacement = service.unfreeze(candidate.bookId, draft.id);

    await expect(service.freeze(candidate.bookId, replacement.id, replacement.draftRevision))
      .rejects.toMatchObject({
        reason: 'structure_reference_blocked',
        blockers: ['book_scope_instance_source_mismatch'],
      });
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBe(1);
    expect(fixture.database.prepare(`
      SELECT stage, structure_edition AS structureEdition
      FROM structure_sets WHERE id = ?
    `).get(replacement.id)).toEqual({ stage: 'draft', structureEdition: null });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'")
      .pluck().get()).toBe(1);
  });

  it('maps a damaged module contract and rolls first freeze back before retrying atomically', async () => {
    let jobIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture(
      'damaged-module-contract-draft',
      {
        createJobId: () => `damaged-contract-job-${++jobIndex}` as JobId,
        structureEditionChangePort: new AnalysisModuleInstanceEditionChangePort(),
      },
    );
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const ready = await service.getWorkspace(candidate.bookId);
    fixture.database.prepare(`
      UPDATE analysis_modules SET name = 'damaged module name'
      WHERE id = 'world_rules'
    `).run();

    await expect(service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision))
      .rejects.toMatchObject({
        reason: 'structure_reference_blocked',
        blockers: ['module_contract_unavailable'],
      });
    expect(fixture.database.prepare('SELECT structure_edition FROM books WHERE id = ?')
      .pluck().get(candidate.bookId)).toBeNull();
    expect(fixture.database.prepare(`
      SELECT stage, structure_edition AS structureEdition
      FROM structure_sets WHERE id = ?
    `).get(draft.id)).toEqual({ stage: 'draft', structureEdition: null });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_edition'")
      .pluck().get()).toBe(0);
    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances')
      .pluck().get()).toBe(0);

    fixture.database.prepare(`
      UPDATE analysis_modules SET name = '世界设定与规则'
      WHERE id = 'world_rules'
    `).run();
    await service.freeze(candidate.bookId, draft.id, ready.draft!.draftRevision);
    expect(fixture.database.prepare('SELECT COUNT(*) FROM analysis_module_instances')
      .pluck().get()).toBe(7);
  });

  it('pins freeze to the library session captured before source IO', async () => {
    const { service, candidate, draft, fixture } = await detectedDraftFixture('draft-freeze-session');
    fixture.database.prepare(`UPDATE structure_nodes SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    fixture.database.prepare(`UPDATE story_segment_ranges SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    const freezing = service.freeze(candidate.bookId, draft.id, 1);
    (fixture.context as { sessionId: string }).sessionId = 'session-2';
    await expect(freezing).rejects.toMatchObject({ reason: 'library_session_changed' });
    expect(fixture.database.prepare('SELECT stage FROM structure_sets WHERE id = ?')
      .pluck().get(draft.id)).toBe('draft');
  });

  it('routes unfreeze to a new revision-1 draft while the frozen edition stays current', async () => {
    let jobIndex = 0;
    let nodeIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture('draft-unfreeze-service', {
      createJobId: () => `unfreeze-job-${++jobIndex}` as JobId,
      createDraftSetId: (() => {
        let setIndex = 0;
        return () => `unfreeze-set-${++setIndex}` as StructureSetId;
      })(),
      createDraftNodeId: () => `unfreeze-service-node-${++nodeIndex}` as import('../../../src/shared/domain').StructureNodeId,
      createDraftRangeId: (() => {
        let rangeIndex = 0;
        return () => `unfreeze-service-range-${++rangeIndex}` as import('../../../src/shared/domain').StorySegmentRangeId;
      })(),
    });
    fixture.database.prepare(`UPDATE structure_nodes SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    fixture.database.prepare(`UPDATE story_segment_ranges SET low_confidence_resolution = 'accepted'
      WHERE structure_set_id = ? AND confidence_level = 'low'`).run(draft.id);
    await service.freeze(candidate.bookId, draft.id, 1);
    const reopened = service.unfreeze(candidate.bookId, draft.id);
    expect(reopened).toMatchObject({ stage: 'draft', draftRevision: 1, originSetId: draft.id });
    expect(fixture.database.prepare('SELECT is_current FROM structure_sets WHERE id = ?')
      .pluck().get(draft.id)).toBe(1);
  });

  it('returns the current review workspace without source paths, text, or duplicated Job state', async () => {
    let jobIndex = 0;
    const { service, candidate, draft } = await detectedDraftFixture('draft-workspace-service', {
      createJobId: () => `workspace-job-${++jobIndex}` as JobId,
    });
    const review = await service.getWorkspace(candidate.bookId);
    expect(review).toMatchObject({
      bookId: candidate.bookId,
      candidate: { id: candidate.id },
      draft: { id: draft.id },
      frozen: null,
      freshness: { candidate: { status: 'fresh' }, draft: { status: 'fresh' }, frozen: null },
      capabilities: { canDetect: true, canCreateDraft: false, canEditDraft: true, canUnfreeze: false },
    });
    expect(review.latestDetectionRun).toMatchObject({ id: candidate.detectionRunId, state: 'completed' });
    expect(JSON.stringify(review)).not.toMatch(/"relativePath"|"sourceText"|"jobState"|"payloadJson"/);

    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    const accepted = await service.getWorkspace(candidate.bookId);
    expect(accepted.capabilities.canFreeze).toBe(true);
    await service.freeze(candidate.bookId, draft.id, accepted.draft!.draftRevision);
    const frozen = await service.getWorkspace(candidate.bookId);
    expect(frozen).toMatchObject({
      draft: null, frozen: { id: draft.id, structureEdition: 1 },
      capabilities: { canCreateDraft: false, canFreeze: false, canUnfreeze: true },
    });
    expect(() => service.createDraft(candidate.bookId, candidate.id)).toThrowError(expect.objectContaining({
      reason: 'structure_reference_blocked', blockers: ['current_frozen_requires_unfreeze'],
    }));
  });

  it('exposes and executes replacement draft only for a fresh post-frozen candidate over stale frozen source', async () => {
    let setIndex = 0;
    let jobIndex = 0;
    const { service, candidate, draft, fixture } = await detectedDraftFixture('unused', {
      createDraftSetId: () => `source-change-draft-${++setIndex}` as StructureSetId,
      createJobId: () => `source-change-job-${++jobIndex}` as JobId,
    });
    fixtureReviewAcceptAll(service, candidate.bookId, draft);
    await service.freeze(candidate.bookId, draft.id,
      (await service.getWorkspace(candidate.bookId)).draft!.draftRevision);

    const replacementTime = '2026-07-10T12:00:00.000Z';
    const sourceId = 'source-2';
    const relativePath = 'source/source-2/example.md';
    const sourcePath = path.join(fixture.context.rootPath, ...relativePath.split('/'));
    const replacementText = `${fixture.decodedText}\n`;
    const bytes = Buffer.from(replacementText, 'utf8');
    const replacementHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, bytes);
    fixture.database.prepare(`INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES (?, 'book-1', 'md', ?, 'utf-8', 2, ?, ?, 'example.md', ?)`)
      .run(sourceId, replacementHash, relativePath, replacementTime, bytes.byteLength);
    fixture.database.prepare("UPDATE books SET current_source_text_id = 'source-2' WHERE id = 'book-1'").run();
    fixture.database.exec(`
      INSERT INTO jobs (id, book_id, kind, state, completed_units, total_units,
        payload_schema_version, payload_json, created_at, updated_at)
        VALUES ('source-change-job-3', 'book-1', 'structure_detection', 'completed', 1, 1, 1,
          '{"title":"Detect structure","sourceTextId":"source-2","sourceTextEdition":2,"contentHash":"${replacementHash}"}',
          '${replacementTime}', '${replacementTime}');
      INSERT INTO structure_detection_runs (id, job_id, book_id, source_text_id,
        source_text_edition, source_content_hash, decoded_text_length, offset_unit,
        state, failure_reason, created_at, updated_at, run_sequence)
        VALUES ('run-2', 'source-change-job-3', 'book-1', 'source-2', 2, '${replacementHash}',
          ${replacementText.length}, 'utf16_code_unit', 'completed', NULL,
          '${replacementTime}', '${replacementTime}', 2);
    `);
    const nodeIds = new Map(candidate.nodes.map((node, index) => [
      node.id, `source-change-candidate-node-${index}` as StructureNodeId,
    ]));
    const nextCandidate = {
      ...candidate,
      id: 'source-change-candidate' as StructureSetId,
      sourceSnapshot: {
        ...candidate.sourceSnapshot,
        sourceTextId: sourceId as typeof candidate.sourceSnapshot.sourceTextId,
        sourceTextEdition: 2, contentHash: replacementHash,
        decodedTextLength: replacementText.length,
      },
      nodes: candidate.nodes.map((node) => ({
        ...node, id: nodeIds.get(node.id)!,
        parentId: node.parentId === null ? null : nodeIds.get(node.parentId)!,
      })),
      storyRanges: candidate.storyRanges.map((range, index) => ({
        ...range,
        id: `source-change-candidate-range-${index}` as typeof range.id,
        coveredChapterIds: range.coveredChapterIds.map((id) => nodeIds.get(id)!),
      })),
      detectionRunId: 'run-2' as StructureDetectionRunId,
      createdAt: replacementTime,
      updatedAt: replacementTime,
    };
    new StructureCandidateRepository(fixture.database).replaceCurrentCandidate(nextCandidate);

    await expect(service.getWorkspace(candidate.bookId)).resolves.toMatchObject({
      freshness: { candidate: { status: 'fresh' }, frozen: { status: 'stale' } },
      capabilities: { canCreateDraft: false, canCreateReplacementDraft: true, canUnfreeze: false },
    });
    const replacement = service.createDraft(candidate.bookId, nextCandidate.id, draft.id);
    expect(replacement).toMatchObject({
      originSetId: nextCandidate.id, draftRevision: 1,
      sourceSnapshot: { sourceTextId: sourceId, sourceTextEdition: 2 },
    });
    expect(fixture.database.prepare('SELECT is_current FROM structure_sets WHERE id = ?')
      .pluck().get(draft.id)).toBe(1);
  });

  it('rejects an unknown book but degrades a known book with no current source', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, immediateWorker());

    await expect(service.getWorkspace('missing-book' as BreakdownBookId)).rejects.toMatchObject({
      name: 'StructureSourceSnapshotError', reason: 'book_not_found',
    });

    fixture.database.prepare("UPDATE books SET current_source_text_id = NULL WHERE id = 'book-1'").run();
    await expect(service.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      bookId: 'book-1', candidate: null, draft: null, frozen: null,
      capabilities: { canDetect: false, blockers: expect.arrayContaining(['current_source_unavailable']) },
    });
  });

  it('marks a timed-out worker as failed without persisting a candidate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_TIMEOUT', 'Timed out.');
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 5 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('maps AbortSignal cancellation to cancelled Job state without a candidate', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        throw new UtilityWorkerRunnerError('UTILITY_WORKER_CANCELLED', 'Cancelled.');
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, {
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'cancelled');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('returns deterministic detection failure and persists the failed checkpoint', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect() {
        return {
          result: executeStructureWorkerDetection({
            bookTitle: 'Example Book',
            sourceText: 'Only prose remains.',
          }),
          workerPid: 4242,
        };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expect(new StructureDetectionRunRepository(fixture.database).getById(
      'run-1' as StructureDetectionRunId,
    )).toMatchObject({
      detectionRun: { state: 'failed', failureReason: 'structure_detection_failed' },
      job: { state: 'failed', failureReason: 'structure_detection_failed' },
    });
    expect(currentCandidateCount(fixture.database)).toBe(0);
    await expect(service.getWorkspace('book-1' as BreakdownBookId)).resolves.toMatchObject({
      latestDetectionRun: { state: 'failed', failureReason: 'structure_detection_failed' },
      candidate: null,
      capabilities: { canDetect: true, canRetryDetection: true },
    });
  });

  it('blocks a candidate with validator errors and records a stable failure', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect(input) {
        const result = executeStructureWorkerDetection(input);
        if (result.structure.status === 'structure_detection_failed') {
          throw new Error('Expected a candidate fixture.');
        }
        result.structure.nodes[0].endOffset = input.sourceText.length - 1;
        return { result, workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rejects a source changed while the worker was running', async () => {
    const fixture = structureLibraryFixture();
    const service = structureService(fixture, {
      async detect(input) {
        const result = executeStructureWorkerDetection(input);
        writeFileSync(fixture.sourcePath, Buffer.from('Changed after worker start.', 'utf8'));
        return { result, workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rolls candidate insertion back when completed checkpoint persistence fails', async () => {
    const fixture = structureLibraryFixture();
    fixture.database.exec(`
      CREATE TRIGGER reject_structure_job_completed
      BEFORE UPDATE OF state ON jobs
      FOR EACH ROW
      WHEN NEW.state = 'completed' AND OLD.kind = 'structure_detection'
      BEGIN
        SELECT RAISE(ABORT, 'reject completed checkpoint');
      END;
    `);
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
    await service.waitForIdle();
    expectDetectionState(fixture.database, 'failed', 'failed');
    expect(currentCandidateCount(fixture.database)).toBe(0);
  });

  it('rejects a changed source hash before creating a detection Job', async () => {
    const fixture = structureLibraryFixture();
    writeFileSync(fixture.sourcePath, Buffer.from('Externally changed.', 'utf8'));
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'source_hash_mismatch' });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_detection'").pluck().get())
      .toBe(0);
  });

  it('rejects an imported relative path that escapes the library root before creating a Job', async () => {
    const fixture = structureLibraryFixture();
    fixture.database.prepare("UPDATE source_texts SET relative_path = '../outside.md' WHERE id = 'source-1'").run();
    const service = structureService(fixture, {
      async detect(input) {
        return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
      },
    });

    await expect(service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 }))
      .rejects.toMatchObject({ reason: 'source_read_failed' });
    expect(fixture.database.prepare("SELECT COUNT(*) FROM jobs WHERE kind = 'structure_detection'").pluck().get())
      .toBe(0);
  });
});

function structureLibraryFixture(): {
  readonly context: InternalLibrarySession;
  readonly database: SqliteDatabase;
  readonly decodedText: string;
  readonly contentHash: string;
  readonly sourcePath: string;
} {
  const rootPath = mkdtempSync(path.join(os.tmpdir(), 'writestorm-structure-service-'));
  const database = openSqliteDatabase(':memory:');
  cleanups.push(() => database.close(), () => rmSync(rootPath, { recursive: true, force: true }));
  runMigrations(database, APP_MIGRATIONS);

  const decodedText = [
    'Chapter 1: Start',
    'Body',
    'Chapter 2: Continue',
    'Body',
    '',
    '---',
    '',
    'Chapter 3: Aftermath',
    'Body',
  ].join('\r\n');
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(decodedText, 'utf8')]);
  const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const relativePath = 'source/source-1/example.md';
  const sourcePath = path.join(rootPath, ...relativePath.split('/'));
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, bytes);

  const now = '2026-07-11T00:00:00.000Z';
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-1', 'Example', '0.1.0', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO books (id, title, created_at, updated_at)
    VALUES ('book-1', 'Example Book', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, format, content_hash, encoding, source_edition, relative_path,
      imported_at, original_file_name, size_bytes
    ) VALUES ('source-1', 'book-1', 'md', ?, 'utf-8', 1, ?, ?, 'example.md', ?)
  `).run(contentHash, relativePath, now, bytes.byteLength);
  database.prepare("UPDATE books SET current_source_text_id = 'source-1' WHERE id = 'book-1'").run();

  return {
    database,
    decodedText,
    contentHash,
    sourcePath,
    context: {
      sessionId: 'session-1',
      rootPath,
      manifestPath: path.join(rootPath, 'library.json'),
      databasePath: path.join(rootPath, 'library.sqlite'),
      database,
      library: {
        id: 'library-1' as LibraryId,
        name: 'Example',
        rootPath,
        schemaVersion: 2,
        appVersion: '0.1.0',
      },
    },
  };
}

async function detectedDraftFixture(draftId: string, overrides: Partial<StructureServiceOptions> = {}) {
  const fixture = structureLibraryFixture();
  const service = structureService(fixture, immediateWorker(), {
    createDraftSetId: () => draftId as StructureSetId,
    ...overrides,
  });
  await service.startDetection('book-1' as BreakdownBookId, { timeoutMs: 1_000 });
  await service.waitForIdle();
  const candidate = new StructureCandidateRepository(fixture.database)
    .getCurrentCandidate('book-1' as BreakdownBookId)!;
  const draft = service.createDraft(candidate.bookId, candidate.id);
  return { fixture, service, candidate, draft };
}

function structureService(
  fixture: ReturnType<typeof structureLibraryFixture>,
  worker: {
    detect(
      input: StructureWorkerDetectionInput,
      timeoutMs: number,
      options?: { readonly signal?: AbortSignal },
    ): Promise<{
      result: ReturnType<typeof executeStructureWorkerDetection>;
      workerPid: number;
    }>;
  },
  overrides: Partial<StructureServiceOptions> = {},
): StructureService {
  return new StructureService({
    libraryService: libraryServiceForFixture(fixture),
    worker,
    createRunId: () => 'run-1' as StructureDetectionRunId,
    createJobId: () => 'job-1' as JobId,
    createCandidateSetId: () => 'candidate-1' as StructureSetId,
    now: sequenceClock(),
    ...overrides,
  });
}

function fixtureReviewAcceptAll(
  service: StructureService,
  bookId: BreakdownBookId,
  draft: ReturnType<StructureService['createDraft']>,
): void {
  let revision = draft.draftRevision;
  for (const node of draft.nodes.filter(({ confidence }) =>
    confidence.level === 'low' && confidence.lowConfidenceResolution === 'unresolved')) {
    service.updateNode(bookId, draft.id, revision, {
      type: 'accept-node-low-confidence', nodeId: node.id,
    });
    revision += 1;
  }
  for (const range of draft.storyRanges.filter(({ confidence }) =>
    confidence.level === 'low' && confidence.lowConfidenceResolution === 'unresolved')) {
    service.updateStoryRange(bookId, draft.id, revision, {
      type: 'accept-range-low-confidence', rangeId: range.id,
    });
    revision += 1;
  }
}

function immediateWorker() {
  return {
    async detect(input: StructureWorkerDetectionInput) {
      return { result: executeStructureWorkerDetection(input), workerPid: 4242 };
    },
  };
}

function libraryServiceForFixture(
  fixture: { readonly context: InternalLibrarySession },
): LibraryService {
  const unitOfWork = createLibraryUnitOfWork(() => fixture.context);
  return {
    getCurrent: () => ({ sessionId: fixture.context.sessionId, library: fixture.context.library }),
    getUnitOfWork: () => unitOfWork,
  } as LibraryService;
}

function closedLibraryService(): LibraryService {
  const unitOfWork = createLibraryUnitOfWork(() => null);
  return {
    getCurrent: () => null,
    getUnitOfWork: () => unitOfWork,
  } as LibraryService;
}

function expectDetectionState(
  database: SqliteDatabase,
  runState: string,
  jobState: string,
): void {
  expect(database.prepare("SELECT state FROM structure_detection_runs WHERE id = 'run-1'").pluck().get())
    .toBe(runState);
  expect(database.prepare("SELECT state FROM jobs WHERE id = 'job-1'").pluck().get()).toBe(jobState);
}

function currentCandidateCount(database: SqliteDatabase): number {
  return database.prepare(`
    SELECT COUNT(*) FROM structure_sets
    WHERE book_id = 'book-1' AND stage = 'candidate' AND is_current = 1
  `).pluck().get() as number;
}

function deferredWorkerResult() {
  let resolve!: (value: {
    result: ReturnType<typeof executeStructureWorkerDetection>;
    workerPid: number;
  }) => void;
  const promise = new Promise<{
    result: ReturnType<typeof executeStructureWorkerDetection>;
    workerPid: number;
  }>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cancellationAwareWorker(onAbort?: () => void) {
  return {
    detect(
      _input: StructureWorkerDetectionInput,
      _timeoutMs: number,
      options?: { readonly signal?: AbortSignal },
    ) {
      return new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          onAbort?.();
          reject(new UtilityWorkerRunnerError('UTILITY_WORKER_CANCELLED', 'Cancelled.'));
        }, { once: true });
      });
    },
  };
}

function sequenceClock(): () => string {
  const values = [
    '2026-07-11T00:01:00.000Z',
    '2026-07-11T00:02:00.000Z',
    '2026-07-11T00:03:00.000Z',
    '2026-07-11T00:04:00.000Z',
    '2026-07-11T00:05:00.000Z',
  ];
  let index = 0;
  return () => values[index++] ?? values.at(-1)!;
}
