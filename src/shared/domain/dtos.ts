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
} from './ids';
import type {
  JobState,
  ModuleInstanceStatus,
  ScopeKind,
  StructureNodeKind,
} from './status';

export type IsoDateTimeString = string;

export type SourceTextFormat = 'txt' | 'md';

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

export type LibrarySummary = {
  id: LibraryId;
  name: string;
  rootPath: string;
  schemaVersion: number;
  appVersion: string;
};

export type BookSummary = {
  id: BreakdownBookId;
  libraryId: LibraryId;
  title: string;
  sourceTextId: SourceTextId | null;
  sourceTextEdition: number | null;
  structureEdition: number | null;
  updatedAt: IsoDateTimeString;
};

export type SourceTextMetadata = {
  id: SourceTextId;
  bookId: BreakdownBookId;
  fileName: string;
  format: SourceTextFormat;
  sizeBytes: number;
  encoding: string;
  contentHash: string;
  sourceTextEdition: number;
  importedAt: IsoDateTimeString;
};

export type ImportSourceResult = {
  book: BookSummary;
  sourceText: SourceTextMetadata;
  job: JobSummary;
};

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

export type JobSummary = {
  id: JobId;
  bookId: BreakdownBookId | null;
  state: JobState;
  title: string;
  completedUnits: number;
  totalUnits: number | null;
  checkpointSummary: string | null;
  failureReason: string | null;
  updatedAt: IsoDateTimeString;
};

export type ExportStatusDto = {
  exportId: ExportId | null;
  bookId: BreakdownBookId;
  availability: 'blocked' | 'available' | 'running' | 'completed';
  blockers: string[];
  latestJobId: JobId | null;
  updatedAt: IsoDateTimeString | null;
};
