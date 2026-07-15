import { describe, expect, it } from 'vitest';
import { CONTRACT_REGISTRY } from '../../src/shared/contracts';
import type {
  BreakdownBookId,
  JobId,
  SourceTextId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from '../../src/shared/domain';

type DynamicContract = {
  request: { safeParse(value: unknown): { success: boolean } };
  response: { safeParse(value: unknown): { success: boolean } };
};

const registry = CONTRACT_REGISTRY as unknown as Record<string, DynamicContract>;
const bookId = 'book-1' as BreakdownBookId;
const sourceTextId = 'source-1' as SourceTextId;
const jobId = 'job-1' as JobId;
const runId = 'run-1' as StructureDetectionRunId;
const setId = 'set-1' as StructureSetId;
const nodeId = 'node-1' as StructureNodeId;

const sourceSnapshot = {
  sourceTextId,
  sourceTextEdition: 1,
  contentHash: 'sha256:source',
  decodedTextLength: 24,
  offsetUnit: 'utf16_code_unit',
};

const candidate = {
  id: setId,
  originSetId: null,
  bookId,
  sourceSnapshot,
  nodes: [{
    id: nodeId,
    originId: null,
    kind: 'book',
    title: 'Example Book',
    parentId: null,
    order: 0,
    startOffset: 0,
    endOffset: 24,
    heading: null,
    confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
  }],
  storyRanges: [],
  storyRangeMode: 'included',
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  stage: 'candidate',
  detectionRunId: runId,
  draftRevision: null,
  structureEdition: null,
};

const workspace = {
  bookId,
  latestDetectionRun: {
    id: runId,
    jobId,
    state: 'queued',
    failureReason: null,
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  candidate,
  draft: null,
  frozen: null,
  freshness: {
    candidate: { status: 'fresh', reasons: [] },
    draft: null,
    frozen: null,
  },
  validation: {
    candidate: { valid: true, issues: [] },
    draft: null,
    frozen: null,
  },
  capabilities: {
    canDetect: true,
    canRetryDetection: false,
    canCreateDraft: true,
    canDiscardDraft: false,
    canEditDraft: false,
    canFreeze: false,
    canUnfreeze: false,
    blockers: [],
  },
};

describe('structure review/freeze IPC contracts', () => {
  it('keeps detect strict and exposes the complete review lifecycle channel set', () => {
    expect(registry['structure:detect'].request.safeParse({ bookId }).success).toBe(true);
    expect(registry['structure:detect'].request.safeParse({ bookId, sourcePath: 'C:\\outside.txt' }).success)
      .toBe(false);

    for (const channel of [
      'structure:get',
      'structure:detect',
      'structure:recover-detection',
      'structure:create-draft',
      'structure:create-manual-draft',
      'structure:discard-draft',
      'structure:update-node',
      'structure:update-story-range',
      'structure:freeze',
      'structure:unfreeze',
    ]) {
      expect(registry[channel]).toBeDefined();
    }
  });

  it('pins an explicit stale-frozen replacement to the frozen set being replaced', () => {
    const request = registry['structure:create-draft'].request;
    expect(request.safeParse({ bookId, candidateSetId: setId }).success).toBe(true);
    expect(request.safeParse({
      bookId, candidateSetId: setId, replacementFrozenSetId: 'frozen-1',
    }).success).toBe(true);
    expect(request.safeParse({
      bookId, candidateSetId: setId, replacementFrozenSetId: 'frozen-1', replace: true,
    }).success).toBe(false);
  });

  it('requires manual draft creation to pin the expected failed detection run', () => {
    const request = registry['structure:create-manual-draft'].request;
    expect(request.safeParse({ bookId }).success).toBe(false);
    expect(request.safeParse({
      bookId, expectedFailedDetectionRunId: 'run-failed',
    }).success).toBe(true);
    expect(request.safeParse({
      bookId, expectedFailedDetectionRunId: 'run-failed', bypass: true,
    }).success).toBe(false);
  });

  it('uses one strict node command with book, draft set and expected revision', () => {
    const update = registry['structure:update-node'];
    const request = {
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 3,
      command: { type: 'rename-node', nodeId, title: 'Renamed chapter' },
    };

    expect(update.request.safeParse(request).success).toBe(true);
    expect(update.request.safeParse({ ...request, patch: { title: 'legacy' } }).success).toBe(false);
    expect(update.request.safeParse({
      ...request,
      command: { ...request.command, parentId: nodeId },
    }).success).toBe(false);
    expect(update.request.safeParse({
      ...request,
      command: { type: 'rename-node', nodeId, title: '   ' },
    }).success).toBe(false);
    expect(update.request.safeParse({
      ...request,
      command: { type: 'remove-node', nodeId },
      secondCommand: { type: 'accept-node-low-confidence', nodeId },
    }).success).toBe(false);
    expect(update.request.safeParse({
      bookId, draftSetId: setId, expectedDraftRevision: 3,
      command: { type: 'add-node', kind: 'chapter', title: 'Manual chapter', parentId: nodeId,
        order: 0, startOffset: 0, endOffset: 24 },
    }).success).toBe(true);
    expect(update.request.safeParse({
      bookId, draftSetId: setId, expectedDraftRevision: 3,
      command: { type: 'add-node', kind: 'chapter', title: '   ', parentId: nodeId,
        order: 0, startOffset: 0, endOffset: 24 },
    }).success).toBe(false);
  });

  it('uses one strict story-range command and keeps skip as an explicit aggregate command', () => {
    const update = registry['structure:update-story-range'];
    const base = { bookId, draftSetId: setId, expectedDraftRevision: 3 };

    expect(update.request.safeParse({
      ...base,
      command: {
        type: 'set-range-coverage',
        rangeId: 'range-1',
        coveredChapterIds: [nodeId],
      },
    }).success).toBe(true);
    expect(update.request.safeParse({
      ...base,
      command: {
        type: 'set-range-geometry', rangeId: 'range-1', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 24 }],
      },
    }).success).toBe(true);
    expect(update.request.safeParse({
      ...base,
      command: {
        type: 'set-range-geometry', rangeId: 'range-1', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId], boundaryEvidence: [], extra: true,
      },
    }).success).toBe(false);
    expect(update.request.safeParse({
      ...base,
      command: { type: 'set-story-range-mode', mode: 'skipped_by_user' },
    }).success).toBe(true);
    expect(update.request.safeParse({
      ...base,
      command: {
        type: 'add-range', title: 'New range', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId], functionTags: ['setup'],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 24 }],
        startReason: 'start', endReason: 'end',
      },
    }).success).toBe(true);
    for (const command of [
      { type: 'rename-range', rangeId: 'range-1', title: '   ' },
      {
        type: 'add-range', title: '   ', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId], functionTags: ['setup'],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 24 }],
        startReason: 'start', endReason: 'end',
      },
      {
        type: 'add-range', title: 'Range', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId], functionTags: ['setup'],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 24 }],
        startReason: '\t', endReason: 'end',
      },
      {
        type: 'add-range', title: 'Range', startOffset: 0, endOffset: 24,
        coveredChapterIds: [nodeId], functionTags: ['setup'],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: 24 }],
        startReason: 'start', endReason: '\n',
      },
    ]) {
      expect(update.request.safeParse({ ...base, command }).success).toBe(false);
    }
    expect(update.request.safeParse({
      ...base,
      rangeId: 'range-1',
      patch: { confidence: 0.8 },
    }).success).toBe(false);
  });

  it('makes draft discard explicit and revision guarded', () => {
    const discard = registry['structure:discard-draft'];
    expect(discard.request.safeParse({
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 3,
    }).success).toBe(true);
    expect(discard.request.safeParse({ bookId, draftSetId: setId }).success).toBe(false);
  });

  it('returns current stages plus run reference, freshness, validation and capabilities', () => {
    const get = registry['structure:get'];
    expect(get.response.safeParse({ ok: true, data: workspace }).success).toBe(true);
    expect(get.response.safeParse({
      ok: true,
      data: { ...workspace, sourceText: 'raw source' },
    }).success).toBe(false);
    expect(get.response.safeParse({
      ok: true,
      data: { ...workspace, job: { state: 'queued' } },
    }).success).toBe(false);
  });

  it('requires a stable recoverable refresh shape for revision mismatch', () => {
    const update = registry['structure:update-node'];
    const error = {
      ok: false,
      error: {
        code: 'STRUCTURE_ERROR',
        message: 'The draft changed. Refresh before retrying.',
        recoverable: true,
        details: {
          reason: 'draft_revision_mismatch',
          expectedDraftRevision: 2,
          actualDraftRevision: 3,
          refreshRequired: true,
          blockers: [],
        },
      },
    };
    expect(update.response.safeParse(error).success).toBe(true);
    expect(update.response.safeParse({
      ...error,
      error: { ...error.error, details: { reason: 'draft_revision_mismatch' } },
    }).success).toBe(false);
  });

  it('keeps handled detect failures on the same stable STRUCTURE_ERROR vocabulary', () => {
    const detect = registry['structure:detect'];
    expect(detect.response.safeParse({
      ok: false,
      error: {
        code: 'STRUCTURE_ERROR',
        message: 'Book was not found.',
        recoverable: true,
        details: { reason: 'book_not_found' },
      },
    }).success).toBe(true);
    expect(detect.response.safeParse({
      ok: false,
      error: {
        code: 'STRUCTURE_ERROR',
        message: 'Unknown.',
        recoverable: true,
        details: { reason: 'made_up_reason' },
      },
    }).success).toBe(false);
  });
});
