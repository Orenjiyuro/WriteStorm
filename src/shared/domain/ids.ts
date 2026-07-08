declare const idBrand: unique symbol;

type BrandedId<TBrand extends string> = string & {
  readonly [idBrand]: TBrand;
};

export type LibraryId = BrandedId<'LibraryId'>;
export type BreakdownBookId = BrandedId<'BreakdownBookId'>;
export type SourceTextId = BrandedId<'SourceTextId'>;
export type StructureNodeId = BrandedId<'StructureNodeId'>;
export type StorySegmentRangeId = BrandedId<'StorySegmentRangeId'>;
export type AnalysisModuleId = BrandedId<'AnalysisModuleId'>;
export type AnalysisModuleInstanceId = BrandedId<'AnalysisModuleInstanceId'>;
export type JobId = BrandedId<'JobId'>;
export type RevisionId = BrandedId<'RevisionId'>;
export type ReviewAssetId = BrandedId<'ReviewAssetId'>;
export type EvidenceAnchorId = BrandedId<'EvidenceAnchorId'>;
export type ExportId = BrandedId<'ExportId'>;
export type WorkTechniqueObservationId = BrandedId<'WorkTechniqueObservationId'>;
export type ReusableTechniqueCandidateId = BrandedId<'ReusableTechniqueCandidateId'>;
export type TechniqueEntryId = BrandedId<'TechniqueEntryId'>;
export type SourceSnapshotId = BrandedId<'SourceSnapshotId'>;
