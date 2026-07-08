import type { AnalysisModuleKey, ReviewAssetStatus } from './analysis';
import type {
  AnalysisModuleInstanceId,
  BreakdownBookId,
  EvidenceAnchorId,
  PerspectiveInstanceId,
  RelationLinkId,
  ReusableTechniqueCandidateId,
  WorkTechniqueObservationId,
} from './ids';
import type { ScopeRef } from './dtos';
import type { TechniqueAssetKind, TechniqueAssetOwnerKind } from './technique';

export const PERSPECTIVE_KEYS = [
  'foreshadowing_suspense_payoff',
  'character_relation_dynamics',
  'setting_rule_payoff',
  'pacing_emotion_drive',
  'technique_source_trace',
] as const;

export type PerspectiveKey = (typeof PERSPECTIVE_KEYS)[number];

export type PerspectiveViewKind = 'derived_composite_view';

export type PerspectiveDefinition = {
  readonly key: PerspectiveKey;
  readonly name: string;
  readonly kind: PerspectiveViewKind;
  readonly createsAnalysisModuleInstance: false;
  readonly isFactSource: false;
  readonly mayStoreViewInstance: true;
};

export const PERSPECTIVE_DEFINITIONS = [
  {
    key: 'foreshadowing_suspense_payoff',
    name: '伏笔/悬念/回收链',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'character_relation_dynamics',
    name: '人物关系动力/身份互动',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'setting_rule_payoff',
    name: '设定展开/规则兑现',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'pacing_emotion_drive',
    name: '节奏/情绪/阅读驱动力',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
  {
    key: 'technique_source_trace',
    name: '可复用技法来源视角',
    kind: 'derived_composite_view',
    createsAnalysisModuleInstance: false,
    isFactSource: false,
    mayStoreViewInstance: true,
  },
] as const satisfies readonly PerspectiveDefinition[];

export const PERSPECTIVE_STATUSES = [
  'current',
  'partial',
  'stale',
  'blocked',
  'needs_refresh',
] as const;

export type PerspectiveInstanceStatus = (typeof PERSPECTIVE_STATUSES)[number];

export type PerspectiveSourceRevisionSnapshot = {
  readonly sourceTextEdition: number | null;
  readonly structureEdition: number | null;
  readonly analysisRevision: number | null;
};

export type PerspectiveInstance = {
  readonly id: PerspectiveInstanceId;
  readonly perspectiveKey: PerspectiveKey;
  readonly bookId: BreakdownBookId;
  readonly scopeRef: ScopeRef;
  readonly status: PerspectiveInstanceStatus;
  readonly sourceRevisionSnapshot: PerspectiveSourceRevisionSnapshot;
};

export type PerspectiveScopeRefMeaning = 'analysis_target_boundary';

export type PerspectiveIdentityContract = {
  readonly definitionKind: PerspectiveViewKind;
  readonly createsAnalysisModuleInstance: false;
  readonly isFactSource: false;
  readonly mayStoreViewInstance: true;
  readonly scopeRefField: 'scopeRef';
  readonly scopeRefMeaning: PerspectiveScopeRefMeaning;
  readonly identityFields: readonly [
    'id',
    'perspectiveKey',
    'bookId',
    'scopeRef',
    'status',
    'sourceRevisionSnapshot',
  ];
};

export const PERSPECTIVE_IDENTITY_CONTRACT = {
  definitionKind: 'derived_composite_view',
  createsAnalysisModuleInstance: false,
  isFactSource: false,
  mayStoreViewInstance: true,
  scopeRefField: 'scopeRef',
  scopeRefMeaning: 'analysis_target_boundary',
  identityFields: [
    'id',
    'perspectiveKey',
    'bookId',
    'scopeRef',
    'status',
    'sourceRevisionSnapshot',
  ],
} as const satisfies PerspectiveIdentityContract;

export const PERSPECTIVE_DEPENDENCY_ASSET_KINDS = [
  'analysis_module_instance',
  'relation_link',
  'evidence_anchor',
  'work_technique_observation',
  'reusable_technique_candidate',
] as const;

export type PerspectiveDependencyAssetKind =
  (typeof PERSPECTIVE_DEPENDENCY_ASSET_KINDS)[number];

export type PerspectiveDependencyRequirement = 'required' | 'optional';

export type PerspectiveStatusFromMissingDependency = Extract<
  PerspectiveInstanceStatus,
  'blocked' | 'partial'
>;

export type PerspectiveAnalysisModuleInstanceDependency = {
  readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'analysis_module_instance'>;
  readonly requirement: PerspectiveDependencyRequirement;
  readonly sourceModuleKeys: readonly AnalysisModuleKey[];
};

export type PerspectiveRelationLinkDependency = {
  readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'relation_link'>;
  readonly requirement: PerspectiveDependencyRequirement;
  readonly usage: 'reference_only';
};

export type PerspectiveSimpleDependency = {
  readonly assetKind: Exclude<
    PerspectiveDependencyAssetKind,
    'analysis_module_instance' | 'relation_link'
  >;
  readonly requirement: PerspectiveDependencyRequirement;
};

export type PerspectiveDependency =
  | PerspectiveAnalysisModuleInstanceDependency
  | PerspectiveRelationLinkDependency
  | PerspectiveSimpleDependency;

export type PerspectiveDependencyAssetRef =
  | {
      readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'analysis_module_instance'>;
      readonly id: AnalysisModuleInstanceId;
    }
  | {
      readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'relation_link'>;
      readonly id: RelationLinkId;
    }
  | {
      readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'evidence_anchor'>;
      readonly id: EvidenceAnchorId;
    }
  | {
      readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'work_technique_observation'>;
      readonly id: WorkTechniqueObservationId;
    }
  | {
      readonly assetKind: Extract<PerspectiveDependencyAssetKind, 'reusable_technique_candidate'>;
      readonly id: ReusableTechniqueCandidateId;
    };

export type PerspectiveDependencyMatrixEntry = {
  readonly perspectiveKey: PerspectiveKey;
  readonly dependencies: readonly PerspectiveDependency[];
  readonly missingAnalysisModuleInstanceStatus: Extract<
    PerspectiveStatusFromMissingDependency,
    'partial'
  >;
  readonly missingRequiredSourceAssetStatus: Extract<
    PerspectiveStatusFromMissingDependency,
    'blocked'
  >;
  readonly missingOptionalDependencyStatus: Extract<
    PerspectiveStatusFromMissingDependency,
    'partial'
  >;
  readonly mayGenerateRelationFacts: false;
};

export type PerspectiveMissingDependencyFixture = {
  readonly perspectiveKey: PerspectiveKey;
  readonly missingAssetKind: PerspectiveDependencyAssetKind;
  readonly missingRequirement: PerspectiveDependencyRequirement;
  readonly displayStatus: PerspectiveStatusFromMissingDependency;
};

export const PERSPECTIVE_DEPENDENCY_MATRIX = [
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['plot_causality', 'narrative_pacing'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'character_relation_dynamics',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['character_relations', 'plot_causality'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'setting_rule_payoff',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['world_rules', 'plot_causality'],
      },
      {
        assetKind: 'relation_link',
        requirement: 'required',
        usage: 'reference_only',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'pacing_emotion_drive',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['narrative_pacing', 'plot_causality', 'style_expression'],
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'relation_link',
        requirement: 'optional',
        usage: 'reference_only',
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'optional',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
  {
    perspectiveKey: 'technique_source_trace',
    dependencies: [
      {
        assetKind: 'analysis_module_instance',
        requirement: 'required',
        sourceModuleKeys: ['technique_principles'],
      },
      {
        assetKind: 'work_technique_observation',
        requirement: 'required',
      },
      {
        assetKind: 'reusable_technique_candidate',
        requirement: 'required',
      },
      {
        assetKind: 'evidence_anchor',
        requirement: 'required',
      },
      {
        assetKind: 'relation_link',
        requirement: 'optional',
        usage: 'reference_only',
      },
    ],
    missingAnalysisModuleInstanceStatus: 'partial',
    missingRequiredSourceAssetStatus: 'blocked',
    missingOptionalDependencyStatus: 'partial',
    mayGenerateRelationFacts: false,
  },
] as const satisfies readonly PerspectiveDependencyMatrixEntry[];

export const PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES = [
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    missingAssetKind: 'analysis_module_instance',
    missingRequirement: 'required',
    displayStatus: 'partial',
  },
  {
    perspectiveKey: 'pacing_emotion_drive',
    missingAssetKind: 'relation_link',
    missingRequirement: 'optional',
    displayStatus: 'partial',
  },
  {
    perspectiveKey: 'technique_source_trace',
    missingAssetKind: 'reusable_technique_candidate',
    missingRequirement: 'required',
    displayStatus: 'blocked',
  },
] as const satisfies readonly PerspectiveMissingDependencyFixture[];

export type PerspectiveStatusReasonKind =
  | 'missing_analysis_module_instance'
  | 'structure_changed'
  | 'broken_evidence_anchor';

export type PerspectiveSourceChangeKind = 'structure_changed';

export type PerspectiveSourceChangeStatusRule = {
  readonly sourceChangeKind: PerspectiveSourceChangeKind;
  readonly marksAffectedPerspectives: true;
  readonly affectedStatus: Extract<PerspectiveInstanceStatus, 'needs_refresh'>;
  readonly preservesStoredView: true;
  readonly autoRecompute: false;
  readonly overwriteExistingViewOnOpen: false;
};

export const PERSPECTIVE_SOURCE_CHANGE_STATUS_RULES = [
  {
    sourceChangeKind: 'structure_changed',
    marksAffectedPerspectives: true,
    affectedStatus: 'needs_refresh',
    preservesStoredView: true,
    autoRecompute: false,
    overwriteExistingViewOnOpen: false,
  },
] as const satisfies readonly PerspectiveSourceChangeStatusRule[];

export type PerspectiveStatusFixture = {
  readonly perspectiveKey: PerspectiveKey;
  readonly reasonKind: PerspectiveStatusReasonKind;
  readonly displayStatus: Exclude<PerspectiveInstanceStatus, 'current'>;
  readonly displayReason?: 'source_error';
  readonly marksAffectedPerspectives?: true;
  readonly autoRecompute?: false;
  readonly overwriteExistingViewOnOpen?: false;
  readonly silentDisplayAllowed: false;
};

export const PERSPECTIVE_STATUS_FIXTURES = [
  {
    perspectiveKey: 'character_relation_dynamics',
    reasonKind: 'missing_analysis_module_instance',
    displayStatus: 'partial',
    silentDisplayAllowed: false,
  },
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    reasonKind: 'structure_changed',
    displayStatus: 'needs_refresh',
    marksAffectedPerspectives: true,
    autoRecompute: false,
    overwriteExistingViewOnOpen: false,
    silentDisplayAllowed: false,
  },
  {
    perspectiveKey: 'setting_rule_payoff',
    reasonKind: 'broken_evidence_anchor',
    displayStatus: 'blocked',
    displayReason: 'source_error',
    silentDisplayAllowed: false,
  },
] as const satisfies readonly PerspectiveStatusFixture[];

export type PerspectiveExportedViewKind = 'derived_reading_view';

export type PerspectiveExportParticipationKind = 'exportable_derived_reading_view';

export type PerspectiveExportStatusMarkerStatus = Extract<
  PerspectiveInstanceStatus,
  'partial' | 'stale'
>;

export type PerspectiveOriginalContextSourceAssetKind = Exclude<
  PerspectiveDependencyAssetKind,
  'analysis_module_instance'
>;

export type PerspectiveOriginalContextParticipationPolicy = {
  readonly targetKind: 'original_context';
  readonly allowedSourceAssetKinds: readonly PerspectiveOriginalContextSourceAssetKind[];
  readonly requiredSourceReviewStatus: Extract<ReviewAssetStatus, 'confirmed'>;
  readonly requiresConfirmedSourceAssets: true;
  readonly perspectiveViewMayParticipate: false;
  readonly perspectiveDerivedFactsMayBeCitedAsSource: false;
};

export type PerspectiveExportPolicy = {
  readonly exportedViewKind: PerspectiveExportedViewKind;
  readonly participation: PerspectiveExportParticipationKind;
  readonly exportableAsDerivedReadingView: true;
  readonly exportedAsFactSource: false;
  readonly statusMarkerRequiredFor: readonly PerspectiveExportStatusMarkerStatus[];
  readonly statusMarkerField: 'perspectiveStatus';
  readonly originalContext: PerspectiveOriginalContextParticipationPolicy;
};

export const PERSPECTIVE_EXPORT_POLICY = {
  exportedViewKind: 'derived_reading_view',
  participation: 'exportable_derived_reading_view',
  exportableAsDerivedReadingView: true,
  exportedAsFactSource: false,
  statusMarkerRequiredFor: ['partial', 'stale'],
  statusMarkerField: 'perspectiveStatus',
  originalContext: {
    targetKind: 'original_context',
    allowedSourceAssetKinds: [
      'relation_link',
      'evidence_anchor',
      'work_technique_observation',
      'reusable_technique_candidate',
    ],
    requiredSourceReviewStatus: 'confirmed',
    requiresConfirmedSourceAssets: true,
    perspectiveViewMayParticipate: false,
    perspectiveDerivedFactsMayBeCitedAsSource: false,
  },
} as const satisfies PerspectiveExportPolicy;

export type PerspectiveCurrentExportPolicyFixture = {
  readonly perspectiveKey: PerspectiveKey;
  readonly instanceStatus: Extract<PerspectiveInstanceStatus, 'current'>;
  readonly exportParticipation: PerspectiveExportParticipationKind;
  readonly requiresStatusMarker: false;
  readonly statusMarker?: never;
  readonly exportedAsFactSource: false;
};

export type PerspectiveMarkedExportPolicyFixture = {
  readonly perspectiveKey: PerspectiveKey;
  readonly instanceStatus: PerspectiveExportStatusMarkerStatus;
  readonly exportParticipation: PerspectiveExportParticipationKind;
  readonly requiresStatusMarker: true;
  readonly statusMarker: PerspectiveExportStatusMarkerStatus;
  readonly exportedAsFactSource: false;
};

export type PerspectiveExportPolicyFixture =
  | PerspectiveCurrentExportPolicyFixture
  | PerspectiveMarkedExportPolicyFixture;

export const PERSPECTIVE_EXPORT_POLICY_FIXTURES = [
  {
    perspectiveKey: 'foreshadowing_suspense_payoff',
    instanceStatus: 'current',
    exportParticipation: 'exportable_derived_reading_view',
    requiresStatusMarker: false,
    exportedAsFactSource: false,
  },
  {
    perspectiveKey: 'character_relation_dynamics',
    instanceStatus: 'partial',
    exportParticipation: 'exportable_derived_reading_view',
    requiresStatusMarker: true,
    statusMarker: 'partial',
    exportedAsFactSource: false,
  },
  {
    perspectiveKey: 'setting_rule_payoff',
    instanceStatus: 'stale',
    exportParticipation: 'exportable_derived_reading_view',
    requiresStatusMarker: true,
    statusMarker: 'stale',
    exportedAsFactSource: false,
  },
] as const satisfies readonly PerspectiveExportPolicyFixture[];

export type PerspectiveTechniqueModuleAssetKind = Extract<
  PerspectiveDependencyAssetKind,
  'work_technique_observation' | 'reusable_technique_candidate'
>;

export type PerspectiveTechniqueTraceAssetKind = Extract<
  PerspectiveDependencyAssetKind,
  'work_technique_observation' | 'reusable_technique_candidate' | 'evidence_anchor'
>;

export type PerspectiveTechniqueTraceRole = 'source_chain_trace_only';

export type PerspectiveTechniqueModuleRelation = {
  readonly moduleKey: Extract<AnalysisModuleKey, 'technique_principles'>;
  readonly savesAssetKinds: readonly PerspectiveTechniqueModuleAssetKind[];
  readonly authoritativeForSavedAssets: true;
  readonly savesTechniqueEntry: false;
};

export type PerspectiveTechniqueSourceTraceRelation = {
  readonly role: PerspectiveTechniqueTraceRole;
  readonly tracedAssetKinds: readonly PerspectiveTechniqueTraceAssetKind[];
  readonly mayCreateTechniqueAssets: false;
  readonly mayEditTechniqueAssets: false;
  readonly mayAdoptTechniqueEntry: false;
  readonly mayCreateTechniqueEntry: false;
  readonly mayStoreTechniqueEntry: false;
};

export type PerspectiveTechniqueLibraryRelation = {
  readonly assetKind: Extract<TechniqueAssetKind, 'technique_entry'>;
  readonly ownerKind: Extract<TechniqueAssetOwnerKind, 'technique_library'>;
  readonly entryBelongsToFusionTechniqueLibrary: true;
  readonly perspectiveMayAdoptTechniqueEntry: false;
  readonly perspectiveMayMutateTechniqueEntry: false;
};

export type PerspectiveTechniqueRelation = {
  readonly perspectiveKey: Extract<PerspectiveKey, 'technique_source_trace'>;
  readonly techniqueModule: PerspectiveTechniqueModuleRelation;
  readonly perspectiveTrace: PerspectiveTechniqueSourceTraceRelation;
  readonly techniqueLibrary: PerspectiveTechniqueLibraryRelation;
};

export const PERSPECTIVE_TECHNIQUE_RELATION = {
  perspectiveKey: 'technique_source_trace',
  techniqueModule: {
    moduleKey: 'technique_principles',
    savesAssetKinds: ['work_technique_observation', 'reusable_technique_candidate'],
    authoritativeForSavedAssets: true,
    savesTechniqueEntry: false,
  },
  perspectiveTrace: {
    role: 'source_chain_trace_only',
    tracedAssetKinds: [
      'work_technique_observation',
      'reusable_technique_candidate',
      'evidence_anchor',
    ],
    mayCreateTechniqueAssets: false,
    mayEditTechniqueAssets: false,
    mayAdoptTechniqueEntry: false,
    mayCreateTechniqueEntry: false,
    mayStoreTechniqueEntry: false,
  },
  techniqueLibrary: {
    assetKind: 'technique_entry',
    ownerKind: 'technique_library',
    entryBelongsToFusionTechniqueLibrary: true,
    perspectiveMayAdoptTechniqueEntry: false,
    perspectiveMayMutateTechniqueEntry: false,
  },
} as const satisfies PerspectiveTechniqueRelation;

export type PerspectiveTechniqueRelationFixture = {
  readonly perspectiveKey: Extract<PerspectiveKey, 'technique_source_trace'>;
  readonly techniqueModuleStores: readonly PerspectiveTechniqueModuleAssetKind[];
  readonly perspectiveTraceOnlyAssets: readonly PerspectiveTechniqueTraceAssetKind[];
  readonly techniqueLibraryOwns: Extract<TechniqueAssetKind, 'technique_entry'>;
  readonly techniqueEntryOwnerKind: Extract<TechniqueAssetOwnerKind, 'technique_library'>;
  readonly perspectiveMayAdoptTechniqueEntry: false;
  readonly perspectiveMayCreateTechniqueEntry: false;
  readonly perspectiveMayStoreTechniqueEntry: false;
  readonly perspectiveMayEditObservationOrCandidate: false;
};

export const PERSPECTIVE_TECHNIQUE_RELATION_FIXTURE = {
  perspectiveKey: 'technique_source_trace',
  techniqueModuleStores: ['work_technique_observation', 'reusable_technique_candidate'],
  perspectiveTraceOnlyAssets: [
    'work_technique_observation',
    'reusable_technique_candidate',
    'evidence_anchor',
  ],
  techniqueLibraryOwns: 'technique_entry',
  techniqueEntryOwnerKind: 'technique_library',
  perspectiveMayAdoptTechniqueEntry: false,
  perspectiveMayCreateTechniqueEntry: false,
  perspectiveMayStoreTechniqueEntry: false,
  perspectiveMayEditObservationOrCandidate: false,
} as const satisfies PerspectiveTechniqueRelationFixture;

export type PerspectiveEditableViewField = 'view_note' | 'annotation';

export type PerspectiveViewFieldEditPolicy = {
  readonly field: PerspectiveEditableViewField;
  readonly writableByUser: true;
  readonly createsFacts: false;
};

export type PerspectiveDerivedSummaryRefreshPolicy = {
  readonly derivedSummaryMayExist: true;
  readonly manualRefreshRequiresFutureAuthorizedFlow: true;
  readonly autoRefreshEnabled: false;
  readonly refreshOnOpen: false;
  readonly refreshCreatesFacts: false;
};

export type PerspectiveSourceFactKind =
  | 'relation_fact'
  | 'evidence_state'
  | 'reusable_technique_candidate';

export type PerspectiveSourceFactEditSurface = 'source_module';

export type PerspectiveRelationFactEditRule = {
  readonly factKind: Extract<PerspectiveSourceFactKind, 'relation_fact'>;
  readonly sourceAssetKind: Extract<PerspectiveDependencyAssetKind, 'relation_link'>;
  readonly requiredEditSurface: PerspectiveSourceFactEditSurface;
  readonly editableFromPerspective: false;
};

export type PerspectiveEvidenceStateEditRule = {
  readonly factKind: Extract<PerspectiveSourceFactKind, 'evidence_state'>;
  readonly sourceAssetKind: Extract<PerspectiveDependencyAssetKind, 'evidence_anchor'>;
  readonly requiredEditSurface: PerspectiveSourceFactEditSurface;
  readonly editableFromPerspective: false;
};

export type PerspectiveReusableTechniqueCandidateEditRule = {
  readonly factKind: Extract<PerspectiveSourceFactKind, 'reusable_technique_candidate'>;
  readonly sourceAssetKind: Extract<
    PerspectiveDependencyAssetKind,
    'reusable_technique_candidate'
  >;
  readonly requiredEditSurface: PerspectiveSourceFactEditSurface;
  readonly editableFromPerspective: false;
};

export type PerspectiveSourceFactEditRule =
  | PerspectiveRelationFactEditRule
  | PerspectiveEvidenceStateEditRule
  | PerspectiveReusableTechniqueCandidateEditRule;

export type PerspectiveEditPolicy = {
  readonly perspectiveMayCreateFacts: false;
  readonly editableViewFields: readonly PerspectiveViewFieldEditPolicy[];
  readonly derivedSummaryRefresh: PerspectiveDerivedSummaryRefreshPolicy;
  readonly sourceFactEditRules: readonly PerspectiveSourceFactEditRule[];
};

export const PERSPECTIVE_EDIT_POLICY = {
  perspectiveMayCreateFacts: false,
  editableViewFields: [
    {
      field: 'view_note',
      writableByUser: true,
      createsFacts: false,
    },
    {
      field: 'annotation',
      writableByUser: true,
      createsFacts: false,
    },
  ],
  derivedSummaryRefresh: {
    derivedSummaryMayExist: true,
    manualRefreshRequiresFutureAuthorizedFlow: true,
    autoRefreshEnabled: false,
    refreshOnOpen: false,
    refreshCreatesFacts: false,
  },
  sourceFactEditRules: [
    {
      factKind: 'relation_fact',
      sourceAssetKind: 'relation_link',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
    {
      factKind: 'evidence_state',
      sourceAssetKind: 'evidence_anchor',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
    {
      factKind: 'reusable_technique_candidate',
      sourceAssetKind: 'reusable_technique_candidate',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
  ],
} as const satisfies PerspectiveEditPolicy;
