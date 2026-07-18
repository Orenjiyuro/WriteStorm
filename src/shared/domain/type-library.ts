import { z } from 'zod';
import { ANALYSIS_MODULE_KEYS } from './analysis';
import type {
  AnalysisConfigurationSnapshotId,
  BreakdownBookId,
  MethodologyVersionId,
  PromptTemplateRegistryEntryId,
  PromptTemplateVersionId,
  TypeDefinitionId,
  TypeDefinitionVersionId,
} from './ids';

const idSchema = <T extends string>() => z.string().min(1).transform((value) => value as T);
const nonBlankTextSchema = z.string().trim().min(1);
const positiveVersionSchema = z.number().int().positive();
const timestampSchema = z.iso.datetime({ offset: true });

function isStrictlyLaterInstant(candidate: string, baseline: string): boolean {
  return Date.parse(candidate) > Date.parse(baseline);
}

function isSameOrLaterInstant(candidate: string, baseline: string): boolean {
  return Date.parse(candidate) >= Date.parse(baseline);
}

export const TYPE_DEFINITION_KINDS = ['main_type', 'content_focus'] as const;
export type TypeDefinitionKind = (typeof TYPE_DEFINITION_KINDS)[number];

export const TYPE_DEFINITION_ORIGINS = ['built_in', 'user_defined'] as const;
export type TypeDefinitionOrigin = (typeof TYPE_DEFINITION_ORIGINS)[number];

export const BUILT_IN_TYPE_OPTION_CONFIRMATION_STATUSES = [
  'proposed',
  'confirmed',
  'deferred',
] as const;
export type BuiltInTypeOptionConfirmationStatus =
  (typeof BUILT_IN_TYPE_OPTION_CONFIRMATION_STATUSES)[number];

export const TYPE_SELECTION_POLICY = {
  selectionAuthority: 'user_only',
  automaticClassification: false,
  inferFromSourceText: false,
  methodologyOwner: 'block_14',
  runtimeValidationOwner: 'block_17',
} as const;

export const CONTENT_FOCUS_BINDING_LIMIT = 3;

export const PROMPT_TEMPLATE_ROLES = ['base', 'overlay'] as const;
export type PromptTemplateRole = (typeof PROMPT_TEMPLATE_ROLES)[number];

export const PROMPT_SAMPLE_GATE_STATUSES = ['not_run', 'blocked', 'failed', 'passed'] as const;
export type PromptSampleGateStatus = (typeof PROMPT_SAMPLE_GATE_STATUSES)[number];

export const PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES = [
  'codex_sdk_gate_required',
  'prompt_template_instance_unavailable',
  'sample_preview_runtime_not_admitted',
] as const;
export type PromptSamplePreviewBlockerCode =
  (typeof PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES)[number];

export const PROMPT_SAMPLE_PREVIEW_POLICY = {
  status: 'blocked',
  blockerCodes: PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES,
  publicationRequiresPassedSample: true,
  realPreviewExecution: false,
  codexSdkCall: false,
  providerCall: false,
  runtimeOwner: 'block_17',
} as const;

export const PROMPT_PUBLICATION_ACTIONS = ['publish', 'rollback', 'disable'] as const;
export type PromptPublicationAction = (typeof PROMPT_PUBLICATION_ACTIONS)[number];

export const PROMPT_PUBLICATION_BLOCKER_CODES = [
  'draft_version_required',
  'sample_preview_not_passed',
  'draft_version_not_newer',
  'published_version_required',
  'rollback_target_required',
  'rollback_target_must_differ',
  'rollback_target_not_published',
  'rollback_target_not_earlier',
  'registry_not_enabled',
  'prompt_template_persistence_not_admitted',
] as const;
export type PromptPublicationBlockerCode = (typeof PROMPT_PUBLICATION_BLOCKER_CODES)[number];

export const PROMPT_ACTIVATION_STATUSES = ['enabled', 'disabled'] as const;
export type PromptActivationStatus = (typeof PROMPT_ACTIVATION_STATUSES)[number];

export const PROMPT_TEMPLATE_REGISTRY_SHELL_POLICY = {
  persistence: 'not_admitted',
  productionSeed: 'not_admitted',
  rendererEntryOwner: 'task_12_13',
  samplePreviewOwner: 'task_12_10',
  publicationStateMachineOwner: 'task_12_11',
  methodologyOwner: 'block_14',
  runtimeOwner: 'block_17',
} as const;

export const ANALYSIS_READINESS_TITLE = '方法论尚未就绪，不能开始正式分析';

export const ANALYSIS_READINESS_BLOCKER_CODES = [
  'missing_main_type',
  'type_definition_version_unavailable',
  'methodology_not_ready',
  'prompt_not_ready',
  'schema_not_ready',
  'composition_conflict',
] as const;
export type AnalysisReadinessBlockerCode = (typeof ANALYSIS_READINESS_BLOCKER_CODES)[number];

export const TYPE_LIBRARY_CLASSIFICATION_UPDATE_POLICY = {
  usesExpectedRevisionCas: true,
  updatesCurrentBookTargetOnly: true,
  rewritesExistingAnalysisConfigurationSnapshots: false,
  rewritesHistoricalAnalysisResults: false,
  logicUpgradeCreatesNewAnalysisConfigurationSnapshot: true,
  logicUpgradeRequiresImpactPlan: true,
  selectiveRebuildTargetsAffectedModulesOnly: true,
  completeRerunRequiresExplicitConfirmation: true,
} as const;

export const ANALYSIS_CONFIGURATION_SNAPSHOT_POLICY = {
  bookSummaryCarriesSnapshot: false,
  bookMetadataDetailCarriesLatestSnapshot: true,
  snapshotsAreImmutable: true,
  upgradesCreateNewSnapshot: true,
  upgradesRequireImpactPlan: true,
  impactPlanDerivation: 'analysis_configuration_snapshot_diff_v1',
  callerDeclaredAffectedModulesAllowed: false,
  selectiveRebuildOnly: true,
  completeRerunRequiresExplicitConfirmation: true,
  persistence: 'not_admitted',
} as const;

export const builtInTypeOptionProposalSchema = z.object({
  proposalId: nonBlankTextSchema,
  kind: z.enum(TYPE_DEFINITION_KINDS),
  displayName: nonBlankTextSchema,
  ownerKind: z.literal('source_controlled_admission_asset'),
  confirmationStatus: z.enum(BUILT_IN_TYPE_OPTION_CONFIRMATION_STATUSES),
  selectionDescription: nonBlankTextSchema.nullable(),
  stableKey: z.string().regex(/^[a-z][a-z0-9_]*$/).nullable(),
  selectionAuthority: z.literal('user_only'),
  automaticClassification: z.literal(false),
  methodologyOwner: z.literal('block_14'),
}).strict().superRefine((proposal, context) => {
  if (proposal.confirmationStatus === 'confirmed') {
    if (proposal.selectionDescription === null) {
      context.addIssue({
        code: 'custom',
        path: ['selectionDescription'],
        message: 'Confirmed built-in options require a user-facing selection description.',
      });
    }
  } else if (proposal.stableKey !== null) {
    context.addIssue({
      code: 'custom',
      path: ['stableKey'],
      message: 'Unconfirmed built-in options have no stable key.',
    });
  }
});

export type BuiltInTypeOptionProposal = z.infer<typeof builtInTypeOptionProposalSchema>;

export const typeDefinitionSchema = z.object({
  id: idSchema<TypeDefinitionId>(),
  kind: z.enum(TYPE_DEFINITION_KINDS),
  origin: z.enum(TYPE_DEFINITION_ORIGINS),
  stableKey: z.string().regex(/^[a-z][a-z0-9_]*$/).nullable(),
}).strict().superRefine((definition, context) => {
  if (definition.origin === 'built_in' && definition.stableKey === null) {
    context.addIssue({ code: 'custom', path: ['stableKey'], message: 'Built-in definitions require a stable key.' });
  }
  if (definition.origin === 'user_defined' && definition.stableKey !== null) {
    context.addIssue({ code: 'custom', path: ['stableKey'], message: 'User definitions cannot claim built-in keys.' });
  }
});

export type TypeDefinition = z.infer<typeof typeDefinitionSchema>;

export const typeDefinitionVersionSchema = z.object({
  id: idSchema<TypeDefinitionVersionId>(),
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  version: positiveVersionSchema,
  displayName: nonBlankTextSchema,
  selectionDescription: nonBlankTextSchema,
  createdAt: timestampSchema,
}).strict();

export type TypeDefinitionVersion = z.infer<typeof typeDefinitionVersionSchema>;

export const methodologyVersionSchema = z.object({
  id: idSchema<MethodologyVersionId>(),
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  version: positiveVersionSchema,
  role: z.enum(PROMPT_TEMPLATE_ROLES),
  schemaVersion: positiveVersionSchema,
  createdAt: timestampSchema,
}).strict();

export type MethodologyVersion = z.infer<typeof methodologyVersionSchema>;

export const promptTemplateRegistryEntrySchema = z.object({
  id: idSchema<PromptTemplateRegistryEntryId>(),
  registryKey: z.string().regex(/^[a-z][a-z0-9_.-]*$/),
  moduleKey: z.enum(ANALYSIS_MODULE_KEYS),
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  role: z.enum(PROMPT_TEMPLATE_ROLES),
  publishedVersionId: idSchema<PromptTemplateVersionId>().nullable(),
  activationStatus: z.enum(PROMPT_ACTIVATION_STATUSES),
}).strict();

export type PromptTemplateRegistryEntry = z.infer<typeof promptTemplateRegistryEntrySchema>;

export const promptTemplateVersionSchema = z.object({
  id: idSchema<PromptTemplateVersionId>(),
  registryEntryId: idSchema<PromptTemplateRegistryEntryId>(),
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  methodologyVersionId: idSchema<MethodologyVersionId>(),
  templateVersion: positiveVersionSchema,
  role: z.enum(PROMPT_TEMPLATE_ROLES),
  schemaVersion: positiveVersionSchema,
  sampleGateStatus: z.enum(PROMPT_SAMPLE_GATE_STATUSES),
  publishedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
}).strict().superRefine((version, context) => {
  if (version.publishedAt !== null && version.sampleGateStatus !== 'passed') {
    context.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Published template versions require a passed sample gate.',
    });
  }
  if (version.publishedAt !== null && !isSameOrLaterInstant(
    version.publishedAt,
    version.createdAt,
  )) {
    context.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Published template versions cannot predate creation.',
    });
  }
});

export type PromptTemplateVersion = z.infer<typeof promptTemplateVersionSchema>;

export type PromptTemplateVersionLifecycle = 'draft' | 'published';

export function getPromptTemplateVersionLifecycle(
  version: PromptTemplateVersion,
): PromptTemplateVersionLifecycle {
  return version.publishedAt === null ? 'draft' : 'published';
}

export const promptTemplateRegistryAggregateSchema = z.object({
  entry: promptTemplateRegistryEntrySchema,
  versions: z.array(promptTemplateVersionSchema),
  typeDefinitionVersions: z.array(typeDefinitionVersionSchema),
  methodologyVersions: z.array(methodologyVersionSchema),
}).strict().superRefine((aggregate, context) => {
  const versionIds = new Set<string>();
  const templateVersions = new Set<number>();
  const typeDefinitionVersions = new Map<string, TypeDefinitionVersion>();
  const methodologyVersions = new Map<string, MethodologyVersion>();

  aggregate.typeDefinitionVersions.forEach((version, index) => {
    if (typeDefinitionVersions.has(version.id)) {
      context.addIssue({
        code: 'custom',
        path: ['typeDefinitionVersions', index, 'id'],
        message: 'TypeDefinitionVersion provenance identities must be unique.',
      });
    }
    if (version.typeDefinitionId !== aggregate.entry.typeDefinitionId) {
      context.addIssue({
        code: 'custom',
        path: ['typeDefinitionVersions', index, 'typeDefinitionId'],
        message: 'TypeDefinitionVersion provenance must belong to the registry definition.',
      });
    }
    typeDefinitionVersions.set(version.id, version);
  });

  aggregate.methodologyVersions.forEach((version, index) => {
    if (methodologyVersions.has(version.id)) {
      context.addIssue({
        code: 'custom',
        path: ['methodologyVersions', index, 'id'],
        message: 'MethodologyVersion provenance identities must be unique.',
      });
    }
    if (version.typeDefinitionId !== aggregate.entry.typeDefinitionId) {
      context.addIssue({
        code: 'custom',
        path: ['methodologyVersions', index, 'typeDefinitionId'],
        message: 'MethodologyVersion provenance must belong to the registry definition.',
      });
    }
    if (version.role !== aggregate.entry.role) {
      context.addIssue({
        code: 'custom',
        path: ['methodologyVersions', index, 'role'],
        message: 'MethodologyVersion provenance role must match the registry identity.',
      });
    }
    const typeDefinitionVersion = typeDefinitionVersions.get(version.typeDefinitionVersionId);
    if (typeDefinitionVersion === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['methodologyVersions', index, 'typeDefinitionVersionId'],
        message: 'MethodologyVersion provenance must resolve its TypeDefinitionVersion.',
      });
    }
    methodologyVersions.set(version.id, version);
  });

  aggregate.versions.forEach((version, index) => {
    if (version.registryEntryId !== aggregate.entry.id) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'registryEntryId'],
        message: 'Template versions must belong to the registry entry.',
      });
    }
    if (version.role !== aggregate.entry.role) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'role'],
        message: 'Template version role must match the registry identity.',
      });
    }
    const typeDefinitionVersion = typeDefinitionVersions.get(version.typeDefinitionVersionId);
    if (typeDefinitionVersion === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'typeDefinitionVersionId'],
        message: 'Template versions must resolve their TypeDefinitionVersion provenance.',
      });
    }
    const methodologyVersion = methodologyVersions.get(version.methodologyVersionId);
    if (methodologyVersion === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'methodologyVersionId'],
        message: 'Template versions must resolve their MethodologyVersion provenance.',
      });
    } else if (methodologyVersion.typeDefinitionVersionId !== version.typeDefinitionVersionId) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'methodologyVersionId'],
        message: 'Template MethodologyVersion must belong to its pinned TypeDefinitionVersion.',
      });
    }
    if (versionIds.has(version.id)) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'id'],
        message: 'Template version identities must be unique.',
      });
    }
    if (templateVersions.has(version.templateVersion)) {
      context.addIssue({
        code: 'custom',
        path: ['versions', index, 'templateVersion'],
        message: 'Template version numbers must be unique within a registry entry.',
      });
    }
    versionIds.add(version.id);
    templateVersions.add(version.templateVersion);
  });

  const currentPublished = aggregate.entry.publishedVersionId === null
    ? null
    : aggregate.versions.find((version) => version.id === aggregate.entry.publishedVersionId) ?? null;
  if (aggregate.entry.publishedVersionId !== null && currentPublished === null) {
    context.addIssue({
      code: 'custom',
      path: ['entry', 'publishedVersionId'],
      message: 'Published version pointers must resolve within the registry entry.',
    });
  } else if (currentPublished !== null && getPromptTemplateVersionLifecycle(currentPublished) !== 'published') {
    context.addIssue({
      code: 'custom',
      path: ['entry', 'publishedVersionId'],
      message: 'Published version pointers cannot target a draft.',
    });
  }

  const hasPublishedHistory = aggregate.versions.some(
    (version) => getPromptTemplateVersionLifecycle(version) === 'published',
  );
  if (hasPublishedHistory && aggregate.entry.publishedVersionId === null) {
    context.addIssue({
      code: 'custom',
      path: ['entry', 'publishedVersionId'],
      message: 'A registry with published history must retain a current published pointer.',
    });
  }
  if (aggregate.entry.activationStatus === 'enabled' && aggregate.entry.publishedVersionId === null) {
    context.addIssue({
      code: 'custom',
      path: ['entry', 'activationStatus'],
      message: 'An enabled registry entry requires a current published version.',
    });
  }
});

export type PromptTemplateRegistryAggregate = z.infer<typeof promptTemplateRegistryAggregateSchema>;

const editedPromptTemplateDraftRequestSchema = z.object({
  current: promptTemplateVersionSchema,
  next: z.object({
    id: idSchema<PromptTemplateVersionId>(),
    createdAt: timestampSchema,
  }).strict(),
}).strict().superRefine((request, context) => {
  if (request.next.id === request.current.id) {
    context.addIssue({
      code: 'custom',
      path: ['next', 'id'],
      message: 'Edited PromptTemplate drafts require a new version identity.',
    });
  }
  if (!isSameOrLaterInstant(request.next.createdAt, request.current.createdAt)) {
    context.addIssue({
      code: 'custom',
      path: ['next', 'createdAt'],
      message: 'Edited PromptTemplate draft createdAt must not predate the current version.',
    });
  }
});

export function createEditedPromptTemplateDraft(
  current: PromptTemplateVersion,
  next: {
    readonly id: PromptTemplateVersionId;
    readonly createdAt: string;
  },
): PromptTemplateVersion {
  const request = editedPromptTemplateDraftRequestSchema.parse({ current, next });

  return promptTemplateVersionSchema.parse({
    ...request.current,
    id: request.next.id,
    templateVersion: request.current.templateVersion + 1,
    sampleGateStatus: 'not_run',
    publishedAt: null,
    createdAt: request.next.createdAt,
  });
}

export const promptPublicationShellStateSchema = z.object({
  aggregate: promptTemplateRegistryAggregateSchema.nullable(),
  draftVersionId: idSchema<PromptTemplateVersionId>().nullable(),
  rollbackTargetVersionId: idSchema<PromptTemplateVersionId>().nullable(),
  persistenceAdmitted: z.boolean(),
}).strict().superRefine((state, context) => {
  if (state.aggregate === null && state.draftVersionId !== null) {
    context.addIssue({
      code: 'custom',
      path: ['draftVersionId'],
      message: 'A draft selection requires a validated registry aggregate.',
    });
  }
  if (state.aggregate === null && state.rollbackTargetVersionId !== null) {
    context.addIssue({
      code: 'custom',
      path: ['rollbackTargetVersionId'],
      message: 'A rollback selection requires a validated registry aggregate.',
    });
  }
  if (state.persistenceAdmitted && state.aggregate === null) {
    context.addIssue({
      code: 'custom',
      path: ['aggregate'],
      message: 'An admitted persistence transition requires a validated registry aggregate.',
    });
  }
});

export type PromptPublicationShellState = z.infer<typeof promptPublicationShellStateSchema>;

export interface PromptPublicationPermission {
  readonly action: PromptPublicationAction;
  readonly allowed: boolean;
  readonly blockerCodes: readonly PromptPublicationBlockerCode[];
}

export const PROMPT_PUBLICATION_CURRENT_SHELL_STATE = promptPublicationShellStateSchema.parse({
  aggregate: null,
  draftVersionId: null,
  rollbackTargetVersionId: null,
  persistenceAdmitted: false,
});

export function evaluatePromptPublicationPermission(
  state: PromptPublicationShellState,
  action: PromptPublicationAction,
): PromptPublicationPermission {
  const blockers: PromptPublicationBlockerCode[] = [];
  const draftVersion = state.aggregate?.versions.find(
    (version) => version.id === state.draftVersionId,
  ) ?? null;
  const publishedVersionId = state.aggregate?.entry.publishedVersionId ?? null;
  const rollbackTarget = state.aggregate?.versions.find(
    (version) => version.id === state.rollbackTargetVersionId,
  ) ?? null;
  const publishedVersion = state.aggregate?.versions.find(
    (version) => version.id === publishedVersionId,
  ) ?? null;

  if (action === 'publish') {
    if (draftVersion === null || getPromptTemplateVersionLifecycle(draftVersion) !== 'draft') {
      blockers.push('draft_version_required');
    }
    if (draftVersion?.sampleGateStatus !== 'passed') blockers.push('sample_preview_not_passed');
    if (
      draftVersion !== null
      && publishedVersion !== null
      && draftVersion.templateVersion <= publishedVersion.templateVersion
    ) {
      blockers.push('draft_version_not_newer');
    }
  }
  if (action === 'rollback') {
    if (publishedVersionId === null) blockers.push('published_version_required');
    if (state.rollbackTargetVersionId === null) blockers.push('rollback_target_required');
    if (
      state.rollbackTargetVersionId !== null
      && state.rollbackTargetVersionId === publishedVersionId
    ) {
      blockers.push('rollback_target_must_differ');
    }
    if (
      state.rollbackTargetVersionId !== null
      && (rollbackTarget === null || getPromptTemplateVersionLifecycle(rollbackTarget) !== 'published')
    ) {
      blockers.push('rollback_target_not_published');
    }
    if (
      rollbackTarget !== null
      && publishedVersion !== null
      && rollbackTarget.id !== publishedVersion.id
      && getPromptTemplateVersionLifecycle(rollbackTarget) === 'published'
      && rollbackTarget.templateVersion >= publishedVersion.templateVersion
    ) {
      blockers.push('rollback_target_not_earlier');
    }
  }
  if (action === 'disable' && state.aggregate?.entry.activationStatus !== 'enabled') {
    blockers.push('registry_not_enabled');
  }
  if (!state.persistenceAdmitted) {
    blockers.push('prompt_template_persistence_not_admitted');
  }

  return {
    action,
    allowed: blockers.length === 0,
    blockerCodes: blockers,
  };
}

export type PromptPublicationTransitionPreview = {
  readonly applied: boolean;
  readonly state: PromptPublicationShellState;
  readonly permission: PromptPublicationPermission;
};

export type PromptPublicationTransitionRequest =
  | {
    readonly action: 'publish';
    readonly publishedAt: string;
  }
  | { readonly action: 'rollback' }
  | { readonly action: 'disable' };

export function previewPromptPublicationTransition(
  state: PromptPublicationShellState,
  request: PromptPublicationTransitionRequest,
): PromptPublicationTransitionPreview {
  const permission = evaluatePromptPublicationPermission(state, request.action);
  if (!permission.allowed) {
    return { applied: false, state, permission };
  }

  if (state.aggregate === null) {
    return { applied: false, state, permission };
  }
  const aggregate = state.aggregate;
  if (request.action === 'publish') {
    const previousPublishedVersionId = aggregate.entry.publishedVersionId;
    const selectedDraft = aggregate.versions.find((version) => version.id === state.draftVersionId);
    if (selectedDraft === undefined) {
      return { applied: false, state, permission };
    }
    const publishedDraft = promptTemplateVersionSchema.parse({
      ...selectedDraft,
      publishedAt: request.publishedAt,
    });
    const currentPublished = previousPublishedVersionId === null
      ? null
      : aggregate.versions.find((version) => version.id === previousPublishedVersionId) ?? null;
    if (
      currentPublished !== null
      && currentPublished.publishedAt !== null
      && !isSameOrLaterInstant(publishedDraft.publishedAt!, currentPublished.publishedAt)
    ) {
      throw new Error('New publication fact cannot predate the current publication fact.');
    }
    const versions = aggregate.versions.map((version) => version.id === state.draftVersionId
      ? publishedDraft
      : version);
    const nextAggregate = promptTemplateRegistryAggregateSchema.parse({
      ...aggregate,
      entry: {
        ...aggregate.entry,
        publishedVersionId: state.draftVersionId,
      },
      versions,
    });
    return {
      applied: true,
      permission,
      state: promptPublicationShellStateSchema.parse({
        ...state,
        aggregate: nextAggregate,
        draftVersionId: null,
        rollbackTargetVersionId: previousPublishedVersionId,
      }),
    };
  }
  if (request.action === 'rollback') {
    const nextAggregate = promptTemplateRegistryAggregateSchema.parse({
      ...aggregate,
      entry: {
        ...aggregate.entry,
        publishedVersionId: state.rollbackTargetVersionId,
      },
      versions: aggregate.versions,
    });
    return {
      applied: true,
      permission,
      state: promptPublicationShellStateSchema.parse({
        ...state,
        aggregate: nextAggregate,
        rollbackTargetVersionId: null,
      }),
    };
  }
  const nextAggregate = promptTemplateRegistryAggregateSchema.parse({
    ...aggregate,
    entry: {
      ...aggregate.entry,
      activationStatus: 'disabled',
    },
    versions: aggregate.versions,
  });
  return {
    applied: true,
    permission,
    state: promptPublicationShellStateSchema.parse({
      ...state,
      aggregate: nextAggregate,
    }),
  };
}

export const typeDefinitionVersionReferenceSchema = z.object({
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
}).strict();

export type TypeDefinitionVersionReference = z.infer<typeof typeDefinitionVersionReferenceSchema>;

export const typeLibraryVersionEntrySchema = z.object({
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  kind: z.enum(TYPE_DEFINITION_KINDS),
  sortOrder: z.number().int().nonnegative(),
}).strict();

export type TypeLibraryVersionEntry = z.infer<typeof typeLibraryVersionEntrySchema>;

export const typeLibraryVersionSchema = z.object({
  version: positiveVersionSchema,
  entries: z.array(typeLibraryVersionEntrySchema).min(1),
  createdAt: timestampSchema,
}).strict().superRefine((release, context) => {
  const definitionIds = new Set<string>();
  const definitionVersionIds = new Set<string>();

  release.entries.forEach((entry, index) => {
    if (definitionIds.has(entry.typeDefinitionId)) {
      context.addIssue({ code: 'custom', path: ['entries', index], message: 'Definition identities must be unique.' });
    }
    if (definitionVersionIds.has(entry.typeDefinitionVersionId)) {
      context.addIssue({ code: 'custom', path: ['entries', index], message: 'Definition versions must be unique.' });
    }
    definitionIds.add(entry.typeDefinitionId);
    definitionVersionIds.add(entry.typeDefinitionVersionId);
  });

  for (const kind of TYPE_DEFINITION_KINDS) {
    const entries = release.entries.filter((entry) => entry.kind === kind);
    entries.forEach((entry, index) => {
      if (entry.sortOrder !== index) {
        context.addIssue({
          code: 'custom',
          path: ['entries'],
          message: `${kind} sort orders must be contiguous from zero.`,
        });
      }
    });
  }
});

export type TypeLibraryVersion = z.infer<typeof typeLibraryVersionSchema>;

export const typeLibraryOptionSchema = z.object({
  typeDefinitionId: idSchema<TypeDefinitionId>(),
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  kind: z.enum(TYPE_DEFINITION_KINDS),
  origin: z.enum(TYPE_DEFINITION_ORIGINS),
  stableKey: z.string().regex(/^[a-z][a-z0-9_]*$/).nullable(),
  displayName: nonBlankTextSchema,
  selectionDescription: nonBlankTextSchema,
  sortOrder: z.number().int().nonnegative(),
}).strict();

export type TypeLibraryOption = z.infer<typeof typeLibraryOptionSchema>;

export const typeLibraryPinnedOptionSchema = typeLibraryOptionSchema
  .omit({ sortOrder: true })
  .extend({
    availability: z.enum(['current_selectable', 'archived']),
  }).strict();

export type TypeLibraryPinnedOption = z.infer<typeof typeLibraryPinnedOptionSchema>;

export const typeLibraryReleaseOptionsSchema = z.object({
  version: positiveVersionSchema,
  options: z.array(typeLibraryOptionSchema),
}).strict().superRefine((release, context) => {
  const definitionIds = new Set<string>();
  const definitionVersionIds = new Set<string>();
  let contentFocusStarted = false;

  release.options.forEach((option, index) => {
    if (definitionIds.has(option.typeDefinitionId) ||
      definitionVersionIds.has(option.typeDefinitionVersionId)) {
      context.addIssue({ code: 'custom', path: ['options', index], message: 'Release options must be unique.' });
    }
    definitionIds.add(option.typeDefinitionId);
    definitionVersionIds.add(option.typeDefinitionVersionId);
    if (option.kind === 'content_focus') contentFocusStarted = true;
    if (contentFocusStarted && option.kind === 'main_type') {
      context.addIssue({ code: 'custom', path: ['options', index], message: 'MainType options must precede ContentFocus options.' });
    }
  });

  for (const kind of TYPE_DEFINITION_KINDS) {
    release.options.filter((option) => option.kind === kind).forEach((option, index) => {
      if (option.sortOrder !== index) {
        context.addIssue({ code: 'custom', path: ['options'], message: `${kind} sort orders must be contiguous from zero.` });
      }
    });
  }
});

export type TypeLibraryReleaseOptions = z.infer<typeof typeLibraryReleaseOptionsSchema>;

const contentFocusReferenceSchema = typeDefinitionVersionReferenceSchema.extend({
  priority: z.number().int().min(1).max(CONTENT_FOCUS_BINDING_LIMIT),
}).strict();

export type ContentFocusVersionReference = z.infer<typeof contentFocusReferenceSchema>;

function validateOrderedReferences(
  references: readonly { readonly priority: number; readonly typeDefinitionId?: string;
    readonly typeDefinitionVersionId: string }[],
  context: z.RefinementCtx,
): void {
  const identities = new Set<string>();
  references.forEach((reference, index) => {
    if (reference.priority !== index + 1) {
      context.addIssue({ code: 'custom', path: [index, 'priority'], message: 'Priorities must be contiguous.' });
    }
    const identity = reference.typeDefinitionId ?? reference.typeDefinitionVersionId;
    if (identities.has(identity)) {
      context.addIssue({ code: 'custom', path: [index], message: 'Ordered references must be unique.' });
    }
    identities.add(identity);
  });
}

const orderedContentFocusReferencesSchema = z.array(contentFocusReferenceSchema)
  .max(CONTENT_FOCUS_BINDING_LIMIT)
  .superRefine(validateOrderedReferences);

export const bookTypeBindingReadSchema = z.object({
  bookId: idSchema<BreakdownBookId>(),
  typeLibraryVersion: positiveVersionSchema,
  revision: z.number().int().nonnegative(),
  mainType: typeDefinitionVersionReferenceSchema.nullable(),
  contentFocuses: orderedContentFocusReferencesSchema,
  updatedAt: timestampSchema.nullable(),
}).strict().superRefine((binding, context) => {
  if (binding.revision === 0) {
    if (binding.mainType !== null || binding.contentFocuses.length > 0 || binding.updatedAt !== null) {
      context.addIssue({ code: 'custom', path: ['revision'], message: 'Revision zero represents an absent binding only.' });
    }
  } else if (binding.updatedAt === null) {
    context.addIssue({ code: 'custom', path: ['updatedAt'], message: 'Persisted bindings require an update timestamp.' });
  }
});

export type BookTypeBindingRead = z.infer<typeof bookTypeBindingReadSchema>;

export const bookTypeBindingDetailSchema = z.object({
  binding: bookTypeBindingReadSchema,
  pinnedOptions: z.array(typeLibraryPinnedOptionSchema)
    .max(CONTENT_FOCUS_BINDING_LIMIT + 1),
}).strict().superRefine((detail, context) => {
  const expected = [
    ...(detail.binding.mainType ? [{
      ...detail.binding.mainType,
      kind: 'main_type' as const,
    }] : []),
    ...detail.binding.contentFocuses.map((focus) => ({
      typeDefinitionId: focus.typeDefinitionId,
      typeDefinitionVersionId: focus.typeDefinitionVersionId,
      kind: 'content_focus' as const,
    })),
  ];
  if (detail.pinnedOptions.length !== expected.length) {
    context.addIssue({
      code: 'custom',
      path: ['pinnedOptions'],
      message: 'Pinned display options must cover every selected binding reference.',
    });
    return;
  }
  expected.forEach((reference, index) => {
    const option = detail.pinnedOptions[index];
    if (!option || option.typeDefinitionId !== reference.typeDefinitionId ||
      option.typeDefinitionVersionId !== reference.typeDefinitionVersionId ||
      option.kind !== reference.kind) {
      context.addIssue({
        code: 'custom',
        path: ['pinnedOptions', index],
        message: 'Pinned display options must follow binding role and priority order.',
      });
    }
  });
});

export type BookTypeBindingDetail = z.infer<typeof bookTypeBindingDetailSchema>;

export const bookClassificationTargetSchema = z.object({
  bookId: idSchema<BreakdownBookId>(),
  typeLibraryVersion: positiveVersionSchema,
  revision: positiveVersionSchema,
  mainType: typeDefinitionVersionReferenceSchema.nullable(),
  contentFocuses: orderedContentFocusReferencesSchema,
  updatedAt: timestampSchema,
}).strict();

export type BookClassificationTarget = z.infer<typeof bookClassificationTargetSchema>;

const methodologyBaseReferenceSchema = z.object({
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  methodologyVersionId: idSchema<MethodologyVersionId>(),
}).strict();

const methodologyOverlayReferenceSchema = methodologyBaseReferenceSchema.extend({
  priority: z.number().int().min(1).max(CONTENT_FOCUS_BINDING_LIMIT),
}).strict();

const orderedMethodologyOverlayReferencesSchema = z.array(methodologyOverlayReferenceSchema)
  .max(CONTENT_FOCUS_BINDING_LIMIT)
  .superRefine(validateOrderedReferences);

export const effectiveMethodologySnapshotSchema = z.object({
  analysisConfigurationSnapshotId: idSchema<AnalysisConfigurationSnapshotId>(),
  base: methodologyBaseReferenceSchema,
  overlays: orderedMethodologyOverlayReferencesSchema,
  schemaVersion: positiveVersionSchema,
  compositionVersion: positiveVersionSchema,
}).strict();

export type EffectiveMethodologySnapshot = z.infer<typeof effectiveMethodologySnapshotSchema>;

const promptBaseReferenceSchema = z.object({
  typeDefinitionVersionId: idSchema<TypeDefinitionVersionId>(),
  promptTemplateRegistryEntryId: idSchema<PromptTemplateRegistryEntryId>(),
  promptTemplateVersionId: idSchema<PromptTemplateVersionId>(),
  templateVersion: positiveVersionSchema,
}).strict();

const promptOverlayReferenceSchema = promptBaseReferenceSchema.extend({
  priority: z.number().int().min(1).max(CONTENT_FOCUS_BINDING_LIMIT),
}).strict();

const orderedPromptOverlayReferencesSchema = z.array(promptOverlayReferenceSchema)
  .max(CONTENT_FOCUS_BINDING_LIMIT)
  .superRefine(validateOrderedReferences);

export const effectivePromptModuleSnapshotSchema = z.object({
  moduleKey: z.enum(ANALYSIS_MODULE_KEYS),
  base: promptBaseReferenceSchema,
  overlays: orderedPromptOverlayReferencesSchema,
  schemaVersion: positiveVersionSchema,
}).strict();

export type EffectivePromptModuleSnapshot = z.infer<typeof effectivePromptModuleSnapshotSchema>;

const orderedEffectivePromptModulesSchema = z.array(effectivePromptModuleSnapshotSchema)
  .length(ANALYSIS_MODULE_KEYS.length)
  .superRefine((modules, context) => {
    modules.forEach((module, index) => {
      if (module.moduleKey !== ANALYSIS_MODULE_KEYS[index]) {
        context.addIssue({
          code: 'custom',
          path: [index, 'moduleKey'],
          message: 'Prompt module snapshots must match the authoritative module order.',
        });
      }
    });
  });

export const effectivePromptSnapshotSchema = z.object({
  analysisConfigurationSnapshotId: idSchema<AnalysisConfigurationSnapshotId>(),
  modules: orderedEffectivePromptModulesSchema,
  compositionVersion: positiveVersionSchema,
}).strict();

export type EffectivePromptSnapshot = z.infer<typeof effectivePromptSnapshotSchema>;

export const analysisConfigurationSnapshotSchema = z.object({
  id: idSchema<AnalysisConfigurationSnapshotId>(),
  bookId: idSchema<BreakdownBookId>(),
  sourceClassificationRevision: positiveVersionSchema,
  typeLibraryVersion: positiveVersionSchema,
  mainType: typeDefinitionVersionReferenceSchema,
  contentFocuses: orderedContentFocusReferencesSchema,
  effectiveMethodology: effectiveMethodologySnapshotSchema,
  effectivePrompt: effectivePromptSnapshotSchema,
  createdAt: timestampSchema,
}).strict().superRefine((snapshot, context) => {
  if (snapshot.effectiveMethodology.analysisConfigurationSnapshotId !== snapshot.id) {
    context.addIssue({ code: 'custom', path: ['effectiveMethodology'], message: 'Snapshot identity mismatch.' });
  }
  if (snapshot.effectivePrompt.analysisConfigurationSnapshotId !== snapshot.id) {
    context.addIssue({ code: 'custom', path: ['effectivePrompt'], message: 'Snapshot identity mismatch.' });
  }
  if (snapshot.effectiveMethodology.base.typeDefinitionVersionId !== snapshot.mainType.typeDefinitionVersionId) {
    context.addIssue({ code: 'custom', path: ['effectiveMethodology', 'base'], message: 'MainType version mismatch.' });
  }
  const classificationVersions = snapshot.contentFocuses.map((focus) => focus.typeDefinitionVersionId);
  const methodologyVersions = snapshot.effectiveMethodology.overlays.map((focus) => focus.typeDefinitionVersionId);
  if (!sameOrderedValues(classificationVersions, methodologyVersions)) {
    context.addIssue({
      code: 'custom',
      path: ['effectiveMethodology', 'overlays'],
      message: 'Methodology overlays must match the classification target.',
    });
  }
  snapshot.effectivePrompt.modules.forEach((module, index) => {
    if (module.base.typeDefinitionVersionId !== snapshot.mainType.typeDefinitionVersionId) {
      context.addIssue({
        code: 'custom',
        path: ['effectivePrompt', 'modules', index, 'base'],
        message: 'Prompt MainType version must match the classification target.',
      });
    }
    const promptVersions = module.overlays.map((focus) => focus.typeDefinitionVersionId);
    if (!sameOrderedValues(classificationVersions, promptVersions)) {
      context.addIssue({
        code: 'custom',
        path: ['effectivePrompt', 'modules', index, 'overlays'],
        message: 'Prompt overlays must match the classification target.',
      });
    }
  });
});

export type AnalysisConfigurationSnapshot = z.infer<typeof analysisConfigurationSnapshotSchema>;

export const ANALYSIS_CONFIGURATION_IMPACT_REASON_CODES = [
  'effective_methodology_changed',
  'effective_prompt_composition_changed',
  'effective_prompt_module_changed',
] as const;

export type AnalysisConfigurationImpactReasonCode =
  (typeof ANALYSIS_CONFIGURATION_IMPACT_REASON_CODES)[number];

const analysisConfigurationModuleImpactSchema = z.object({
  moduleKey: z.enum(ANALYSIS_MODULE_KEYS),
  reasonCodes: z.array(z.enum(ANALYSIS_CONFIGURATION_IMPACT_REASON_CODES))
    .min(1)
    .superRefine((reasonCodes, context) => {
      const canonical = ANALYSIS_CONFIGURATION_IMPACT_REASON_CODES.filter(
        (reasonCode) => reasonCodes.includes(reasonCode),
      );
      if (new Set(reasonCodes).size !== reasonCodes.length ||
        !sameOrderedValues(reasonCodes, canonical)) {
        context.addIssue({
          code: 'custom',
          message: 'Impact reason codes must be unique and use canonical order.',
        });
      }
    }),
}).strict();

export const analysisConfigurationImpactDerivationSchema = z.object({
  algorithm: z.literal('analysis_configuration_snapshot_diff_v1'),
  moduleImpacts: z.array(analysisConfigurationModuleImpactSchema)
    .max(ANALYSIS_MODULE_KEYS.length)
    .superRefine((moduleImpacts, context) => {
      const moduleKeys = moduleImpacts.map((impact) => impact.moduleKey);
      const canonical = ANALYSIS_MODULE_KEYS.filter((moduleKey) => moduleKeys.includes(moduleKey));
      if (new Set(moduleKeys).size !== moduleKeys.length ||
        !sameOrderedValues(moduleKeys, canonical)) {
        context.addIssue({
          code: 'custom',
          message: 'Module impacts must be unique and use canonical module order.',
        });
      }
    }),
}).strict();

export type AnalysisConfigurationImpactDerivation = z.infer<
  typeof analysisConfigurationImpactDerivationSchema
>;

export function deriveAnalysisConfigurationImpact(
  previousInput: z.input<typeof analysisConfigurationSnapshotSchema>,
  nextInput: z.input<typeof analysisConfigurationSnapshotSchema>,
): AnalysisConfigurationImpactDerivation {
  const previousSnapshot = analysisConfigurationSnapshotSchema.parse(previousInput);
  const nextSnapshot = analysisConfigurationSnapshotSchema.parse(nextInput);
  const globalReasonCodes: AnalysisConfigurationImpactReasonCode[] = [];
  if (!sameEffectiveMethodology(
    previousSnapshot.effectiveMethodology,
    nextSnapshot.effectiveMethodology,
  )) {
    globalReasonCodes.push('effective_methodology_changed');
  }
  if (previousSnapshot.effectivePrompt.compositionVersion !==
    nextSnapshot.effectivePrompt.compositionVersion) {
    globalReasonCodes.push('effective_prompt_composition_changed');
  }

  const moduleImpacts = ANALYSIS_MODULE_KEYS.flatMap((moduleKey, index) => {
    const reasonCodes = [...globalReasonCodes];
    if (!sameEffectivePromptModule(
      previousSnapshot.effectivePrompt.modules[index],
      nextSnapshot.effectivePrompt.modules[index],
    )) {
      reasonCodes.push('effective_prompt_module_changed');
    }
    return reasonCodes.length === 0 ? [] : [{ moduleKey, reasonCodes }];
  });

  return analysisConfigurationImpactDerivationSchema.parse({
    algorithm: 'analysis_configuration_snapshot_diff_v1',
    moduleImpacts,
  });
}

const orderedAnalysisModuleKeysSchema = z.array(z.enum(ANALYSIS_MODULE_KEYS))
  .min(1)
  .superRefine((keys, context) => {
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      context.addIssue({ code: 'custom', message: 'Analysis module keys must be unique.' });
    }
    const canonicalOrder = ANALYSIS_MODULE_KEYS.filter((key) => uniqueKeys.has(key));
    if (!sameOrderedValues(keys, canonicalOrder)) {
      context.addIssue({ code: 'custom', message: 'Analysis module keys must use canonical order.' });
    }
  });

export const analysisConfigurationImpactPlanSchema = z.object({
  bookId: idSchema<BreakdownBookId>(),
  fromSnapshotId: idSchema<AnalysisConfigurationSnapshotId>(),
  toSnapshotId: idSchema<AnalysisConfigurationSnapshotId>(),
  derivation: analysisConfigurationImpactDerivationSchema,
  affectedModuleKeys: orderedAnalysisModuleKeysSchema,
  rebuildModuleKeys: orderedAnalysisModuleKeysSchema,
  completeRerunConfirmed: z.boolean(),
}).strict().superRefine((plan, context) => {
  if (plan.fromSnapshotId === plan.toSnapshotId) {
    context.addIssue({
      code: 'custom',
      path: ['toSnapshotId'],
      message: 'An upgrade must create a distinct analysis configuration snapshot.',
    });
  }
  const rebuildsEveryModule = sameOrderedValues(plan.rebuildModuleKeys, ANALYSIS_MODULE_KEYS);
  if (plan.completeRerunConfirmed) {
    if (!rebuildsEveryModule) {
      context.addIssue({
        code: 'custom',
        path: ['rebuildModuleKeys'],
        message: 'A confirmed complete rerun rebuilds every ordinary module.',
      });
    }
  } else {
    if (rebuildsEveryModule) {
      context.addIssue({
        code: 'custom',
        path: ['completeRerunConfirmed'],
        message: 'Rebuilding every ordinary module requires explicit confirmation.',
      });
    } else if (!sameOrderedValues(plan.rebuildModuleKeys, plan.affectedModuleKeys)) {
      context.addIssue({
        code: 'custom',
        path: ['rebuildModuleKeys'],
        message: 'Without complete-rerun confirmation, only affected modules may rebuild.',
      });
    }
  }
});

export type AnalysisConfigurationImpactPlan = z.infer<typeof analysisConfigurationImpactPlanSchema>;

export const analysisConfigurationUpgradeEnvelopeSchema = z.object({
  previousSnapshot: analysisConfigurationSnapshotSchema,
  nextSnapshot: analysisConfigurationSnapshotSchema,
  impactPlan: analysisConfigurationImpactPlanSchema,
}).strict().superRefine((upgrade, context) => {
  if (upgrade.previousSnapshot.bookId !== upgrade.nextSnapshot.bookId ||
    upgrade.previousSnapshot.bookId !== upgrade.impactPlan.bookId) {
    context.addIssue({ code: 'custom', path: ['impactPlan', 'bookId'], message: 'Upgrade Book identity mismatch.' });
  }
  if (upgrade.previousSnapshot.id !== upgrade.impactPlan.fromSnapshotId) {
    context.addIssue({ code: 'custom', path: ['impactPlan', 'fromSnapshotId'], message: 'Previous snapshot identity mismatch.' });
  }
  if (upgrade.nextSnapshot.id !== upgrade.impactPlan.toSnapshotId) {
    context.addIssue({ code: 'custom', path: ['impactPlan', 'toSnapshotId'], message: 'Next snapshot identity mismatch.' });
  }
  if (!isStrictlyLaterInstant(
    upgrade.nextSnapshot.createdAt,
    upgrade.previousSnapshot.createdAt,
  )) {
    context.addIssue({ code: 'custom', path: ['nextSnapshot', 'createdAt'], message: 'Upgrade snapshots must advance creation time.' });
  }
  const derivedImpact = deriveAnalysisConfigurationImpact(
    upgrade.previousSnapshot,
    upgrade.nextSnapshot,
  );
  const derivedModuleKeys = derivedImpact.moduleImpacts.map((impact) => impact.moduleKey);
  if (!sameImpactDerivation(upgrade.impactPlan.derivation, derivedImpact)) {
    context.addIssue({
      code: 'custom',
      path: ['impactPlan', 'derivation'],
      message: 'Impact derivation must match the deterministic snapshot diff.',
    });
  }
  if (!sameOrderedValues(upgrade.impactPlan.affectedModuleKeys, derivedModuleKeys)) {
    context.addIssue({
      code: 'custom',
      path: ['impactPlan', 'affectedModuleKeys'],
      message: 'Affected modules must match the deterministic snapshot diff.',
    });
  }
});

export type AnalysisConfigurationUpgradeEnvelope = z.infer<
  typeof analysisConfigurationUpgradeEnvelopeSchema
>;

export type TypeLibraryAnalysisReadinessInput = {
  readonly mainType: TypeDefinitionVersionReference | null;
  readonly contentFocuses: readonly ContentFocusVersionReference[];
  readonly unavailableTypeDefinitionVersionIds: readonly TypeDefinitionVersionId[];
  readonly methodologyReady: boolean;
  readonly promptReady: boolean;
  readonly schemaReady: boolean;
  readonly compositionStatus: 'ready' | 'conflict';
};

export type TypeLibraryAnalysisReadinessDependencies = Pick<
  TypeLibraryAnalysisReadinessInput,
  'methodologyReady' | 'promptReady' | 'schemaReady' | 'compositionStatus'
>;

export const BLOCK_12_ANALYSIS_READINESS_DEPENDENCIES = {
  methodologyReady: false,
  promptReady: false,
  schemaReady: false,
  compositionStatus: 'ready',
} as const satisfies TypeLibraryAnalysisReadinessDependencies;

export type TypeLibraryAnalysisReadiness =
  | { readonly ready: true }
  | {
      readonly ready: false;
      readonly title: typeof ANALYSIS_READINESS_TITLE;
      readonly blockerCodes: readonly AnalysisReadinessBlockerCode[];
    };

export function evaluateTypeLibraryAnalysisReadiness(
  input: TypeLibraryAnalysisReadinessInput,
): TypeLibraryAnalysisReadiness {
  const blockerCodes: AnalysisReadinessBlockerCode[] = [];
  if (input.mainType === null) blockerCodes.push('missing_main_type');

  const selectedVersions = [
    ...(input.mainType ? [input.mainType.typeDefinitionVersionId] : []),
    ...input.contentFocuses.map((focus) => focus.typeDefinitionVersionId),
  ];
  const unavailable = new Set(input.unavailableTypeDefinitionVersionIds);
  if (selectedVersions.some((versionId) => unavailable.has(versionId))) {
    blockerCodes.push('type_definition_version_unavailable');
  }
  if (!input.methodologyReady) blockerCodes.push('methodology_not_ready');
  if (!input.promptReady) blockerCodes.push('prompt_not_ready');
  if (!input.schemaReady) blockerCodes.push('schema_not_ready');
  if (input.compositionStatus === 'conflict') blockerCodes.push('composition_conflict');

  return blockerCodes.length === 0
    ? { ready: true }
    : { ready: false, title: ANALYSIS_READINESS_TITLE, blockerCodes };
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameEffectiveMethodology(
  left: EffectiveMethodologySnapshot,
  right: EffectiveMethodologySnapshot,
): boolean {
  return left.base.typeDefinitionVersionId === right.base.typeDefinitionVersionId &&
    left.base.methodologyVersionId === right.base.methodologyVersionId &&
    left.schemaVersion === right.schemaVersion &&
    left.compositionVersion === right.compositionVersion &&
    left.overlays.length === right.overlays.length &&
    left.overlays.every((overlay, index) => {
      const other = right.overlays[index];
      return other !== undefined && overlay.priority === other.priority &&
        overlay.typeDefinitionVersionId === other.typeDefinitionVersionId &&
        overlay.methodologyVersionId === other.methodologyVersionId;
    });
}

function sameEffectivePromptModule(
  left: EffectivePromptModuleSnapshot,
  right: EffectivePromptModuleSnapshot,
): boolean {
  return left.moduleKey === right.moduleKey && left.schemaVersion === right.schemaVersion &&
    samePromptReference(left.base, right.base) &&
    left.overlays.length === right.overlays.length &&
    left.overlays.every((overlay, index) => {
      const other = right.overlays[index];
      return other !== undefined && overlay.priority === other.priority &&
        samePromptReference(overlay, other);
    });
}

function samePromptReference(
  left: { readonly typeDefinitionVersionId: string;
    readonly promptTemplateRegistryEntryId: string;
    readonly promptTemplateVersionId: string; readonly templateVersion: number },
  right: { readonly typeDefinitionVersionId: string;
    readonly promptTemplateRegistryEntryId: string;
    readonly promptTemplateVersionId: string; readonly templateVersion: number },
): boolean {
  return left.typeDefinitionVersionId === right.typeDefinitionVersionId &&
    left.promptTemplateRegistryEntryId === right.promptTemplateRegistryEntryId &&
    left.promptTemplateVersionId === right.promptTemplateVersionId &&
    left.templateVersion === right.templateVersion;
}

function sameImpactDerivation(
  left: AnalysisConfigurationImpactDerivation,
  right: AnalysisConfigurationImpactDerivation,
): boolean {
  return left.algorithm === right.algorithm &&
    left.moduleImpacts.length === right.moduleImpacts.length &&
    left.moduleImpacts.every((impact, index) => {
      const other = right.moduleImpacts[index];
      return other !== undefined && impact.moduleKey === other.moduleKey &&
        sameOrderedValues(impact.reasonCodes, other.reasonCodes);
    });
}
