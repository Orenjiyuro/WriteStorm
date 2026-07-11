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
  request: {
    safeParse(value: unknown): { success: boolean };
  };
  response: {
    safeParse(value: unknown): { success: boolean };
  };
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

const detectionRun = {
  id: runId,
  bookId,
  job: {
    jobId,
    checkpointKind: 'structure_draft',
  },
  sourceSnapshot,
  state: 'queued',
  failureReason: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
};

const workspace = {
  bookId,
  detectionRun,
  candidate: {
    id: setId,
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
      confidence: {
        score: 1,
        level: 'high',
        lowConfidenceResolution: null,
      },
    }],
    storyRanges: [],
    storyRangeMode: 'included',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    stage: 'candidate',
    detectionRunId: runId,
    draftRevision: null,
    structureEdition: null,
  },
  draft: null,
  frozen: null,
};

describe('structure detection IPC contracts', () => {
  it('adds a strict detect request without allowing source paths or source text', () => {
    const detect = registry['structure:detect'];

    expect(detect).toBeDefined();
    expect(detect.request.safeParse({ bookId }).success).toBe(true);
    expect(detect.request.safeParse({ bookId, sourcePath: 'C:\\outside.txt' }).success).toBe(false);
    expect(detect.request.safeParse({ bookId, sourceText: 'raw source' }).success).toBe(false);
  });

  it('requires a stable reason for handled STRUCTURE_ERROR detect failures', () => {
    const detect = registry['structure:detect'];
    const baseError = {
      code: 'STRUCTURE_ERROR',
      message: 'Book was not found in the current library.',
      recoverable: true,
    };

    expect(detect.response.safeParse({
      ok: false,
      error: {
        ...baseError,
        details: { reason: 'book_not_found' },
      },
    }).success).toBe(true);
    expect(detect.response.safeParse({
      ok: false,
      error: baseError,
    }).success).toBe(false);
    expect(detect.response.safeParse({
      ok: false,
      error: {
        ...baseError,
        details: { reason: 'made_up_reason' },
      },
    }).success).toBe(false);
  });

  it('returns a workspace with candidate, draft, frozen and visible Job state instead of a flattened structure', () => {
    const get = registry['structure:get'];
    const detect = registry['structure:detect'];

    expect(get.response.safeParse({ ok: true, data: workspace }).success).toBe(true);
    expect(get.response.safeParse({
      ok: true,
      data: {
        nodes: [],
        storyRanges: [],
        structureEdition: null,
      },
    }).success).toBe(false);
    expect(detect.response.safeParse({
      ok: true,
      data: {
        detectionRun,
        job: {
          id: jobId,
          bookId,
          state: 'queued',
          title: 'Detect structure',
          completedUnits: 0,
          totalUnits: 1,
          checkpointSummary: null,
          failureReason: null,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      },
    }).success).toBe(true);
  });

  it('rejects unusable nodes and ranges from ordinary candidate IPC success', () => {
    const get = registry['structure:get'];

    expect(get.response.safeParse({
      ok: true,
      data: {
        ...workspace,
        candidate: {
          ...workspace.candidate,
          nodes: [{
            ...workspace.candidate.nodes[0],
            confidence: {
              score: 0.1,
              level: 'unusable',
              lowConfidenceResolution: null,
            },
          }],
        },
      },
    }).success).toBe(false);
    expect(get.response.safeParse({
      ok: true,
      data: {
        ...workspace,
        candidate: {
          ...workspace.candidate,
          storyRanges: [{
            id: 'range-1',
            originId: null,
            title: 'Unusable range',
            startOffset: 0,
            endOffset: 24,
            coveredChapterIds: [nodeId],
            suggestedFunctionTags: [],
            boundaryEvidence: [{
              kind: 'chapter_window',
              startOffset: 0,
              endOffset: 24,
            }],
            startReason: 'chapter_window_start:2',
            endReason: 'chapter_window_end:2',
            confidence: {
              score: 0.1,
              level: 'unusable',
              lowConfidenceResolution: null,
            },
          }],
        },
      },
    }).success).toBe(false);
  });

  it('accepts persisted structural and soft story-boundary evidence', () => {
    const get = registry['structure:get'];

    expect(get.response.safeParse({
      ok: true,
      data: {
        ...workspace,
        candidate: {
          ...workspace.candidate,
          storyRanges: [{
            id: 'range-1',
            originId: null,
            title: 'Signal-closed range',
            startOffset: 0,
            endOffset: 24,
            coveredChapterIds: [nodeId],
            suggestedFunctionTags: [],
            boundaryEvidence: [
              { kind: 'markdown_subheading', startOffset: 2, endOffset: 4 },
              { kind: 'length_window', startOffset: 0, endOffset: 24 },
              { kind: 'transition_hint', startOffset: 8, endOffset: 10 },
            ],
            startReason: 'signal_group_start',
            endReason: 'signal_group_end:blank_line_cluster',
            confidence: {
              score: 0.5,
              level: 'low',
              lowConfidenceResolution: 'unresolved',
            },
          }],
        },
      },
    }).success).toBe(true);
  });

  it('rejects failure reasons for detection runs that have not failed', () => {
    const get = registry['structure:get'];

    expect(get.response.safeParse({
      ok: true,
      data: {
        ...workspace,
        detectionRun: {
          ...detectionRun,
          state: 'completed',
          failureReason: 'worker timeout',
        },
      },
    }).success).toBe(false);
  });

  it('keeps the existing review/freeze channel identities registered beside detect', () => {
    for (const channel of [
      'structure:get',
      'structure:detect',
      'structure:update-node',
      'structure:update-story-range',
      'structure:freeze',
    ]) {
      expect(registry[channel]).toBeDefined();
    }
  });
});
