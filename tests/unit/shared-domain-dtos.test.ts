import { describe, expect, it } from 'vitest';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BookSummary,
  BreakdownBookId,
  ExportId,
  ExportStatusDto,
  JobId,
  JobSummary,
  LibraryId,
  LibrarySummary,
  ModuleInstanceSummary,
  SourceTextId,
  SourceTextMetadata,
  StorySegmentRangeDto,
  StorySegmentRangeId,
  StructureNodeDto,
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
const exportId = 'export-1' as ExportId;

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
  exportId,
  bookId,
  availability: 'blocked',
  blockers: ['missing_confirmed_modules'],
  latestJobId: jobId,
  updatedAt: '2026-07-07T00:00:00.000Z',
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
    expect(jobSummary.state).toBe('resumable');
    expect(exportStatus.availability).toBe('blocked');
  });
});
