import { describe, expect, it } from 'vitest';
import type {
  BookSummary,
  ExportStatusDto,
  JobSummary,
  LibrarySummary,
  ModuleInstanceSummary,
  SourceTextMetadata,
  StorySegmentRangeDto,
  StructureNodeDto,
} from '../../src/shared/contracts';
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

const libraryId = 'library-1' as LibraryId;
const bookId = 'book-1' as BreakdownBookId;
const sourceTextId = 'source-1' as SourceTextId;
const volumeId = 'volume-1' as StructureNodeId;
const chapterId = 'chapter-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const moduleId = 'module-1' as AnalysisModuleId;
const moduleInstanceId = 'module-instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;

const librarySummary = {
  id: libraryId,
  name: 'Local Library',
  rootPath: 'C:\\WriteStorm\\Library',
  schemaVersion: 1,
  appVersion: '0.1.0',
} satisfies LibrarySummary;

const bookSummary = {
  id: bookId,
  libraryId,
  title: 'Example Book',
  sourceTextId,
  sourceTextEdition: 1,
  structureEdition: 2,
  updatedAt: '2026-07-07T00:00:00.000Z',
} satisfies BookSummary;

const sourceTextMetadata = {
  id: sourceTextId,
  bookId,
  fileName: 'example.md',
  format: 'md',
  sizeBytes: 1024,
  encoding: 'utf-8',
  contentHash: 'sha256:abc',
  sourceTextEdition: 1,
  importedAt: '2026-07-07T00:00:00.000Z',
} satisfies SourceTextMetadata;

const structureNode = {
  id: chapterId,
  bookId,
  sourceTextId,
  kind: 'chapter',
  title: 'Chapter 1',
  parentId: volumeId,
  order: 1,
  startOffset: 0,
  endOffset: 500,
  structureEdition: 2,
} satisfies StructureNodeDto;

const storySegmentRange = {
  id: rangeId,
  bookId,
  sourceTextId,
  title: 'Opening Conflict',
  startOffset: 0,
  endOffset: 800,
  coveredChapterIds: [chapterId],
  functionTags: ['setup'],
  confidence: 0.82,
  structureEdition: 2,
} satisfies StorySegmentRangeDto;

const moduleInstanceSummary = {
  id: moduleInstanceId,
  bookId,
  moduleId,
  scope: {
    kind: 'story_segment_range',
    rangeId,
  },
  status: 'generated_pending_review',
  structureEdition: 2,
  analysisRevision: 3,
  updatedAt: '2026-07-07T00:00:00.000Z',
} satisfies ModuleInstanceSummary;

const jobSummary = {
  id: jobId,
  bookId,
  state: 'resumable',
  title: 'Import source text',
  completedUnits: 1,
  totalUnits: 3,
  checkpointSummary: 'source copy complete',
  failureReason: 'structure review required',
  updatedAt: '2026-07-07T00:00:00.000Z',
} satisfies JobSummary;

const exportStatus = {
  bookId,
  targets: [
    {
      kind: 'markdown_package',
      availability: 'blocked',
      blockers: [
        'export_execution_not_admitted',
        'analysis_module_pending_review',
      ],
      preview: {
        structure: {
          status: 'frozen',
          structureEdition: 2,
        },
        moduleInstances: {
          expectedCount: 7,
          actualCount: 7,
          nonEmptyBodyCount: 1,
          statusCounts: {
            not_generated: 0,
            generated_pending_review: 7,
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
        'review_asset_owner_unavailable',
        'evidence_anchor_owner_unavailable',
        'technique_asset_owner_unavailable',
        'perspective_view_owner_unavailable',
        'completion_gate_owner_unavailable',
      ],
      preview: {
        structure: {
          status: 'frozen',
          structureEdition: 2,
        },
        moduleInstances: {
          expectedCount: 7,
          actualCount: 7,
          nonEmptyBodyCount: 1,
          statusCounts: {
            not_generated: 0,
            generated_pending_review: 7,
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
} satisfies ExportStatusDto;

// @ts-expect-error DTOs must not expose SQLite row ids to renderer code.
const invalidBookSummary = { ...bookSummary, rowid: 1 } satisfies BookSummary;

// @ts-expect-error Source text metadata only accepts supported V1 text formats.
const invalidSourceTextFormat = { ...sourceTextMetadata, format: 'pdf' } satisfies SourceTextMetadata;

// @ts-expect-error Story ranges are scopes, not structure-node ids.
const invalidStructureNode = { ...structureNode, id: rangeId } satisfies StructureNodeDto;

// @ts-expect-error DTO timestamps cross IPC as strings, not Date instances.
const invalidImportedAt = { ...sourceTextMetadata, importedAt: new Date() } satisfies SourceTextMetadata;

describe('shared domain DTO baselines', () => {
  it('keeps the library, book, and source text DTOs serializable', () => {
    expect(librarySummary.schemaVersion).toBe(1);
    expect(bookSummary.structureEdition).toBe(2);
    expect(sourceTextMetadata.format).toBe('md');
  });

  it('keeps title-tree nodes separate from story segment ranges', () => {
    expect(structureNode.kind).toBe('chapter');
    expect(storySegmentRange.coveredChapterIds).toEqual([chapterId]);
  });

  it('keeps module instances, jobs, and export status as summaries only', () => {
    expect(moduleInstanceSummary.scope).toEqual({ kind: 'story_segment_range', rangeId });
    expect(moduleInstanceSummary.analysisRevision).toBe(3);
    expect(jobSummary.state).toBe('resumable');
    expect(exportStatus.targets[0].availability).toBe('blocked');
    expect(exportStatus.targets[1].availability).toBe('unavailable');
  });
});
