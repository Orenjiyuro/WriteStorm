import { describe, expect, it } from 'vitest';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  EvidenceAnchorId,
  ExportId,
  JobId,
  LibraryId,
  PerspectiveInstanceId,
  RelationLinkId,
  RevisionId,
  ReviewAssetId,
  ReusableTechniqueCandidateId,
  SourceSnapshotId,
  SourceTextId,
  StorySegmentRangeId,
  StructureNodeId,
  TechniqueEntryId,
  WorkTechniqueObservationId,
} from '../../src/shared/domain';

type AssertString<T extends string> = T;

type SharedIdStringChecks = [
  AssertString<LibraryId>,
  AssertString<BreakdownBookId>,
  AssertString<SourceTextId>,
  AssertString<StructureNodeId>,
  AssertString<StorySegmentRangeId>,
  AssertString<AnalysisModuleId>,
  AssertString<AnalysisModuleInstanceId>,
  AssertString<JobId>,
  AssertString<PerspectiveInstanceId>,
  AssertString<RevisionId>,
  AssertString<ReviewAssetId>,
  AssertString<EvidenceAnchorId>,
  AssertString<RelationLinkId>,
  AssertString<ExportId>,
  AssertString<WorkTechniqueObservationId>,
  AssertString<ReusableTechniqueCandidateId>,
  AssertString<TechniqueEntryId>,
  AssertString<SourceSnapshotId>,
];

const allIds = {
  library: 'library-1' as LibraryId,
  breakdownBook: 'book-1' as BreakdownBookId,
  sourceText: 'source-1' as SourceTextId,
  structureNode: 'node-1' as StructureNodeId,
  storySegmentRange: 'range-1' as StorySegmentRangeId,
  analysisModule: 'module-1' as AnalysisModuleId,
  analysisModuleInstance: 'module-instance-1' as AnalysisModuleInstanceId,
  job: 'job-1' as JobId,
  perspectiveInstance: 'perspective-instance-1' as PerspectiveInstanceId,
  revision: 'revision-1' as RevisionId,
  reviewAsset: 'review-asset-1' as ReviewAssetId,
  evidenceAnchor: 'evidence-1' as EvidenceAnchorId,
  relationLink: 'relation-link-1' as RelationLinkId,
  export: 'export-1' as ExportId,
  workTechniqueObservation: 'technique-observation-1' as WorkTechniqueObservationId,
  reusableTechniqueCandidate: 'technique-candidate-1' as ReusableTechniqueCandidateId,
  techniqueEntry: 'technique-1' as TechniqueEntryId,
  sourceSnapshot: 'source-snapshot-1' as SourceSnapshotId,
} satisfies Record<string, SharedIdStringChecks[number]>;

const libraryId = allIds.library;

// @ts-expect-error Raw strings must not be assignable to branded IDs.
const invalidLibraryId: LibraryId = 'library-1';

// @ts-expect-error Different ID brands must not be interchangeable.
const invalidBookId: BreakdownBookId = libraryId;

describe('shared ID brands', () => {
  it('keeps all V1 shared ID brands represented as strings at runtime', () => {
    expect(Object.values(allIds).every((id) => typeof id === 'string')).toBe(true);
    expect(Object.keys(allIds)).toEqual([
      'library',
      'breakdownBook',
      'sourceText',
      'structureNode',
      'storySegmentRange',
      'analysisModule',
      'analysisModuleInstance',
      'job',
      'perspectiveInstance',
      'revision',
      'reviewAsset',
      'evidenceAnchor',
      'relationLink',
      'export',
      'workTechniqueObservation',
      'reusableTechniqueCandidate',
      'techniqueEntry',
      'sourceSnapshot',
    ]);
  });
});
