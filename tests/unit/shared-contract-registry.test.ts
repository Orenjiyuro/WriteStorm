import { describe, expect, it } from 'vitest';
import {
  CONTRACT_REGISTRY,
  PRODUCT_IPC_CHANNELS,
  getContract,
} from '../../src/shared/contracts';
import type { ContractRequest, ContractResponse } from '../../src/shared/contracts';
import { createNotImplementedError } from '../../src/shared/errors';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  ExportId,
  JobId,
  LibraryId,
  SourceTextId,
  StorySegmentRangeId,
  StructureNodeId,
} from '../../src/shared/domain';

const expectedChannels = [
  'library:create',
  'library:open',
  'library:get-current',
  'books:list',
  'books:import-source',
  'structure:get',
  'structure:update-node',
  'structure:update-story-range',
  'structure:freeze',
  'modules:list-instances',
  'modules:update-body',
  'jobs:list',
  'jobs:get',
  'jobs:cancel',
  'exports:get-status',
] as const;

const libraryId = 'library-1' as LibraryId;
const bookId = 'book-1' as BreakdownBookId;
const sourceTextId = 'source-1' as SourceTextId;
const nodeId = 'node-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const moduleId = 'module-1' as AnalysisModuleId;
const instanceId = 'instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;
const exportId = 'export-1' as ExportId;

const bookSummary = {
  id: bookId,
  libraryId,
  title: 'Example Book',
  sourceTextId,
  sourceTextEdition: 1,
  structureEdition: 1,
  updatedAt: '2026-07-07T00:00:00.000Z',
};

const booksListRequest = {} satisfies ContractRequest<'books:list'>;
const booksListResponse = {
  ok: true,
  data: [bookSummary],
} satisfies ContractResponse<'books:list'>;

const structureNode = {
  id: nodeId,
  bookId,
  sourceTextId,
  kind: 'chapter',
  title: 'Chapter 1',
  parentId: null,
  order: 0,
  startOffset: 10,
  endOffset: 20,
  structureEdition: 1,
};

const storySegmentRange = {
  id: rangeId,
  bookId,
  sourceTextId,
  title: 'Opening Conflict',
  startOffset: 10,
  endOffset: 30,
  coveredChapterIds: [nodeId],
  functionTags: ['setup'],
  confidence: 0.8,
  structureEdition: 1,
};

// @ts-expect-error Contract requests must use known channels.
type UnknownChannelRequest = ContractRequest<'books:unknown'>;

describe('shared contract registry', () => {
  it('covers the full initial product IPC allowlist', () => {
    expect(PRODUCT_IPC_CHANNELS).toEqual(expectedChannels);
    expect(Object.keys(CONTRACT_REGISTRY)).toEqual([...expectedChannels]);
  });

  it('exposes typed request and response schemas for every channel', () => {
    for (const channel of PRODUCT_IPC_CHANNELS) {
      const contract = getContract(channel);

      expect(contract.channel).toBe(channel);
      expect(contract.request.safeParse({}).success).toBe(
        [
          'library:create',
          'library:open',
          'library:get-current',
          'books:list',
          'books:import-source',
          'jobs:list',
        ].includes(channel),
      );
      expect(
        contract.response.safeParse({
          ok: false,
          error: createNotImplementedError(channel),
        }).success,
      ).toBe(true);
    }
  });

  it('keeps renderer requests away from arbitrary file paths', () => {
    expect(getContract('library:create').request.safeParse({ rootPath: 'C:\\Library' }).success).toBe(false);
    expect(getContract('library:open').request.safeParse({ rootPath: 'C:\\Library' }).success).toBe(false);
    expect(
      getContract('books:import-source').request.safeParse({
        sourcePath: 'C:\\Books\\example.md',
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').request.safeParse({
        title: 'Example Book',
      }).success,
    ).toBe(true);
  });

  it('validates representative product channel requests', () => {
    expect(getContract('structure:get').request.parse({ bookId })).toEqual({ bookId });
    expect(
      getContract('structure:update-node').request.parse({
        nodeId,
        patch: {
          title: 'Renamed Chapter',
          parentId: null,
        },
      }),
    ).toEqual({
      nodeId,
      patch: {
        title: 'Renamed Chapter',
        parentId: null,
      },
    });
    expect(
      getContract('structure:update-story-range').request.parse({
        rangeId,
        patch: {
          coveredChapterIds: [nodeId],
          confidence: 0.8,
        },
      }),
    ).toEqual({
      rangeId,
      patch: {
        coveredChapterIds: [nodeId],
        confidence: 0.8,
      },
    });
    expect(getContract('structure:freeze').request.parse({ bookId })).toEqual({ bookId });
    expect(getContract('modules:list-instances').request.parse({ bookId })).toEqual({ bookId });
    expect(getContract('modules:update-body').request.parse({ instanceId, body: 'Module body' })).toEqual({
      instanceId,
      body: 'Module body',
    });
    expect(getContract('jobs:list').request.parse({ bookId })).toEqual({ bookId });
    expect(getContract('jobs:get').request.parse({ jobId })).toEqual({ jobId });
    expect(getContract('jobs:cancel').request.parse({ jobId })).toEqual({ jobId });
    expect(getContract('exports:get-status').request.parse({ bookId })).toEqual({ bookId });
  });

  it('validates representative response envelopes without relying on thrown Error serialization', () => {
    expect(getContract('books:list').request.parse(booksListRequest)).toEqual({});
    expect(getContract('books:list').response.parse(booksListResponse)).toEqual(booksListResponse);
    expect(
      getContract('library:get-current').response.parse({
        ok: true,
        data: null,
      }),
    ).toEqual({
      ok: true,
      data: null,
    });
    expect(
      getContract('exports:get-status').response.parse({
        ok: true,
        data: {
          exportId,
          bookId,
          availability: 'blocked',
          blockers: ['missing_confirmed_modules'],
          latestJobId: jobId,
          updatedAt: '2026-07-07T00:00:00.000Z',
        },
      }).ok,
    ).toBe(true);
    expect(
      getContract('books:list').response.parse({
        ok: false,
        error: createNotImplementedError('books:list'),
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Channel books:list is not implemented.',
        recoverable: false,
        details: {
          channel: 'books:list',
        },
      },
    });
  });

  it('rejects non-finite numbers in error details before JSON serialization changes them', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        getContract('books:list').response.safeParse({
          ok: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request.',
            recoverable: true,
            details: {
              channel: 'books:list',
              value,
            },
          },
        }).success,
      ).toBe(false);
    }
  });

  it('rejects non-ISO date-time strings at the contract boundary', () => {
    expect(
      getContract('books:list').response.safeParse({
        ok: true,
        data: [
          {
            ...bookSummary,
            updatedAt: 'July 7, 2026',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('enforces structure and story range offset invariants', () => {
    expect(
      getContract('structure:get').response.safeParse({
        ok: true,
        data: {
          nodes: [
            {
              ...structureNode,
              endOffset: structureNode.startOffset,
            },
          ],
          storyRanges: [],
          structureEdition: 1,
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('structure:get').response.safeParse({
        ok: true,
        data: {
          nodes: [
            {
              ...structureNode,
              endOffset: null,
            },
          ],
          storyRanges: [
            {
              ...storySegmentRange,
              endOffset: storySegmentRange.startOffset,
            },
          ],
          structureEdition: 1,
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('structure:update-node').request.safeParse({
        nodeId,
        patch: {
          startOffset: 20,
          endOffset: 20,
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('structure:update-story-range').request.safeParse({
        rangeId,
        patch: {
          startOffset: 20,
          endOffset: 20,
        },
      }).success,
    ).toBe(false);
  });

  it('requires story segment ranges to cover at least one chapter when present', () => {
    expect(
      getContract('structure:get').response.safeParse({
        ok: true,
        data: {
          nodes: [structureNode],
          storyRanges: [
            {
              ...storySegmentRange,
              coveredChapterIds: [],
            },
          ],
          structureEdition: 1,
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('structure:update-story-range').request.safeParse({
        rangeId,
        patch: {
          coveredChapterIds: [],
        },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid response payloads at the contract boundary', () => {
    expect(
      getContract('books:list').response.safeParse({
        ok: true,
        data: [
          {
            ...bookSummary,
            rowid: 1,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      getContract('modules:list-instances').response.safeParse({
        ok: true,
        data: [
          {
            id: instanceId,
            bookId,
            moduleId,
            scope: {
              kind: 'story_segment',
              rangeId,
            },
            status: 'generated_pending_review',
            analysisRevision: 1,
            updatedAt: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
