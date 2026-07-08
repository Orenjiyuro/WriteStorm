import type {
  BreakdownBookId,
  EvidenceAnchorId,
  LibraryId,
  ReusableTechniqueCandidateId,
  TechniqueEntryId,
  WorkTechniqueObservationId,
} from './ids';
import type { ReviewAssetStatus } from './analysis';
import type { IsoDateTimeString } from './dtos';
import { sourceSnapshotSchema } from './source-snapshot';
import type { SourceSnapshot } from './source-snapshot';
import { z } from 'zod';

export type TechniqueAssetKind =
  | 'work_technique_observation'
  | 'reusable_technique_candidate'
  | 'technique_entry';

export type TechniqueAssetOwnerKind = 'breakdown_book' | 'technique_library';

export type WorkTechniqueObservation = {
  readonly id: WorkTechniqueObservationId;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'breakdown_book'>;
  readonly bookId: BreakdownBookId;
  readonly evidenceAnchorIds: readonly EvidenceAnchorId[];
};

export const TECHNIQUE_ENTRY_STATUSES = ['draft', 'organized', 'pending_merge', 'deprecated'] as const;

export type TechniqueEntryStatus = (typeof TECHNIQUE_ENTRY_STATUSES)[number];

export type TechniqueEntryStatusTransition = {
  readonly from: TechniqueEntryStatus;
  readonly to: TechniqueEntryStatus;
};

export type TechniqueEntryPendingMergeSemantics = {
  readonly meaning: 'organization_only';
  readonly triggersAutomaticMerge: false;
  readonly createsMergedTechniqueEntry: false;
  readonly requiresManualResolution: true;
};

export type TechniqueEntryStateMachine = {
  readonly initialStatus: Extract<TechniqueEntryStatus, 'draft'>;
  readonly statuses: readonly TechniqueEntryStatus[];
  readonly allowedTransitions: readonly TechniqueEntryStatusTransition[];
  readonly pendingMergeSemantics: TechniqueEntryPendingMergeSemantics;
};

export const TECHNIQUE_ENTRY_STATE_MACHINE = {
  initialStatus: 'draft',
  statuses: TECHNIQUE_ENTRY_STATUSES,
  allowedTransitions: [
    { from: 'draft', to: 'organized' },
    { from: 'draft', to: 'deprecated' },
    { from: 'organized', to: 'pending_merge' },
    { from: 'organized', to: 'deprecated' },
    { from: 'pending_merge', to: 'organized' },
    { from: 'pending_merge', to: 'deprecated' },
  ],
  pendingMergeSemantics: {
    meaning: 'organization_only',
    triggersAutomaticMerge: false,
    createsMergedTechniqueEntry: false,
    requiresManualResolution: true,
  },
} as const satisfies TechniqueEntryStateMachine;

export function isTechniqueEntryStatusTransitionAllowed(
  from: TechniqueEntryStatus,
  to: TechniqueEntryStatus,
): boolean {
  return TECHNIQUE_ENTRY_STATE_MACHINE.allowedTransitions.some(
    (transition) => transition.from === from && transition.to === to,
  );
}

const techniqueForbiddenContentKinds = [
  'character_names',
  'proprietary_setting_terms',
  'original_sentences',
  'character_specific_actions',
  'plot_reenactment',
] as const;

const techniqueDeproprietizedTextKinds = [
  'reusable_principle',
  'applicable_scope',
  'limitation',
  'problem_type',
  'setup_conditions',
  'solution_mechanism',
  'rhythm_position',
  'emotional_function',
  'applicable_limit',
] as const;

export type TechniqueForbiddenContentKind = (typeof techniqueForbiddenContentKinds)[number];

export type TechniqueDeproprietizedTextKind = (typeof techniqueDeproprietizedTextKinds)[number];

export type TechniqueDeproprietizedText = {
  readonly kind: TechniqueDeproprietizedTextKind;
  readonly text: string;
  readonly excludes: readonly TechniqueForbiddenContentKind[];
};

export type TechniqueDeproprietizedTextForKind<TKind extends TechniqueDeproprietizedTextKind> =
  TechniqueDeproprietizedText & {
    readonly kind: Extract<TechniqueDeproprietizedTextKind, TKind>;
  };

export type ProblemSolutionPattern = {
  readonly problemType: TechniqueDeproprietizedTextForKind<'problem_type'>;
  readonly setupConditions: TechniqueDeproprietizedTextForKind<'setup_conditions'>;
  readonly solutionMechanism: TechniqueDeproprietizedTextForKind<'solution_mechanism'>;
  readonly rhythmPosition: TechniqueDeproprietizedTextForKind<'rhythm_position'>;
  readonly emotionalFunction: TechniqueDeproprietizedTextForKind<'emotional_function'>;
  readonly applicableLimits: readonly TechniqueDeproprietizedTextForKind<'applicable_limit'>[];
};

export type ReusableTechniqueCandidate = {
  readonly id: ReusableTechniqueCandidateId;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'breakdown_book'>;
  readonly bookId: BreakdownBookId;
  readonly sourceObservationIds: readonly WorkTechniqueObservationId[];
  readonly evidenceAnchorIds: readonly EvidenceAnchorId[];
  readonly reusablePrinciple: TechniqueDeproprietizedTextForKind<'reusable_principle'>;
  readonly applicableScope: TechniqueDeproprietizedTextForKind<'applicable_scope'>;
  readonly limitations: readonly TechniqueDeproprietizedTextForKind<'limitation'>[];
  readonly problemSolutionPattern: ProblemSolutionPattern;
};

export type TechniqueEntry = {
  readonly id: TechniqueEntryId;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'technique_library'>;
  readonly libraryId: LibraryId;
  readonly status: TechniqueEntryStatus;
  readonly sourceSnapshot: SourceSnapshot;
};

export type WorkTechniqueObservationOwnership = {
  readonly assetKind: Extract<TechniqueAssetKind, 'work_technique_observation'>;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'breakdown_book'>;
  readonly ownerIdField: 'bookId';
  readonly mayCreateTechniqueEntry: false;
  readonly canBeEditedFromTechniqueLibrary: false;
};

export type ReusableTechniqueCandidateOwnership = {
  readonly assetKind: Extract<TechniqueAssetKind, 'reusable_technique_candidate'>;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'breakdown_book'>;
  readonly ownerIdField: 'bookId';
  readonly mayCreateTechniqueEntry: true;
  readonly canBeEditedFromTechniqueLibrary: false;
};

export type TechniqueEntryOwnership = {
  readonly assetKind: Extract<TechniqueAssetKind, 'technique_entry'>;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'technique_library'>;
  readonly ownerIdField: 'libraryId';
  readonly mayCreateTechniqueEntry: false;
  readonly canBeEditedFromTechniqueLibrary: true;
  readonly writesBackToSourceCandidate: false;
  readonly isMutableMirrorOfSourceCandidate: false;
};

export type TechniqueAssetOwnershipContract = {
  readonly workTechniqueObservation: WorkTechniqueObservationOwnership;
  readonly reusableTechniqueCandidate: ReusableTechniqueCandidateOwnership;
  readonly techniqueEntry: TechniqueEntryOwnership;
};

export const TECHNIQUE_ASSET_OWNERSHIP = {
  workTechniqueObservation: {
    assetKind: 'work_technique_observation',
    ownerKind: 'breakdown_book',
    ownerIdField: 'bookId',
    mayCreateTechniqueEntry: false,
    canBeEditedFromTechniqueLibrary: false,
  },
  reusableTechniqueCandidate: {
    assetKind: 'reusable_technique_candidate',
    ownerKind: 'breakdown_book',
    ownerIdField: 'bookId',
    mayCreateTechniqueEntry: true,
    canBeEditedFromTechniqueLibrary: false,
  },
  techniqueEntry: {
    assetKind: 'technique_entry',
    ownerKind: 'technique_library',
    ownerIdField: 'libraryId',
    mayCreateTechniqueEntry: false,
    canBeEditedFromTechniqueLibrary: true,
    writesBackToSourceCandidate: false,
    isMutableMirrorOfSourceCandidate: false,
  },
} as const satisfies TechniqueAssetOwnershipContract;

export type BreakdownTechniqueEvidenceReferencePolicy = {
  readonly evidenceReferenceField: 'evidenceAnchorIds';
  readonly mayUseEvidenceAnchorIds: true;
  readonly mayUseSourceSnapshot: false;
};

export type TechniqueEntryEvidenceChainPolicy = {
  readonly sourceSnapshotField: 'sourceSnapshot';
  readonly evidenceSummarySource: 'sourceSnapshot.evidenceSummary';
  readonly mayUseEvidenceAnchorIds: false;
  readonly mayMutateSourceEvidenceState: false;
  readonly sourceEvidenceStateIsReadonly: true;
};

export type TechniqueEvidenceChainPolicy = {
  readonly breakdownBookAssets: {
    readonly workTechniqueObservation: BreakdownTechniqueEvidenceReferencePolicy;
    readonly reusableTechniqueCandidate: BreakdownTechniqueEvidenceReferencePolicy;
  };
  readonly techniqueEntry: TechniqueEntryEvidenceChainPolicy;
};

export const TECHNIQUE_EVIDENCE_CHAIN_POLICY = {
  breakdownBookAssets: {
    workTechniqueObservation: {
      evidenceReferenceField: 'evidenceAnchorIds',
      mayUseEvidenceAnchorIds: true,
      mayUseSourceSnapshot: false,
    },
    reusableTechniqueCandidate: {
      evidenceReferenceField: 'evidenceAnchorIds',
      mayUseEvidenceAnchorIds: true,
      mayUseSourceSnapshot: false,
    },
  },
  techniqueEntry: {
    sourceSnapshotField: 'sourceSnapshot',
    evidenceSummarySource: 'sourceSnapshot.evidenceSummary',
    mayUseEvidenceAnchorIds: false,
    mayMutateSourceEvidenceState: false,
    sourceEvidenceStateIsReadonly: true,
  },
} as const satisfies TechniqueEvidenceChainPolicy;

export type TechniqueLibraryEmptyStateCopySource = 'adopted_candidates';

export type TechniqueLibraryManualCreatePolicy = {
  readonly manualCreatePrimaryActionEnabled: false;
  readonly emptyStateCopySource: TechniqueLibraryEmptyStateCopySource;
  readonly emptyStateCopyText: '来自已采纳候选';
  readonly futureManualCreateRequiresProductDecision: true;
  readonly directCreatePrimaryFlowEnabled: false;
  readonly mayBypassAdoptedCandidateForPrimaryCreate: false;
};

export const TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY = {
  manualCreatePrimaryActionEnabled: false,
  emptyStateCopySource: 'adopted_candidates',
  emptyStateCopyText: '来自已采纳候选',
  futureManualCreateRequiresProductDecision: true,
  directCreatePrimaryFlowEnabled: false,
  mayBypassAdoptedCandidateForPrimaryCreate: false,
} as const satisfies TechniqueLibraryManualCreatePolicy;

export type OriginalReferenceSnapshotKind = 'original_reference_snapshot';

export type OriginalReferenceSnapshotSourceTechniqueAssetKind =
  | Extract<TechniqueAssetKind, 'reusable_technique_candidate'>
  | Extract<TechniqueAssetKind, 'technique_entry'>;

export type OriginalReferenceSnapshotConfirmedCandidateSource = {
  readonly sourceTechniqueAssetKind: Extract<TechniqueAssetKind, 'reusable_technique_candidate'>;
  readonly requiredReviewStatus: Extract<ReviewAssetStatus, 'confirmed'>;
};

export type OriginalReferenceSnapshotOrganizedEntrySource = {
  readonly sourceTechniqueAssetKind: Extract<TechniqueAssetKind, 'technique_entry'>;
  readonly requiredEntryStatus: Extract<TechniqueEntryStatus, 'organized'>;
};

export type OriginalReferenceSnapshotAllowedSource =
  | OriginalReferenceSnapshotConfirmedCandidateSource
  | OriginalReferenceSnapshotOrganizedEntrySource;

export type OriginalReferenceSnapshotPolicy = {
  readonly snapshotKind: OriginalReferenceSnapshotKind;
  readonly allowedSources: readonly OriginalReferenceSnapshotAllowedSource[];
  readonly storesSourceSnapshot: true;
  readonly followsSourceMutations: false;
  readonly mayReferenceRawEvidenceAnchor: false;
  readonly mayReferenceDraftTechniqueEntry: false;
  readonly mayReferenceUnconfirmedAiAsset: false;
  readonly createsOriginalBookData: false;
};

export const ORIGINAL_REFERENCE_SNAPSHOT_POLICY = {
  snapshotKind: 'original_reference_snapshot',
  allowedSources: [
    {
      sourceTechniqueAssetKind: 'reusable_technique_candidate',
      requiredReviewStatus: 'confirmed',
    },
    {
      sourceTechniqueAssetKind: 'technique_entry',
      requiredEntryStatus: 'organized',
    },
  ],
  storesSourceSnapshot: true,
  followsSourceMutations: false,
  mayReferenceRawEvidenceAnchor: false,
  mayReferenceDraftTechniqueEntry: false,
  mayReferenceUnconfirmedAiAsset: false,
  createsOriginalBookData: false,
} as const satisfies OriginalReferenceSnapshotPolicy;

export type OriginalReferenceSnapshotBase = {
  readonly snapshotKind: OriginalReferenceSnapshotKind;
  readonly capturedAt: IsoDateTimeString;
  readonly sourceSnapshot: SourceSnapshot;
  readonly followsSourceMutations: false;
  readonly mayReferenceRawEvidenceAnchor: false;
  readonly mayReferenceDraftTechniqueEntry: false;
  readonly mayReferenceUnconfirmedAiAsset: false;
};

export type ConfirmedCandidateOriginalReferenceSnapshot = OriginalReferenceSnapshotBase & {
  readonly sourceTechniqueAssetKind: Extract<TechniqueAssetKind, 'reusable_technique_candidate'>;
  readonly sourceCandidateId: ReusableTechniqueCandidateId;
  readonly sourceCandidateReviewStatus: Extract<ReviewAssetStatus, 'confirmed'>;
};

export type OrganizedEntryOriginalReferenceSnapshot = OriginalReferenceSnapshotBase & {
  readonly sourceTechniqueAssetKind: Extract<TechniqueAssetKind, 'technique_entry'>;
  readonly sourceTechniqueEntryId: TechniqueEntryId;
  readonly sourceTechniqueEntryStatus: Extract<TechniqueEntryStatus, 'organized'>;
};

export type OriginalReferenceSnapshot =
  | ConfirmedCandidateOriginalReferenceSnapshot
  | OrganizedEntryOriginalReferenceSnapshot;

export type ReusableTechniqueCandidateRequiredField =
  | 'reusablePrinciple'
  | 'applicableScope'
  | 'limitations'
  | 'problemSolutionPattern';

export type ReusableTechniqueCandidateForbiddenFieldName =
  | 'characterName'
  | 'roleName'
  | 'proprietarySettingName'
  | 'properSettingName'
  | 'originalSentence'
  | 'originalText'
  | 'bridgeExcerpt'
  | 'characterSpecificTechnique';

export type ReusableTechniqueCandidateBridgeLevelReferenceFormat =
  'problem_solution_pattern';

export type ReusableTechniqueCandidateContentPolicy = {
  readonly requiredFields: readonly ReusableTechniqueCandidateRequiredField[];
  readonly forbiddenFieldNames: readonly ReusableTechniqueCandidateForbiddenFieldName[];
  readonly forbiddenContentKinds: readonly TechniqueForbiddenContentKind[];
  readonly bridgeLevelReferenceFormat: ReusableTechniqueCandidateBridgeLevelReferenceFormat;
  readonly mayStoreCharacterSpecificTechnique: false;
  readonly mayStoreBridgeLevelOriginalExpression: false;
};

export const REUSABLE_TECHNIQUE_CANDIDATE_CONTENT_POLICY = {
  requiredFields: ['reusablePrinciple', 'applicableScope', 'limitations', 'problemSolutionPattern'],
  forbiddenFieldNames: [
    'characterName',
    'roleName',
    'proprietarySettingName',
    'properSettingName',
    'originalSentence',
    'originalText',
    'bridgeExcerpt',
    'characterSpecificTechnique',
  ],
  forbiddenContentKinds: techniqueForbiddenContentKinds,
  bridgeLevelReferenceFormat: 'problem_solution_pattern',
  mayStoreCharacterSpecificTechnique: false,
  mayStoreBridgeLevelOriginalExpression: false,
} as const satisfies ReusableTechniqueCandidateContentPolicy;

export type ReusableTechniqueCandidateForbiddenContentFixture = {
  readonly characterName: string;
  readonly proprietarySettingTerm: string;
  readonly originalSentence: string;
  readonly directCharacterTechnique: string;
  readonly bridgeLevelReenactment: string;
};

export function isReusableTechniqueCandidateContentShapeSafe(
  content: TechniqueDeproprietizedText,
  forbiddenContent: ReusableTechniqueCandidateForbiddenContentFixture,
): boolean {
  const normalizedText = normalizeForTechniqueContentCheck(content.text);
  const forbiddenValues = [
    forbiddenContent.characterName,
    forbiddenContent.proprietarySettingTerm,
    forbiddenContent.originalSentence,
    forbiddenContent.directCharacterTechnique,
    forbiddenContent.bridgeLevelReenactment,
  ]
    .map(normalizeForTechniqueContentCheck)
    .filter((value) => value.length > 0);

  return forbiddenValues.every((forbiddenValue) => !normalizedText.includes(forbiddenValue));
}

function normalizeForTechniqueContentCheck(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

const techniqueForbiddenContentKindSchema = z.enum(techniqueForbiddenContentKinds);
const techniqueEntryStatusSchema = z.enum(TECHNIQUE_ENTRY_STATUSES);

function brandedIdSchema<TId extends string>() {
  return z.string().min(1).transform((value) => value as TId);
}

function isoDateTimeStringSchema() {
  return z
    .string()
    .refine(isIsoDateTimeString, {
      message: 'Expected an ISO datetime string with timezone.',
    })
    .transform((value) => value as IsoDateTimeString);
}

function requireCompleteTechniqueExcludes(
  excludes: readonly TechniqueForbiddenContentKind[],
  addIssue: (message: string) => void,
): void {
  const missingKinds = REUSABLE_TECHNIQUE_CANDIDATE_CONTENT_POLICY.forbiddenContentKinds.filter(
    (kind) => !excludes.includes(kind),
  );

  if (missingKinds.length > 0) {
    addIssue(`Technique deproprietized text excludes must cover: ${missingKinds.join(', ')}`);
  }
}

function createTechniqueDeproprietizedTextSchemaForKind<TKind extends TechniqueDeproprietizedTextKind>(
  kind: TKind,
  forbiddenContent?: ReusableTechniqueCandidateForbiddenContentFixture,
) {
  return z
    .object({
      kind: z.literal(kind),
      text: z.string().min(1),
      excludes: z.array(techniqueForbiddenContentKindSchema),
    })
    .strict()
    .superRefine((content, context) => {
      requireCompleteTechniqueExcludes(content.excludes, (message) => {
        context.addIssue({
          code: 'custom',
          path: ['excludes'],
          message,
        });
      });

      if (forbiddenContent && !isReusableTechniqueCandidateContentShapeSafe(content, forbiddenContent)) {
        context.addIssue({
          code: 'custom',
          path: ['text'],
          message:
            'Technique text must not include character names, proprietary settings, source sentences, character-specific actions, or bridge reenactments.',
        });
      }
    });
}

export function createTechniqueDeproprietizedTextSchema(
  forbiddenContent?: ReusableTechniqueCandidateForbiddenContentFixture,
) {
  return z.union([
    createTechniqueDeproprietizedTextSchemaForKind('reusable_principle', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('applicable_scope', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('limitation', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('problem_type', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('setup_conditions', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('solution_mechanism', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('rhythm_position', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('emotional_function', forbiddenContent),
    createTechniqueDeproprietizedTextSchemaForKind('applicable_limit', forbiddenContent),
  ]);
}

export function createProblemSolutionPatternSchema(
  forbiddenContent?: ReusableTechniqueCandidateForbiddenContentFixture,
) {
  return z
    .object({
      problemType: createTechniqueDeproprietizedTextSchemaForKind('problem_type', forbiddenContent),
      setupConditions: createTechniqueDeproprietizedTextSchemaForKind(
        'setup_conditions',
        forbiddenContent,
      ),
      solutionMechanism: createTechniqueDeproprietizedTextSchemaForKind(
        'solution_mechanism',
        forbiddenContent,
      ),
      rhythmPosition: createTechniqueDeproprietizedTextSchemaForKind(
        'rhythm_position',
        forbiddenContent,
      ),
      emotionalFunction: createTechniqueDeproprietizedTextSchemaForKind(
        'emotional_function',
        forbiddenContent,
      ),
      applicableLimits: z.array(
        createTechniqueDeproprietizedTextSchemaForKind('applicable_limit', forbiddenContent),
      ),
    })
    .strict();
}

export function createReusableTechniqueCandidateSchema(
  forbiddenContent?: ReusableTechniqueCandidateForbiddenContentFixture,
) {
  return z
    .object({
      id: brandedIdSchema<ReusableTechniqueCandidateId>(),
      ownerKind: z.literal('breakdown_book'),
      bookId: brandedIdSchema<BreakdownBookId>(),
      sourceObservationIds: z.array(brandedIdSchema<WorkTechniqueObservationId>()),
      evidenceAnchorIds: z.array(brandedIdSchema<EvidenceAnchorId>()),
      reusablePrinciple: createTechniqueDeproprietizedTextSchemaForKind(
        'reusable_principle',
        forbiddenContent,
      ),
      applicableScope: createTechniqueDeproprietizedTextSchemaForKind(
        'applicable_scope',
        forbiddenContent,
      ),
      limitations: z.array(
        createTechniqueDeproprietizedTextSchemaForKind('limitation', forbiddenContent),
      ),
      problemSolutionPattern: createProblemSolutionPatternSchema(forbiddenContent),
    })
    .strict();
}

export const techniqueDeproprietizedTextSchema = createTechniqueDeproprietizedTextSchema();

export const problemSolutionPatternSchema = createProblemSolutionPatternSchema();

export const reusableTechniqueCandidateSchema = createReusableTechniqueCandidateSchema();

export const workTechniqueObservationSchema = z
  .object({
    id: brandedIdSchema<WorkTechniqueObservationId>(),
    ownerKind: z.literal('breakdown_book'),
    bookId: brandedIdSchema<BreakdownBookId>(),
    evidenceAnchorIds: z.array(brandedIdSchema<EvidenceAnchorId>()),
  })
  .strict();

export const techniqueEntrySchema = z
  .object({
    id: brandedIdSchema<TechniqueEntryId>(),
    ownerKind: z.literal('technique_library'),
    libraryId: brandedIdSchema<LibraryId>(),
    status: techniqueEntryStatusSchema,
    sourceSnapshot: sourceSnapshotSchema,
  })
  .strict();

const originalReferenceSnapshotBaseSchema = {
  snapshotKind: z.literal('original_reference_snapshot'),
  capturedAt: isoDateTimeStringSchema(),
  sourceSnapshot: sourceSnapshotSchema,
  followsSourceMutations: z.literal(false),
  mayReferenceRawEvidenceAnchor: z.literal(false),
  mayReferenceDraftTechniqueEntry: z.literal(false),
  mayReferenceUnconfirmedAiAsset: z.literal(false),
};

export const originalReferenceSnapshotSchema = z.discriminatedUnion('sourceTechniqueAssetKind', [
  z
    .object({
      ...originalReferenceSnapshotBaseSchema,
      sourceTechniqueAssetKind: z.literal('reusable_technique_candidate'),
      sourceCandidateId: brandedIdSchema<ReusableTechniqueCandidateId>(),
      sourceCandidateReviewStatus: z.literal('confirmed'),
    })
    .strict(),
  z
    .object({
      ...originalReferenceSnapshotBaseSchema,
      sourceTechniqueAssetKind: z.literal('technique_entry'),
      sourceTechniqueEntryId: brandedIdSchema<TechniqueEntryId>(),
      sourceTechniqueEntryStatus: z.literal('organized'),
    })
    .strict(),
]);

function isIsoDateTimeString(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}
