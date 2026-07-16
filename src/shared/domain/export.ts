import type { BreakdownBookId } from './ids';
import type { ModuleInstanceStatus } from './status';

export const EXPORT_TARGET_KINDS = [
  'markdown_package',
  'machine_package',
] as const;

export type ExportTargetKind = (typeof EXPORT_TARGET_KINDS)[number];

export const EXPORT_TARGET_AVAILABILITIES = [
  'blocked',
  'unavailable',
] as const;

export type ExportAvailability = (typeof EXPORT_TARGET_AVAILABILITIES)[number];

export type ExportTargetRuntimePolicyEntry = {
  readonly kind: ExportTargetKind;
  readonly availability: ExportAvailability;
};

export const EXPORT_TARGET_RUNTIME_POLICY = [
  {
    kind: 'markdown_package',
    availability: 'blocked',
  },
  {
    kind: 'machine_package',
    availability: 'unavailable',
  },
] as const satisfies readonly ExportTargetRuntimePolicyEntry[];

export const EXPORT_OWNER_KINDS = [
  'book',
  'structure',
  'analysis_modules',
  'review_assets',
  'evidence_anchors',
  'technique_assets',
  'perspective_views',
  'completion_gate',
] as const;

export type ExportOwnerKind = (typeof EXPORT_OWNER_KINDS)[number];

export const EXPORT_OWNER_AVAILABILITIES = [
  'available',
  'unavailable',
] as const;

export type ExportOwnerAvailability = (typeof EXPORT_OWNER_AVAILABILITIES)[number];

export const EXPORT_BLOCKER_CODES = [
  'export_execution_not_admitted',
  'structure_not_frozen',
  'analysis_module_not_generated',
  'analysis_module_pending_review',
  'analysis_module_stale',
  'analysis_module_needs_rebuild',
  'analysis_module_body_missing',
  'review_asset_unreviewed',
  'evidence_insufficient',
  'technique_candidate_not_adopted',
  'perspective_partial',
  'perspective_stale',
  'completion_gate_not_satisfied',
  'review_asset_owner_unavailable',
  'evidence_anchor_owner_unavailable',
  'technique_asset_owner_unavailable',
  'perspective_view_owner_unavailable',
  'completion_gate_owner_unavailable',
] as const;

export type ExportBlockerCode = (typeof EXPORT_BLOCKER_CODES)[number];

export type ExportBlockerCategory =
  | 'execution_gate'
  | 'admitted_fact'
  | 'future_fact'
  | 'owner_unavailable';

export type ExportBlockerDefinition = {
  readonly code: ExportBlockerCode;
  readonly category: ExportBlockerCategory;
  readonly runtimeEmittable: boolean;
};

export const EXPORT_BLOCKER_DEFINITIONS = [
  {
    code: 'export_execution_not_admitted',
    category: 'execution_gate',
    runtimeEmittable: true,
  },
  {
    code: 'structure_not_frozen',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'analysis_module_not_generated',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'analysis_module_pending_review',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'analysis_module_stale',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'analysis_module_needs_rebuild',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'analysis_module_body_missing',
    category: 'admitted_fact',
    runtimeEmittable: true,
  },
  {
    code: 'review_asset_unreviewed',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'evidence_insufficient',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'technique_candidate_not_adopted',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'perspective_partial',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'perspective_stale',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'completion_gate_not_satisfied',
    category: 'future_fact',
    runtimeEmittable: false,
  },
  {
    code: 'review_asset_owner_unavailable',
    category: 'owner_unavailable',
    runtimeEmittable: true,
  },
  {
    code: 'evidence_anchor_owner_unavailable',
    category: 'owner_unavailable',
    runtimeEmittable: true,
  },
  {
    code: 'technique_asset_owner_unavailable',
    category: 'owner_unavailable',
    runtimeEmittable: true,
  },
  {
    code: 'perspective_view_owner_unavailable',
    category: 'owner_unavailable',
    runtimeEmittable: true,
  },
  {
    code: 'completion_gate_owner_unavailable',
    category: 'owner_unavailable',
    runtimeEmittable: true,
  },
] as const satisfies readonly ExportBlockerDefinition[];

export const EXPORT_RUNTIME_BLOCKER_CODES = [
  'export_execution_not_admitted',
  'structure_not_frozen',
  'analysis_module_not_generated',
  'analysis_module_pending_review',
  'analysis_module_stale',
  'analysis_module_needs_rebuild',
  'analysis_module_body_missing',
  'review_asset_owner_unavailable',
  'evidence_anchor_owner_unavailable',
  'technique_asset_owner_unavailable',
  'perspective_view_owner_unavailable',
  'completion_gate_owner_unavailable',
] as const satisfies readonly ExportBlockerCode[];

export type ExportRuntimeBlockerCode = (typeof EXPORT_RUNTIME_BLOCKER_CODES)[number];

export type ExportOwnerUnavailableBlockerCode = Extract<
  ExportRuntimeBlockerCode,
  `${string}_owner_unavailable`
>;

export const EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES = [
  'review_asset_owner_unavailable',
  'evidence_anchor_owner_unavailable',
  'technique_asset_owner_unavailable',
  'perspective_view_owner_unavailable',
  'completion_gate_owner_unavailable',
] as const satisfies readonly ExportOwnerUnavailableBlockerCode[];

export type ExportOwnerParticipation =
  | {
      readonly ownerKind: ExportOwnerKind;
      readonly availability: Extract<ExportOwnerAvailability, 'available'>;
      readonly reason: null;
    }
  | {
      readonly ownerKind: ExportOwnerKind;
      readonly availability: Extract<ExportOwnerAvailability, 'unavailable'>;
      readonly reason: ExportOwnerUnavailableBlockerCode;
    };

export const EXPORT_OWNER_RUNTIME_POLICY = [
  {
    ownerKind: 'book',
    availability: 'available',
    reason: null,
  },
  {
    ownerKind: 'structure',
    availability: 'available',
    reason: null,
  },
  {
    ownerKind: 'analysis_modules',
    availability: 'available',
    reason: null,
  },
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
] as const satisfies readonly ExportOwnerParticipation[];

export const EXPORT_EXCLUDED_CONTENT_KINDS = [
  'credentials',
  'authentication_tokens',
  'secret_keys',
  'secure_storage',
  'full_sensitive_logs',
] as const;

export type ExportExcludedContentKind = (typeof EXPORT_EXCLUDED_CONTENT_KINDS)[number];

export type ExportExcludedContentPolicyEntry = {
  readonly kind: ExportExcludedContentKind;
  readonly access: 'never_read';
  readonly dtoParticipation: 'exclusion_marker_only';
};

export const EXPORT_EXCLUDED_CONTENT_POLICY = [
  {
    kind: 'credentials',
    access: 'never_read',
    dtoParticipation: 'exclusion_marker_only',
  },
  {
    kind: 'authentication_tokens',
    access: 'never_read',
    dtoParticipation: 'exclusion_marker_only',
  },
  {
    kind: 'secret_keys',
    access: 'never_read',
    dtoParticipation: 'exclusion_marker_only',
  },
  {
    kind: 'secure_storage',
    access: 'never_read',
    dtoParticipation: 'exclusion_marker_only',
  },
  {
    kind: 'full_sensitive_logs',
    access: 'never_read',
    dtoParticipation: 'exclusion_marker_only',
  },
] as const satisfies readonly ExportExcludedContentPolicyEntry[];

export type ExportStructurePreview =
  | {
      readonly status: 'frozen';
      readonly structureEdition: number;
    }
  | {
      readonly status: 'not_frozen';
      readonly structureEdition: null;
    };

export type ExportModuleStatusCounts = Readonly<Record<ModuleInstanceStatus, number>>;

export type ExportTargetPreview = {
  readonly structure: ExportStructurePreview;
  readonly moduleInstances: {
    readonly expectedCount: number;
    readonly actualCount: number;
    readonly nonEmptyBodyCount: number;
    readonly statusCounts: ExportModuleStatusCounts;
  };
};

export function deriveExportRuntimeBlockers(
  preview: ExportTargetPreview,
): ExportRuntimeBlockerCode[] {
  const blockers = new Set<ExportRuntimeBlockerCode>([
    'export_execution_not_admitted',
  ]);
  for (const owner of EXPORT_OWNER_RUNTIME_POLICY) {
    if (owner.availability === 'unavailable') blockers.add(owner.reason);
  }

  if (preview.structure.status === 'not_frozen') {
    blockers.add('structure_not_frozen');
  } else {
    if (preview.moduleInstances.statusCounts.not_generated > 0) {
      blockers.add('analysis_module_not_generated');
    }
    if (preview.moduleInstances.statusCounts.generated_pending_review > 0) {
      blockers.add('analysis_module_pending_review');
    }
    if (preview.moduleInstances.statusCounts.stale > 0) {
      blockers.add('analysis_module_stale');
    }
    if (preview.moduleInstances.statusCounts.needs_rebuild > 0) {
      blockers.add('analysis_module_needs_rebuild');
    }
    if (
      preview.moduleInstances.nonEmptyBodyCount <
      preview.moduleInstances.actualCount
    ) {
      blockers.add('analysis_module_body_missing');
    }
  }

  return EXPORT_RUNTIME_BLOCKER_CODES.filter((blocker) => blockers.has(blocker));
}

export type ExportTargetStatus = {
  readonly kind: ExportTargetKind;
  readonly availability: ExportAvailability;
  readonly blockers: readonly ExportRuntimeBlockerCode[];
  readonly preview: ExportTargetPreview;
};

export type ExportStatus = {
  readonly bookId: BreakdownBookId;
  readonly targets: readonly ExportTargetStatus[];
  readonly owners: readonly ExportOwnerParticipation[];
  readonly excludedContent: readonly ExportExcludedContentKind[];
};
