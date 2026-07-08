import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  ReviewAssetId,
  RevisionId,
} from './ids';
import type { IsoDateTimeString, ScopeRef } from './dtos';
import { MODULE_INSTANCE_STATUSES, type ModuleInstanceStatus, type ScopeKind } from './status';

export const ANALYSIS_MODULE_KEYS = [
  'structure_and_segments',
  'plot_causality',
  'narrative_pacing',
  'character_relations',
  'world_rules',
  'style_expression',
  'technique_principles',
] as const;

export type AnalysisModuleKey = (typeof ANALYSIS_MODULE_KEYS)[number];

export type AnalysisModuleCategory = 'structure_input' | 'analysis';

export type AnalysisModuleDefinition = {
  readonly key: AnalysisModuleKey;
  readonly id: AnalysisModuleId;
  readonly name: string;
  readonly category: AnalysisModuleCategory;
  readonly createsModuleInstance: true;
};

export const ANALYSIS_MODULE_DEFINITIONS = [
  {
    key: 'structure_and_segments',
    id: 'structure_and_segments' as AnalysisModuleId,
    name: '作品结构与分段',
    category: 'structure_input',
    createsModuleInstance: true,
  },
  {
    key: 'plot_causality',
    id: 'plot_causality' as AnalysisModuleId,
    name: '情节大纲与因果',
    category: 'analysis',
    createsModuleInstance: true,
  },
  {
    key: 'narrative_pacing',
    id: 'narrative_pacing' as AnalysisModuleId,
    name: '叙事结构、信息释放与节奏',
    category: 'analysis',
    createsModuleInstance: true,
  },
  {
    key: 'character_relations',
    id: 'character_relations' as AnalysisModuleId,
    name: '人物系统与关系',
    category: 'analysis',
    createsModuleInstance: true,
  },
  {
    key: 'world_rules',
    id: 'world_rules' as AnalysisModuleId,
    name: '世界设定与规则',
    category: 'analysis',
    createsModuleInstance: true,
  },
  {
    key: 'style_expression',
    id: 'style_expression' as AnalysisModuleId,
    name: '文风语言与表达',
    category: 'analysis',
    createsModuleInstance: true,
  },
  {
    key: 'technique_principles',
    id: 'technique_principles' as AnalysisModuleId,
    name: '写作技法与可复用原则',
    category: 'analysis',
    createsModuleInstance: true,
  },
] as const satisfies readonly AnalysisModuleDefinition[];

export const ANALYSIS_SECONDARY_SYSTEM_PAGE_KEYS = [
  'ai_constraint_summary',
] as const;

export type AnalysisSecondarySystemPageKey = (typeof ANALYSIS_SECONDARY_SYSTEM_PAGE_KEYS)[number];

export type AnalysisSecondarySystemPageCategory = 'secondary_system_page';

export type AnalysisSecondarySystemPageDefinition = {
  readonly key: AnalysisSecondarySystemPageKey;
  readonly name: string;
  readonly category: AnalysisSecondarySystemPageCategory;
  readonly createsModuleInstance: false;
};

export const ANALYSIS_SECONDARY_SYSTEM_PAGES = [
  {
    key: 'ai_constraint_summary',
    name: 'AI 约束摘要',
    category: 'secondary_system_page',
    createsModuleInstance: false,
  },
] as const satisfies readonly AnalysisSecondarySystemPageDefinition[];

export type AnalysisModuleScopeRelation =
  | 'standard_analysis_scope'
  | 'structure_range_layer';

export type AnalysisModuleScopeMatrixEntry = {
  readonly moduleKey: AnalysisModuleKey;
  readonly supportedScopes: readonly ScopeKind[];
  readonly storySegmentRangeRelation: AnalysisModuleScopeRelation;
};

export const ANALYSIS_MODULE_SCOPE_MATRIX = [
  {
    moduleKey: 'structure_and_segments',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'structure_range_layer',
  },
  {
    moduleKey: 'plot_causality',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'narrative_pacing',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'character_relations',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'world_rules',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'style_expression',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
  {
    moduleKey: 'technique_principles',
    supportedScopes: ['book', 'volume', 'chapter', 'story_segment_range'],
    storySegmentRangeRelation: 'standard_analysis_scope',
  },
] as const satisfies readonly AnalysisModuleScopeMatrixEntry[];

export type AnalysisScopeExcludedTargetKind =
  | 'secondary_system_page'
  | 'derived_view_family';

export type AnalysisScopeExcludedTarget = {
  readonly targetKey: string;
  readonly targetKind: AnalysisScopeExcludedTargetKind;
  readonly attemptedScope: ScopeKind;
  readonly reason: string;
};

export const ANALYSIS_SCOPE_EXCLUDED_TARGETS = [
  {
    targetKey: 'ai_constraint_summary',
    targetKind: 'secondary_system_page',
    attemptedScope: 'book',
    reason: 'AI 约束摘要是二级系统页，不生成普通 AnalysisModuleInstance。',
  },
  {
    targetKey: 'thematic_perspective',
    targetKind: 'derived_view_family',
    attemptedScope: 'story_segment_range',
    reason: '专题视角是跨模块派生视图，不属于 AnalysisModule scope matrix。',
  },
] as const satisfies readonly AnalysisScopeExcludedTarget[];

export const ANALYSIS_ASSET_KINDS = [
  'body',
  'structured_object',
  'evidence_anchor',
  'relation_link',
  'work_technique_observation',
  'reusable_technique_candidate',
  'ai_constraint',
] as const;

export type AnalysisAssetKind = (typeof ANALYSIS_ASSET_KINDS)[number];

export type AnalysisModuleAssetMatrixEntry = {
  readonly moduleKey: AnalysisModuleKey;
  readonly allowedAssetKinds: readonly AnalysisAssetKind[];
};

export const ANALYSIS_MODULE_ASSET_MATRIX = [
  {
    moduleKey: 'structure_and_segments',
    allowedAssetKinds: ['body', 'structured_object', 'evidence_anchor'],
  },
  {
    moduleKey: 'plot_causality',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'narrative_pacing',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'character_relations',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'world_rules',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'style_expression',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'ai_constraint',
    ],
  },
  {
    moduleKey: 'technique_principles',
    allowedAssetKinds: [
      'body',
      'structured_object',
      'evidence_anchor',
      'relation_link',
      'work_technique_observation',
      'reusable_technique_candidate',
      'ai_constraint',
    ],
  },
] as const satisfies readonly AnalysisModuleAssetMatrixEntry[];

export type AnalysisTechniqueObservationRouting = {
  readonly assetKind: Extract<AnalysisAssetKind, 'work_technique_observation'>;
  readonly sourceModuleKeys: readonly AnalysisModuleKey[];
  readonly reviewModuleKey: Extract<AnalysisModuleKey, 'technique_principles'>;
};

export const ANALYSIS_TECHNIQUE_OBSERVATION_ROUTING = {
  assetKind: 'work_technique_observation',
  sourceModuleKeys: [
    'plot_causality',
    'narrative_pacing',
    'character_relations',
    'world_rules',
    'style_expression',
    'technique_principles',
  ],
  reviewModuleKey: 'technique_principles',
} as const satisfies AnalysisTechniqueObservationRouting;

export type AnalysisBodyContentKind = 'human_readable_markdown';

export type AnalysisBodyBoundaryPolicy = {
  readonly bodyAssetKind: Extract<AnalysisAssetKind, 'body'>;
  readonly contentKind: AnalysisBodyContentKind;
  readonly purpose: string;
  readonly carriesStructuredFacts: false;
  readonly structuredFactsRequireControls: true;
};

export const ANALYSIS_BODY_BOUNDARY_POLICY = {
  bodyAssetKind: 'body',
  contentKind: 'human_readable_markdown',
  purpose: '人类阅读与编辑的模块正文',
  carriesStructuredFacts: false,
  structuredFactsRequireControls: true,
} as const satisfies AnalysisBodyBoundaryPolicy;

export const ANALYSIS_STRUCTURED_FIELD_KINDS = [
  'structured_object',
  'evidence_anchor',
  'tag',
  'object_link',
  'relation_link',
  'work_technique_observation',
  'review_status',
  'ai_constraint',
  'reusable_technique_candidate',
] as const;

export type AnalysisStructuredFieldKind = (typeof ANALYSIS_STRUCTURED_FIELD_KINDS)[number];

export type AnalysisMarkdownEditResultKind = 'revision';

export type AnalysisMarkdownEditPolicy = {
  readonly operation: 'markdown_body_edit';
  readonly resultKind: AnalysisMarkdownEditResultKind;
  readonly mayUpdateBodyText: true;
  readonly mayCreateStructuredFields: false;
  readonly mayParseStructuredFactsFromMarkdown: false;
  readonly mayImportStructuredFactsFromJsonMirror: false;
};

export const ANALYSIS_MARKDOWN_EDIT_POLICY = {
  operation: 'markdown_body_edit',
  resultKind: 'revision',
  mayUpdateBodyText: true,
  mayCreateStructuredFields: false,
  mayParseStructuredFactsFromMarkdown: false,
  mayImportStructuredFactsFromJsonMirror: false,
} as const satisfies AnalysisMarkdownEditPolicy;

export type AnalysisReviewAssetKind = AnalysisAssetKind;

export const REVIEW_ASSET_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'excluded',
  'needs_evidence',
  'stale',
] as const;

export type ReviewAssetStatus = (typeof REVIEW_ASSET_STATUSES)[number];

export const ANALYSIS_REVIEW_STATUSES = REVIEW_ASSET_STATUSES;

export type AnalysisReviewStatus = ReviewAssetStatus;

export const EVIDENCE_POLICIES = [
  'not_required',
  'optional',
  'required_for_confirmation',
] as const;

export type EvidencePolicy = (typeof EVIDENCE_POLICIES)[number];

export type ReviewAssetEnvelope = {
  readonly reviewAssetId: ReviewAssetId;
  readonly assetKind: AnalysisReviewAssetKind;
  readonly sourceModuleInstanceId: AnalysisModuleInstanceId;
  readonly sourceModuleKey: AnalysisModuleKey;
  readonly scopeRef: ScopeRef;
  readonly reviewStatus: ReviewAssetStatus;
  readonly evidencePolicy: EvidencePolicy;
  readonly sourceTextEdition?: number;
  readonly structureEdition?: number;
  readonly schemaVersion: string;
  readonly revisionId?: RevisionId;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
};

export type AnalysisModuleInstanceContract = {
  readonly ownerKind: 'analysis_module_instance';
  readonly identityFields: readonly ['id', 'bookId', 'moduleId', 'scope', 'analysisRevision'];
  readonly statusFieldKind: 'status';
  readonly statusValues: readonly ModuleInstanceStatus[];
  readonly bodyAssetKind: Extract<AnalysisAssetKind, 'body'>;
  readonly reviewAssetKinds: readonly AnalysisReviewAssetKind[];
  readonly reviewStatusFieldKind: Extract<AnalysisStructuredFieldKind, 'review_status'>;
  readonly bodyEditResultKind: AnalysisMarkdownEditResultKind;
};

export const ANALYSIS_MODULE_INSTANCE_CONTRACT = {
  ownerKind: 'analysis_module_instance',
  identityFields: ['id', 'bookId', 'moduleId', 'scope', 'analysisRevision'],
  statusFieldKind: 'status',
  statusValues: MODULE_INSTANCE_STATUSES,
  bodyAssetKind: 'body',
  reviewAssetKinds: [
    'body',
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
    'ai_constraint',
  ],
  reviewStatusFieldKind: 'review_status',
  bodyEditResultKind: 'revision',
} as const satisfies AnalysisModuleInstanceContract;

export type AnalysisReviewAssetContract = {
  readonly ownerKind: 'analysis_module_instance';
  readonly envelopeKind: 'review_asset';
  readonly identityField: 'reviewAssetId';
  readonly assetKinds: readonly AnalysisReviewAssetKind[];
  readonly bodyAssetKind: Extract<AnalysisAssetKind, 'body'>;
  readonly structuredAssetKinds: readonly Exclude<AnalysisReviewAssetKind, 'body'>[];
  readonly sourceFields: readonly ['sourceModuleInstanceId', 'sourceModuleKey'];
  readonly authoritativeSourceField: 'sourceModuleInstanceId';
  readonly moduleKeySnapshotField: 'sourceModuleKey';
  readonly scopeField: 'scopeRef';
  readonly defaultScopeRelation: 'matches_source_module_instance_scope';
  readonly fineGrainedLocationFieldKinds: readonly [
    Extract<AnalysisStructuredFieldKind, 'evidence_anchor'>,
    Extract<AnalysisStructuredFieldKind, 'object_link'>,
  ];
  readonly statusField: 'reviewStatus';
  readonly structuredStatusFieldKind: Extract<AnalysisStructuredFieldKind, 'review_status'>;
  readonly evidencePolicyField: 'evidencePolicy';
  readonly editionFields: readonly ['sourceTextEdition', 'structureEdition'];
  readonly versionFields: readonly ['schemaVersion', 'revisionId'];
  readonly timestampFields: readonly ['createdAt', 'updatedAt'];
  readonly bodyCarriesStructuredFacts: false;
  readonly structuredAssetsRequireControls: true;
  readonly definesDeepPayloadSchema: false;
};

export const ANALYSIS_REVIEW_ASSET_CONTRACT = {
  ownerKind: 'analysis_module_instance',
  envelopeKind: 'review_asset',
  identityField: 'reviewAssetId',
  assetKinds: [
    'body',
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
    'ai_constraint',
  ],
  bodyAssetKind: 'body',
  structuredAssetKinds: [
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
    'ai_constraint',
  ],
  sourceFields: ['sourceModuleInstanceId', 'sourceModuleKey'],
  authoritativeSourceField: 'sourceModuleInstanceId',
  moduleKeySnapshotField: 'sourceModuleKey',
  scopeField: 'scopeRef',
  defaultScopeRelation: 'matches_source_module_instance_scope',
  fineGrainedLocationFieldKinds: ['evidence_anchor', 'object_link'],
  statusField: 'reviewStatus',
  structuredStatusFieldKind: 'review_status',
  evidencePolicyField: 'evidencePolicy',
  editionFields: ['sourceTextEdition', 'structureEdition'],
  versionFields: ['schemaVersion', 'revisionId'],
  timestampFields: ['createdAt', 'updatedAt'],
  bodyCarriesStructuredFacts: false,
  structuredAssetsRequireControls: true,
  definesDeepPayloadSchema: false,
} as const satisfies AnalysisReviewAssetContract;

export type AnalysisEvidenceAnchorRequirement = 'valid_evidence_anchor';

export type AnalysisReviewEvidenceGate =
  | 'uses_review_asset_evidence_policy'
  | 'not_required_for_transition';

export type AnalysisReviewTransitionRule = {
  readonly from: ReviewAssetStatus;
  readonly to: ReviewAssetStatus;
  readonly evidenceGate: AnalysisReviewEvidenceGate;
  readonly userAcceptanceMaySubstituteEvidence: false;
};

export type AnalysisReviewTransitionPolicy = {
  readonly statusField: 'reviewStatus';
  readonly structuredStatusFieldKind: Extract<AnalysisStructuredFieldKind, 'review_status'>;
  readonly initialStatus: Extract<ReviewAssetStatus, 'pending'>;
  readonly statuses: readonly ReviewAssetStatus[];
  readonly definesCompleteWorkflow: false;
  readonly allowedTransitions: readonly AnalysisReviewTransitionRule[];
};

export const ANALYSIS_REVIEW_TRANSITION_POLICY = {
  statusField: 'reviewStatus',
  structuredStatusFieldKind: 'review_status',
  initialStatus: 'pending',
  statuses: REVIEW_ASSET_STATUSES,
  definesCompleteWorkflow: false,
  allowedTransitions: [
    {
      from: 'pending',
      to: 'confirmed',
      evidenceGate: 'uses_review_asset_evidence_policy',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'needs_evidence',
      to: 'confirmed',
      evidenceGate: 'uses_review_asset_evidence_policy',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'needs_evidence',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'rejected',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'pending',
      to: 'excluded',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'confirmed',
      to: 'stale',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
    {
      from: 'stale',
      to: 'needs_evidence',
      evidenceGate: 'not_required_for_transition',
      userAcceptanceMaySubstituteEvidence: false,
    },
  ],
} as const satisfies AnalysisReviewTransitionPolicy;

export type AnalysisReviewConfirmationEvidencePolicy = {
  readonly statusField: 'reviewStatus';
  readonly evidencePolicyField: 'evidencePolicy';
  readonly confirmationStatus: Extract<ReviewAssetStatus, 'confirmed'>;
  readonly evidenceRequiredWhenPolicy: Extract<EvidencePolicy, 'required_for_confirmation'>;
  readonly evidenceNotRequiredPolicyValues: readonly Extract<
    EvidencePolicy,
    'not_required' | 'optional'
  >[];
  readonly requiredEvidenceAnchor: AnalysisEvidenceAnchorRequirement;
  readonly userAcceptanceMaySubstituteEvidence: false;
};

export const ANALYSIS_REVIEW_CONFIRMATION_EVIDENCE_POLICY = {
  statusField: 'reviewStatus',
  evidencePolicyField: 'evidencePolicy',
  confirmationStatus: 'confirmed',
  evidenceRequiredWhenPolicy: 'required_for_confirmation',
  evidenceNotRequiredPolicyValues: ['not_required', 'optional'],
  requiredEvidenceAnchor: 'valid_evidence_anchor',
  userAcceptanceMaySubstituteEvidence: false,
} as const satisfies AnalysisReviewConfirmationEvidencePolicy;

export type AnalysisCriticalConclusionEvidencePolicy = {
  readonly appliesTo: 'critical_conclusion';
  readonly confirmationStatus: Extract<ReviewAssetStatus, 'confirmed'>;
  readonly requiredEvidencePolicy: Extract<EvidencePolicy, 'required_for_confirmation'>;
  readonly requiredEvidenceAssetKind: Extract<AnalysisAssetKind, 'evidence_anchor'>;
  readonly requiredEvidenceAnchor: AnalysisEvidenceAnchorRequirement;
  readonly userAcceptanceMaySubstituteEvidence: false;
};

export const ANALYSIS_CRITICAL_CONCLUSION_EVIDENCE_POLICY = {
  appliesTo: 'critical_conclusion',
  confirmationStatus: 'confirmed',
  requiredEvidencePolicy: 'required_for_confirmation',
  requiredEvidenceAssetKind: 'evidence_anchor',
  requiredEvidenceAnchor: 'valid_evidence_anchor',
  userAcceptanceMaySubstituteEvidence: false,
} as const satisfies AnalysisCriticalConclusionEvidencePolicy;

export type AnalysisInsufficientEvidenceParticipationTarget =
  | 'technique_entry'
  | 'original_context';

export type AnalysisInsufficientEvidenceParticipationPolicy = {
  readonly insufficientEvidenceStatus: Extract<ReviewAssetStatus, 'needs_evidence'>;
  readonly blockedAssetKinds: readonly Extract<AnalysisAssetKind, 'reusable_technique_candidate'>[];
  readonly blockedTargets: readonly AnalysisInsufficientEvidenceParticipationTarget[];
  readonly mayCreateReusableTechniqueCandidate: false;
  readonly mayReferenceFromOriginalContext: false;
};

export const ANALYSIS_INSUFFICIENT_EVIDENCE_PARTICIPATION_POLICY = {
  insufficientEvidenceStatus: 'needs_evidence',
  blockedAssetKinds: ['reusable_technique_candidate'],
  blockedTargets: ['technique_entry', 'original_context'],
  mayCreateReusableTechniqueCandidate: false,
  mayReferenceFromOriginalContext: false,
} as const satisfies AnalysisInsufficientEvidenceParticipationPolicy;

export type AnalysisDependencyGateKind = 'frozen_structure';

export type AnalysisModuleDependencyEntry = {
  readonly moduleKey: AnalysisModuleKey;
  readonly requiredGateKinds: readonly AnalysisDependencyGateKind[];
  readonly inputModuleKeys: readonly AnalysisModuleKey[];
};

export const ANALYSIS_MODULE_DEPENDENCY_GRAPH = [
  {
    moduleKey: 'structure_and_segments',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: [],
  },
  {
    moduleKey: 'plot_causality',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments'],
  },
  {
    moduleKey: 'narrative_pacing',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'character_relations',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'world_rules',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'plot_causality'],
  },
  {
    moduleKey: 'style_expression',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: ['structure_and_segments', 'character_relations'],
  },
  {
    moduleKey: 'technique_principles',
    requiredGateKinds: ['frozen_structure'],
    inputModuleKeys: [
      'plot_causality',
      'narrative_pacing',
      'character_relations',
      'world_rules',
      'style_expression',
    ],
  },
] as const satisfies readonly AnalysisModuleDependencyEntry[];

export type AnalysisAiConstraintDependencyPolicy = {
  readonly assetKind: Extract<AnalysisAssetKind, 'ai_constraint'>;
  readonly requiresConfirmedSourceAssets: true;
  readonly mayReferencePendingAssets: false;
  readonly sourceAssetKinds: readonly Exclude<AnalysisAssetKind, 'body' | 'ai_constraint'>[];
};

export const ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY = {
  assetKind: 'ai_constraint',
  requiresConfirmedSourceAssets: true,
  mayReferencePendingAssets: false,
  sourceAssetKinds: [
    'structured_object',
    'evidence_anchor',
    'relation_link',
    'work_technique_observation',
    'reusable_technique_candidate',
  ],
} as const satisfies AnalysisAiConstraintDependencyPolicy;

export type AnalysisExportParticipationKind =
  | 'exportable'
  | 'exportable_with_status_notice_when_unreviewed';

export type AnalysisExportParticipationPolicy = {
  readonly bodyAssetKind: Extract<AnalysisAssetKind, 'body'>;
  readonly bodyParticipation: Extract<AnalysisExportParticipationKind, 'exportable'>;
  readonly bodyRequiresStatusNotice: false;
  readonly structuredAssetKinds: readonly Exclude<AnalysisReviewAssetKind, 'body'>[];
  readonly structuredAssetParticipation: Extract<
    AnalysisExportParticipationKind,
    'exportable_with_status_notice_when_unreviewed'
  >;
  readonly unreviewedStructuredAssetRequiresStatusNotice: true;
};

export const ANALYSIS_EXPORT_PARTICIPATION_POLICY = {
  bodyAssetKind: 'body',
  bodyParticipation: 'exportable',
  bodyRequiresStatusNotice: false,
  structuredAssetKinds: ANALYSIS_REVIEW_ASSET_CONTRACT.structuredAssetKinds,
  structuredAssetParticipation: 'exportable_with_status_notice_when_unreviewed',
  unreviewedStructuredAssetRequiresStatusNotice: true,
} as const satisfies AnalysisExportParticipationPolicy;

export type AnalysisCandidateTechniqueLibraryParticipationState = 'adopted_candidate';

export type AnalysisTechniqueLibraryParticipationPolicy = {
  readonly candidateAssetKind: Extract<AnalysisAssetKind, 'reusable_technique_candidate'>;
  readonly targetKind: 'technique_entry';
  readonly requiredCandidateState: AnalysisCandidateTechniqueLibraryParticipationState;
  readonly unadoptedCandidateMayCreateTechniqueEntry: false;
};

export const ANALYSIS_TECHNIQUE_LIBRARY_PARTICIPATION_POLICY = {
  candidateAssetKind: 'reusable_technique_candidate',
  targetKind: 'technique_entry',
  requiredCandidateState: 'adopted_candidate',
  unadoptedCandidateMayCreateTechniqueEntry: false,
} as const satisfies AnalysisTechniqueLibraryParticipationPolicy;

export type AnalysisOriginalContextParticipationPolicy = {
  readonly targetKind: 'original_context';
  readonly candidateAssetKind: Extract<AnalysisAssetKind, 'reusable_technique_candidate'>;
  readonly requiresAdoptedCandidate: true;
  readonly unconfirmedCandidateMayParticipate: false;
};

export const ANALYSIS_ORIGINAL_CONTEXT_PARTICIPATION_POLICY = {
  targetKind: 'original_context',
  candidateAssetKind: 'reusable_technique_candidate',
  requiresAdoptedCandidate: true,
  unconfirmedCandidateMayParticipate: false,
} as const satisfies AnalysisOriginalContextParticipationPolicy;

export type AnalysisAiConstraintParticipationPolicy = {
  readonly assetKind: Extract<AnalysisAssetKind, 'ai_constraint'>;
  readonly targetPageKey: Extract<AnalysisSecondarySystemPageKey, 'ai_constraint_summary'>;
  readonly requiresConfirmedSourceAssets: true;
  readonly mayReferencePendingAssets: false;
  readonly sourceAssetKinds: readonly Exclude<AnalysisAssetKind, 'body' | 'ai_constraint'>[];
};

export const ANALYSIS_AI_CONSTRAINT_PARTICIPATION_POLICY = {
  assetKind: 'ai_constraint',
  targetPageKey: 'ai_constraint_summary',
  requiresConfirmedSourceAssets: true,
  mayReferencePendingAssets: false,
  sourceAssetKinds: ANALYSIS_AI_CONSTRAINT_DEPENDENCY_POLICY.sourceAssetKinds,
} as const satisfies AnalysisAiConstraintParticipationPolicy;
