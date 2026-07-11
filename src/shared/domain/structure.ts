import type {
  BreakdownBookId,
  JobId,
  SourceTextId,
  StorySegmentRangeId,
  StructureDetectionRunId,
  StructureNodeId,
  StructureSetId,
} from './ids';
import type { JobSummary } from './dtos';
import type { StructureNodeKind } from './status';

export const STRUCTURE_OFFSET_UNIT = 'utf16_code_unit' as const;

export const STRUCTURE_OFFSET_RANGE_BOUNDARY = {
  start: 'inclusive',
  end: 'exclusive',
} as const;

export const STRUCTURE_HEADING_SPAN_POLICY = {
  rawHeadingTextMatches: 'headingStartOffset_headingEndOffset',
  nodeCoverageMatches: 'startOffset_endOffset',
  newlineNormalization: 'preserve_crlf_lf',
  bomHandling: 'remove_after_decode',
} as const;

export const STRUCTURE_SET_STAGES = ['candidate', 'draft', 'frozen'] as const;
export type StructureSetStage = (typeof STRUCTURE_SET_STAGES)[number];

export const STRUCTURE_CONFIDENCE_LEVELS = [
  'high',
  'medium',
  'low',
  'unusable',
] as const;
export type StructureConfidenceLevel = (typeof STRUCTURE_CONFIDENCE_LEVELS)[number];

export const STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS = [
  'unresolved',
  'accepted',
  'corrected',
] as const;
export type StructureLowConfidenceResolution =
  (typeof STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS)[number];

export const STRUCTURE_STORY_RANGE_MODES = ['included', 'skipped_by_user'] as const;
export type StructureStoryRangeMode = (typeof STRUCTURE_STORY_RANGE_MODES)[number];

export const STRUCTURE_DETECTION_RUN_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type StructureDetectionRunState = (typeof STRUCTURE_DETECTION_RUN_STATES)[number];

export const STRUCTURE_JOB_CHECKPOINT_KINDS = [
  'structure_draft',
  'structure_edition',
] as const;
export type StructureJobCheckpointKind = (typeof STRUCTURE_JOB_CHECKPOINT_KINDS)[number];

export const STRUCTURE_DETECTION_JOB_LIFECYCLE_POLICY = {
  detectionRunJobId: 'required',
  queued: 'queued',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancellation: 'persist_cancelled_job_and_failed_run_then_abort_utility_process',
  failureImportEffect: 'preserve_successful_source_import',
} as const;

export const STRUCTURE_IDENTITY_POLICY = {
  nodeIds: 'globally_unique',
  storySegmentRangeIds: 'globally_unique',
  draftClone: 'new_id_with_origin_id',
  freeze: 'seal_draft_in_place',
  unfreeze: 'new_draft_ids_with_origin_id',
  scopeRefTargets: 'frozen_only',
} as const;

export const STRUCTURE_CURRENT_SELECTION_POLICY = {
  currentSet: 'one_per_book_and_stage',
  historicalSet: 'is_current_false',
  workspace: 'returns_current_set_per_stage',
} as const;

export type StructureSourceSnapshot = {
  sourceTextId: SourceTextId;
  sourceTextEdition: number;
  contentHash: string;
  decodedTextLength: number;
  offsetUnit: typeof STRUCTURE_OFFSET_UNIT;
};

export type StructureHeadingSpan = {
  rawHeadingText: string;
  headingStartOffset: number;
  headingEndOffset: number;
};

export type StructureConfidence = {
  score: number;
  level: StructureConfidenceLevel;
  lowConfidenceResolution: StructureLowConfidenceResolution | null;
};

export type StructureSetNodeDto = {
  id: StructureNodeId;
  originId: StructureNodeId | null;
  kind: StructureNodeKind;
  title: string;
  parentId: StructureNodeId | null;
  order: number;
  startOffset: number;
  endOffset: number;
  heading: StructureHeadingSpan | null;
  confidence: StructureConfidence;
};

export type StructureSetStoryRangeDto = {
  id: StorySegmentRangeId;
  originId: StorySegmentRangeId | null;
  title: string;
  startOffset: number;
  endOffset: number;
  coveredChapterIds: StructureNodeId[];
  suggestedFunctionTags: string[];
  boundaryEvidence: StructureStoryRangeBoundaryEvidence[];
  startReason: string;
  endReason: string;
  confidence: StructureConfidence;
};

export type StructureStoryRangeBoundaryEvidence = {
  kind:
    | 'chapter_window'
    | 'explicit_separator'
    | 'blank_line_cluster'
    | 'markdown_subheading'
    | 'length_window'
    | 'transition_hint';
  startOffset: number;
  endOffset: number;
};

type StructureSetBase = {
  id: StructureSetId;
  bookId: BreakdownBookId;
  sourceSnapshot: StructureSourceSnapshot;
  nodes: StructureSetNodeDto[];
  storyRanges: StructureSetStoryRangeDto[];
  storyRangeMode: StructureStoryRangeMode;
  createdAt: string;
  updatedAt: string;
};

export type CandidateStructureSet = StructureSetBase & {
  stage: Extract<StructureSetStage, 'candidate'>;
  detectionRunId: StructureDetectionRunId;
  draftRevision: null;
  structureEdition: null;
};

export type DraftStructureSet = StructureSetBase & {
  stage: Extract<StructureSetStage, 'draft'>;
  detectionRunId: null;
  draftRevision: number;
  structureEdition: null;
};

export type FrozenStructureSet = StructureSetBase & {
  stage: Extract<StructureSetStage, 'frozen'>;
  detectionRunId: null;
  draftRevision: null;
  structureEdition: number;
  frozenAt: string;
};

export type StructureSet = CandidateStructureSet | DraftStructureSet | FrozenStructureSet;

export type StructureJobCheckpointLink = {
  jobId: JobId;
  checkpointKind: StructureJobCheckpointKind;
};

export type StructureDetectionRun = {
  id: StructureDetectionRunId;
  bookId: BreakdownBookId;
  job: StructureJobCheckpointLink & {
    checkpointKind: Extract<StructureJobCheckpointKind, 'structure_draft'>;
  };
  sourceSnapshot: StructureSourceSnapshot;
  state: StructureDetectionRunState;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StructureWorkspace = {
  bookId: BreakdownBookId;
  detectionRun: StructureDetectionRun | null;
  candidate: CandidateStructureSet | null;
  draft: DraftStructureSet | null;
  frozen: FrozenStructureSet | null;
};

export type StructureDetectionStartResult = {
  detectionRun: StructureDetectionRun;
  job: JobSummary;
};
