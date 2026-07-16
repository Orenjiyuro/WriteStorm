import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  bookSummarySchema,
  CONTRACT_REGISTRY,
  PRODUCT_IPC_CHANNELS,
  getContract,
  jobSummarySchema,
  librarySummarySchema,
  sourceTextMetadataSchema,
} from '../../src/shared/contracts';
import type {
  BookSummary,
  ContractRequest,
  ContractResponse,
  ImportSourceResult,
  JobSummary,
  LibrarySummary,
  SourceTextMetadata,
} from '../../src/shared/contracts';
import { createNotImplementedError } from '../../src/shared/errors';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
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
  'structure:detect',
  'structure:recover-detection',
  'structure:create-draft',
  'structure:create-manual-draft',
  'structure:discard-draft',
  'structure:update-node',
  'structure:update-story-range',
  'structure:freeze',
  'structure:unfreeze',
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

const bookSummary = {
  id: bookId,
  libraryId,
  title: 'Example Book',
  sourceTextId,
  sourceTextEdition: 1,
  structureEdition: 1,
  updatedAt: '2026-07-07T00:00:00.000Z',
};

const sourceTextMetadata = {
  id: sourceTextId,
  bookId,
  fileName: 'example.md',
  format: 'md',
  sizeBytes: 1024,
  encoding: 'utf-8',
  contentHash: 'sha256:example',
  sourceTextEdition: 1,
  importedAt: '2026-07-07T00:00:00.000Z',
} satisfies SourceTextMetadata;

const inferredLibrarySummary: z.infer<typeof librarySummarySchema> = {
  id: libraryId,
  name: 'Local Library',
  rootPath: 'C:\\WriteStorm\\Library',
  schemaVersion: 1,
  appVersion: '0.1.0',
};
const canonicalLibrarySummary: LibrarySummary = inferredLibrarySummary;
const inferredBookSummary: z.infer<typeof bookSummarySchema> = bookSummary;
const canonicalBookSummary: BookSummary = inferredBookSummary;

const completedImportJob = {
  id: jobId,
  bookId,
  state: 'completed',
  title: 'Import source',
  completedUnits: 1,
  totalUnits: 1,
  checkpointSummary: 'Source imported.',
  failureReason: null,
  updatedAt: '2026-07-07T00:00:00.000Z',
} satisfies JobSummary;

const canonicalImportResult = {
  book: canonicalBookSummary,
  sourceText: sourceTextMetadata,
  job: completedImportJob,
} satisfies ImportSourceResult;

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

    for (const forbiddenPathField of ['sourcePath', 'filePath', 'path', 'rootPath']) {
      expect(
        getContract('books:import-source').request.safeParse({
          [forbiddenPathField]: 'C:\\Books\\example.md',
        }).success,
      ).toBe(false);
    }

    expect(
      getContract('books:import-source').request.safeParse({
        title: 'Example Book',
      }).success,
    ).toBe(true);
  });

  it('separates source import request modes so encoding retry cannot rename or pass paths', () => {
    expect(getContract('books:import-source').request.parse({})).toEqual({});
    expect(getContract('books:import-source').request.parse({ title: 'Example Book' })).toEqual({
      title: 'Example Book',
    });
    expect(
      getContract('books:import-source').request.parse({
        pendingImportId: 'pending-1',
        encodingOverride: 'gb18030',
      }),
    ).toEqual({
      pendingImportId: 'pending-1',
      encodingOverride: 'gb18030',
    });
    expect(
      getContract('books:import-source').request.safeParse({
        title: 'Retitled during retry',
        pendingImportId: 'pending-1',
        encodingOverride: 'gb18030',
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').request.safeParse({
        pendingImportId: 'pending-1',
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').request.safeParse({
        encodingOverride: 'gb18030',
      }).success,
    ).toBe(false);
  });

  it('returns imported book, source metadata, and completed job for source import success', () => {
    const response = {
      ok: true,
      data: {
        book: bookSummary,
        sourceText: sourceTextMetadata,
        job: completedImportJob,
      },
    } satisfies ContractResponse<'books:import-source'>;

    expect(getContract('books:import-source').response.parse(response)).toEqual(response);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: true,
        data: completedImportJob,
      }).success,
    ).toBe(false);
  });

  it('rejects zero-byte source metadata at the canonical wire boundary', () => {
    expect(
      sourceTextMetadataSchema.safeParse({
        ...sourceTextMetadata,
        sizeBytes: 0,
      }).success,
    ).toBe(false);
  });

  it('keeps core wire types canonical in focused Zod-first modules', () => {
    expect(canonicalLibrarySummary.id).toBe(libraryId);
    expect(canonicalImportResult.book.id).toBe(bookId);
    for (const filePath of [
      'src/shared/contracts/library.ts',
      'src/shared/contracts/books.ts',
      'src/shared/contracts/source-import.ts',
      'src/shared/contracts/jobs.ts',
      'src/shared/contracts/modules.ts',
      'src/shared/contracts/exports.ts',
      'src/shared/contracts/structure.ts',
    ]) {
      const source = readFileSync(filePath, 'utf8');
      expect(source).toContain('z.infer');
      expect(source).not.toContain('as z.ZodType<');
    }

    const dtos = readFileSync('src/shared/domain/dtos.ts', 'utf8');
    expect(dtos).not.toMatch(
      /export type (LibrarySummary|BookSummary|SourceTextMetadata|ImportSourceResult) = \{/,
    );
  });

  it('uses JobSummary for lists and JobDetail for jobs:get', () => {
    const estimatingJob = {
      ...completedImportJob,
      state: 'estimating',
    } satisfies JobSummary;

    expect(jobSummarySchema.parse(estimatingJob)).toEqual(estimatingJob);
    const detail = {
      ...estimatingJob,
      type: 'source_import' as const,
      checkpoints: [],
    };
    expect(
      getContract('jobs:get').response.parse({
        ok: true,
        data: detail,
      }),
    ).toEqual({
      ok: true,
      data: detail,
    });
  });

  it('requires stable import error reasons for books:import-source failures', () => {
    const response = {
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        message: 'The selected file is larger than 20 MiB.',
        recoverable: true,
        details: {
          reason: 'file_too_large',
          maxSizeBytes: 20 * 1024 * 1024,
          sizeBytes: 20 * 1024 * 1024 + 1,
        },
      },
    } satisfies ContractResponse<'books:import-source'>;

    expect(getContract('books:import-source').response.parse(response)).toEqual(response);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'Import failed.',
          recoverable: true,
          details: {
            reason: 'some_unstable_string',
          },
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'Import failed.',
          recoverable: true,
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: createNotImplementedError('books:import-source'),
      }).success,
    ).toBe(true);
  });

  it('carries duplicate hash and target conflict details for source import failures', () => {
    expect(
      getContract('books:import-source').response.parse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'This source text has already been imported.',
          recoverable: true,
          details: {
            reason: 'duplicate_source_hash',
            existingBookId: bookId,
            existingSourceTextId: sourceTextId,
          },
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        message: 'This source text has already been imported.',
        recoverable: true,
        details: {
          reason: 'duplicate_source_hash',
          existingBookId: bookId,
          existingSourceTextId: sourceTextId,
        },
      },
    });

    expect(
      getContract('books:import-source').response.parse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'The library already contains a copied source at the target path.',
          recoverable: true,
          details: {
            reason: 'target_conflict',
            relativePath: 'source/source-1/example.md',
          },
        },
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'IMPORT_ERROR',
        message: 'The library already contains a copied source at the target path.',
        recoverable: true,
        details: {
          reason: 'target_conflict',
          relativePath: 'source/source-1/example.md',
        },
      },
    });
  });

  it('requires actionable details for duplicate hash and target conflict import failures', () => {
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'This source text has already been imported.',
          recoverable: true,
          details: {
            reason: 'duplicate_source_hash',
            existingBookId: bookId,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'This source text has already been imported.',
          recoverable: true,
          details: {
            reason: 'duplicate_source_hash',
            existingSourceTextId: sourceTextId,
          },
        },
      }).success,
    ).toBe(false);
    expect(
      getContract('books:import-source').response.safeParse({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'The library already contains a copied source at the target path.',
          recoverable: true,
          details: {
            reason: 'target_conflict',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('validates representative product channel requests', () => {
    const mutationBase = { bookId, draftSetId: 'set-1', expectedDraftRevision: 1 };
    expect(getContract('structure:get').request.parse({ bookId })).toEqual({ bookId });
    expect(getContract('structure:create-draft').request.parse({ bookId, candidateSetId: 'set-1' }))
      .toEqual({ bookId, candidateSetId: 'set-1' });
    expect(getContract('structure:discard-draft').request.parse(mutationBase)).toEqual(mutationBase);
    expect(
      getContract('structure:update-node').request.parse({
        ...mutationBase,
        command: { type: 'rename-node', nodeId, title: 'Renamed Chapter' },
      }),
    ).toEqual({
      ...mutationBase,
      command: { type: 'rename-node', nodeId, title: 'Renamed Chapter' },
    });
    expect(
      getContract('structure:update-story-range').request.parse({
        ...mutationBase,
        command: { type: 'set-range-coverage', rangeId, coveredChapterIds: [nodeId] },
      }),
    ).toEqual({
      ...mutationBase,
      command: { type: 'set-range-coverage', rangeId, coveredChapterIds: [nodeId] },
    });
    expect(getContract('structure:freeze').request.parse(mutationBase)).toEqual(mutationBase);
    expect(getContract('structure:unfreeze').request.parse({ bookId, frozenSetId: 'set-1' }))
      .toEqual({ bookId, frozenSetId: 'set-1' });
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
          bookId,
          targets: [
            {
              kind: 'markdown_package',
              availability: 'blocked',
              blockers: [
                'export_execution_not_admitted',
                'structure_not_frozen',
                'review_asset_owner_unavailable',
                'evidence_anchor_owner_unavailable',
                'technique_asset_owner_unavailable',
                'perspective_view_owner_unavailable',
                'completion_gate_owner_unavailable',
              ],
              preview: {
                structure: { status: 'not_frozen', structureEdition: null },
                moduleInstances: {
                  expectedCount: 7,
                  actualCount: 0,
                  nonEmptyBodyCount: 0,
                  statusCounts: {
                    not_generated: 0,
                    generated_pending_review: 0,
                    confirmed: 0,
                    stale: 0,
                    needs_rebuild: 0,
                  },
                },
              },
            },
            {
              kind: 'machine_package',
              availability: 'unavailable',
              blockers: [
                'export_execution_not_admitted',
                'structure_not_frozen',
                'review_asset_owner_unavailable',
                'evidence_anchor_owner_unavailable',
                'technique_asset_owner_unavailable',
                'perspective_view_owner_unavailable',
                'completion_gate_owner_unavailable',
              ],
              preview: {
                structure: { status: 'not_frozen', structureEdition: null },
                moduleInstances: {
                  expectedCount: 7,
                  actualCount: 0,
                  nonEmptyBodyCount: 0,
                  statusCounts: {
                    not_generated: 0,
                    generated_pending_review: 0,
                    confirmed: 0,
                    stale: 0,
                    needs_rebuild: 0,
                  },
                },
              },
            },
          ],
          owners: [
            { ownerKind: 'book', availability: 'available', reason: null },
            { ownerKind: 'structure', availability: 'available', reason: null },
            { ownerKind: 'analysis_modules', availability: 'available', reason: null },
            {
              ownerKind: 'review_assets',
              availability: 'unavailable',
              reason: 'review_asset_owner_unavailable',
            },
            {
              ownerKind: 'evidence_anchors',
              availability: 'unavailable',
              reason: 'evidence_anchor_owner_unavailable',
            },
            {
              ownerKind: 'technique_assets',
              availability: 'unavailable',
              reason: 'technique_asset_owner_unavailable',
            },
            {
              ownerKind: 'perspective_views',
              availability: 'unavailable',
              reason: 'perspective_view_owner_unavailable',
            },
            {
              ownerKind: 'completion_gate',
              availability: 'unavailable',
              reason: 'completion_gate_owner_unavailable',
            },
          ],
          excludedContent: [
            'credentials',
            'authentication_tokens',
            'secret_keys',
            'secure_storage',
            'full_sensitive_logs',
          ],
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
