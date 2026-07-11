import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  ExportId,
  JobId,
  SourceTextId,
  StorySegmentRangeId,
  StructureNodeId,
} from './ids';
import type {
  ModuleInstanceStatus,
  ScopeKind,
  StructureNodeKind,
} from './status';

export type IsoDateTimeString = string;

export type ScopeRef =
  | {
      kind: Extract<ScopeKind, 'book'>;
      bookId: BreakdownBookId;
    }
  | {
      kind: Extract<ScopeKind, 'volume' | 'chapter'>;
      nodeId: StructureNodeId;
    }
  | {
      kind: Extract<ScopeKind, 'story_segment_range'>;
      rangeId: StorySegmentRangeId;
    };

// TEMPORARY Task 4 compatibility shims. Task 5 must migrate consumers and delete them.
export type { LibrarySummary } from '../contracts/library';
export type { BookSummary } from '../contracts/books';
export type {
  ImportSourceResult,
  SourceTextFormat,
  SourceTextMetadata,
} from '../contracts/source-import';

export type StructureNodeDto = {
  id: StructureNodeId;
  bookId: BreakdownBookId;
  sourceTextId: SourceTextId;
  kind: StructureNodeKind;
  title: string;
  parentId: StructureNodeId | null;
  order: number;
  startOffset: number;
  endOffset: number | null;
  structureEdition: number;
};

export type StorySegmentRangeDto = {
  id: StorySegmentRangeId;
  bookId: BreakdownBookId;
  sourceTextId: SourceTextId;
  title: string;
  startOffset: number;
  endOffset: number;
  coveredChapterIds: StructureNodeId[];
  functionTags: string[];
  confidence: number;
  structureEdition: number;
};

export type ModuleInstanceSummary = {
  id: AnalysisModuleInstanceId;
  bookId: BreakdownBookId;
  moduleId: AnalysisModuleId;
  scope: ScopeRef;
  status: ModuleInstanceStatus;
  analysisRevision: number;
  updatedAt: IsoDateTimeString | null;
};

// TEMPORARY Task 3 compatibility shim. Task 5 must migrate consumers and delete it.
export type { JobSummary } from '../contracts/jobs';

export type ExportStatusDto = {
  exportId: ExportId | null;
  bookId: BreakdownBookId;
  availability: 'blocked' | 'available' | 'running' | 'completed';
  blockers: string[];
  latestJobId: JobId | null;
  updatedAt: IsoDateTimeString | null;
};
