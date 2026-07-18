import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_READINESS_BLOCKER_CODES,
  ANALYSIS_READINESS_TITLE,
  BUILT_IN_TYPE_OPTION_CONFIRMATION_STATUSES,
  CONTENT_FOCUS_BINDING_LIMIT,
  PROMPT_ACTIVATION_STATUSES,
  PROMPT_SAMPLE_GATE_STATUSES,
  TYPE_SELECTION_POLICY,
  TYPE_LIBRARY_CLASSIFICATION_UPDATE_POLICY,
  analysisConfigurationSnapshotSchema,
  bookClassificationTargetSchema,
  createEditedPromptTemplateDraft,
  effectiveMethodologySnapshotSchema,
  effectivePromptSnapshotSchema,
  evaluateTypeLibraryAnalysisReadiness,
  promptTemplateRegistryEntrySchema,
  promptTemplateVersionSchema,
  builtInTypeOptionProposalSchema,
  typeDefinitionVersionSchema,
  type AnalysisConfigurationSnapshotId,
  type AnalysisModuleKey,
  type BreakdownBookId,
  type MethodologyVersionId,
  type PromptTemplateRegistryEntryId,
  type PromptTemplateVersion,
  type PromptTemplateVersionId,
  type TypeDefinitionId,
  type TypeDefinitionVersionId,
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const configurationId = 'configuration-1' as AnalysisConfigurationSnapshotId;
const mainTypeId = 'main-type-1' as TypeDefinitionId;
const mainTypeVersionId = 'main-type-version-1' as TypeDefinitionVersionId;
const focusTypeId = 'focus-1' as TypeDefinitionId;
const focusTypeVersionId = 'focus-version-1' as TypeDefinitionVersionId;
const methodologyVersionId = 'methodology-1' as MethodologyVersionId;
const promptRegistryEntryId = 'prompt-entry-1' as PromptTemplateRegistryEntryId;
const promptVersionId = 'prompt-version-1' as PromptTemplateVersionId;

const confirmedOption = {
  proposalId: 'proposal-main-1',
  kind: 'main_type',
  displayName: 'Reviewed Main Type',
  ownerKind: 'source_controlled_admission_asset',
  confirmationStatus: 'confirmed',
  selectionDescription: 'Choose this option when it matches the analysis perspective you want to apply.',
  stableKey: 'reviewed_main_type',
  selectionAuthority: 'user_only',
  automaticClassification: false,
  methodologyOwner: 'block_14',
} as const;

const mainTypeRef = {
  typeDefinitionId: mainTypeId,
  typeDefinitionVersionId: mainTypeVersionId,
} as const;

const focusRef = {
  typeDefinitionId: focusTypeId,
  typeDefinitionVersionId: focusTypeVersionId,
  priority: 1,
} as const;

describe('TypeLibrary built-in option governance', () => {
  it('keeps confirmation minimal because users choose and the app never classifies', () => {
    expect(BUILT_IN_TYPE_OPTION_CONFIRMATION_STATUSES).toEqual([
      'proposed',
      'confirmed',
      'deferred',
    ]);
    expect(TYPE_SELECTION_POLICY).toEqual({
      selectionAuthority: 'user_only',
      automaticClassification: false,
      inferFromSourceText: false,
      methodologyOwner: 'block_14',
      runtimeValidationOwner: 'block_17',
    });

    expect(builtInTypeOptionProposalSchema.safeParse({
      ...confirmedOption,
      confirmationStatus: 'proposed',
      selectionDescription: null,
      stableKey: null,
    }).success).toBe(true);

    expect(builtInTypeOptionProposalSchema.safeParse({
      ...confirmedOption,
      selectionDescription: null,
    }).success).toBe(false);
    expect(builtInTypeOptionProposalSchema.safeParse({
      ...confirmedOption,
      stableKey: null,
    }).success).toBe(true);
    expect(builtInTypeOptionProposalSchema.safeParse({
      ...confirmedOption,
      confirmationStatus: 'proposed',
    }).success).toBe(false);
    expect(builtInTypeOptionProposalSchema.safeParse(confirmedOption).success).toBe(true);

    for (const forbiddenReviewField of [
      'entryConditions',
      'positiveExamples',
      'negativeExamples',
      'boundaryCases',
      'validationCorpus',
      'moduleImpactJustification',
    ]) {
      expect(builtInTypeOptionProposalSchema.safeParse({
        ...confirmedOption,
        [forbiddenReviewField]: ['not a Block 12 requirement'],
      }).success).toBe(false);
    }
  });

  it('keeps TypeDefinitionVersion independent from methodology and Prompt versions', () => {
    const definitionVersion = {
      id: mainTypeVersionId,
      typeDefinitionId: mainTypeId,
      version: 1,
      displayName: 'Reviewed Main Type',
      selectionDescription: 'A stable user-facing selection explanation.',
      createdAt: '2026-07-17T00:00:00.000Z',
    };

    expect(typeDefinitionVersionSchema.safeParse(definitionVersion).success).toBe(true);
    expect(typeDefinitionVersionSchema.safeParse({
      ...definitionVersion,
      methodologyVersionId,
    }).success).toBe(false);
    expect(typeDefinitionVersionSchema.safeParse({
      ...definitionVersion,
      promptVersionId,
    }).success).toBe(false);
  });
});

describe('TypeLibrary Book binding governance', () => {
  it('allows focus-only not-ready targets while enforcing zero-to-three ordered unique focuses', () => {
    expect(CONTENT_FOCUS_BINDING_LIMIT).toBe(3);
    expect(bookClassificationTargetSchema.safeParse({
      bookId,
      typeLibraryVersion: 1,
      revision: 1,
      mainType: null,
      contentFocuses: [focusRef],
      updatedAt: '2026-07-17T00:00:00.000Z',
    }).success).toBe(true);

    expect(bookClassificationTargetSchema.safeParse({
      bookId,
      typeLibraryVersion: 1,
      revision: 1,
      mainType: mainTypeRef,
      contentFocuses: [focusRef, { ...focusRef, priority: 2 }],
      updatedAt: '2026-07-17T00:00:00.000Z',
    }).success).toBe(false);

    expect(bookClassificationTargetSchema.safeParse({
      bookId,
      typeLibraryVersion: 1,
      revision: 1,
      mainType: mainTypeRef,
      contentFocuses: [
        focusRef,
        { ...focusRef, typeDefinitionId: 'focus-2', typeDefinitionVersionId: 'focus-version-2', priority: 3 },
      ],
      updatedAt: '2026-07-17T00:00:00.000Z',
    }).success).toBe(false);

    expect(bookClassificationTargetSchema.safeParse({
      bookId,
      typeLibraryVersion: 1,
      revision: 1,
      mainType: mainTypeRef,
      contentFocuses: [1, 2, 3, 4].map((priority) => ({
        typeDefinitionId: `focus-${priority}`,
        typeDefinitionVersionId: `focus-version-${priority}`,
        priority,
      })),
      updatedAt: '2026-07-17T00:00:00.000Z',
    }).success).toBe(false);
  });

  it('returns the common title with exact readiness reason codes', () => {
    expect(ANALYSIS_READINESS_TITLE).toBe('方法论尚未就绪，不能开始正式分析');
    expect(ANALYSIS_READINESS_BLOCKER_CODES).toEqual([
      'missing_main_type',
      'type_definition_version_unavailable',
      'methodology_not_ready',
      'prompt_not_ready',
      'schema_not_ready',
      'composition_conflict',
    ]);

    expect(evaluateTypeLibraryAnalysisReadiness({
      mainType: null,
      contentFocuses: [focusRef],
      unavailableTypeDefinitionVersionIds: [],
      methodologyReady: false,
      promptReady: false,
      schemaReady: false,
      compositionStatus: 'conflict',
    })).toEqual({
      ready: false,
      title: ANALYSIS_READINESS_TITLE,
      blockerCodes: [
        'missing_main_type',
        'methodology_not_ready',
        'prompt_not_ready',
        'schema_not_ready',
        'composition_conflict',
      ],
    });
  });

  it('freezes classification updates as current-target-only CAS policy', () => {
    expect(TYPE_LIBRARY_CLASSIFICATION_UPDATE_POLICY).toEqual({
      usesExpectedRevisionCas: true,
      updatesCurrentBookTargetOnly: true,
      rewritesExistingAnalysisConfigurationSnapshots: false,
      rewritesHistoricalAnalysisResults: false,
      logicUpgradeCreatesNewAnalysisConfigurationSnapshot: true,
      logicUpgradeRequiresImpactPlan: true,
      selectiveRebuildTargetsAffectedModulesOnly: true,
      completeRerunRequiresExplicitConfirmation: true,
    });
  });
});

describe('TypeLibrary methodology and Prompt provenance', () => {
  it('pins independent effective methodology and Prompt snapshots', () => {
    const methodology = {
      analysisConfigurationSnapshotId: configurationId,
      base: {
        typeDefinitionVersionId: mainTypeVersionId,
        methodologyVersionId,
      },
      overlays: [{
        priority: 1,
        typeDefinitionVersionId: focusTypeVersionId,
        methodologyVersionId: 'methodology-overlay-1',
      }],
      schemaVersion: 1,
      compositionVersion: 1,
    };
    const prompt = {
      analysisConfigurationSnapshotId: configurationId,
      modules: ANALYSIS_MODULE_KEYS.map((moduleKey) => ({
        moduleKey,
        base: {
          typeDefinitionVersionId: mainTypeVersionId,
          promptTemplateRegistryEntryId: promptRegistryEntryId,
          promptTemplateVersionId: promptVersionId,
          templateVersion: 1,
        },
        overlays: [{
          priority: 1,
          typeDefinitionVersionId: focusTypeVersionId,
          promptTemplateRegistryEntryId: `prompt-overlay-entry-${moduleKey}`,
          promptTemplateVersionId: `prompt-overlay-${moduleKey}-1`,
          templateVersion: 1,
        }],
        schemaVersion: 1,
      })),
      compositionVersion: 1,
    };

    expect(effectiveMethodologySnapshotSchema.safeParse(methodology).success).toBe(true);
    expect(effectivePromptSnapshotSchema.safeParse(prompt).success).toBe(true);
    expect(effectiveMethodologySnapshotSchema.safeParse({
      ...methodology,
      overlays: [...methodology.overlays, { ...methodology.overlays[0], priority: 2 }],
    }).success).toBe(false);

    expect(analysisConfigurationSnapshotSchema.safeParse({
      id: configurationId,
      bookId,
      sourceClassificationRevision: 1,
      typeLibraryVersion: 1,
      mainType: mainTypeRef,
      contentFocuses: [focusRef],
      effectiveMethodology: methodology,
      effectivePrompt: prompt,
      createdAt: '2026-07-17T00:00:00.000Z',
    }).success).toBe(true);
  });

  it('separates registry activation/publication from version sample status', () => {
    expect(PROMPT_SAMPLE_GATE_STATUSES).toEqual(['not_run', 'blocked', 'failed', 'passed']);
    expect(PROMPT_ACTIVATION_STATUSES).toEqual(['enabled', 'disabled']);

    const registryEntry = {
      id: promptRegistryEntryId,
      registryKey: 'analysis.main.reviewed-main-type',
      moduleKey: 'world_rules' as AnalysisModuleKey,
      typeDefinitionId: mainTypeId,
      role: 'base',
      publishedVersionId: promptVersionId,
      activationStatus: 'enabled',
    };
    const version = {
      id: promptVersionId,
      registryEntryId: promptRegistryEntryId,
      typeDefinitionVersionId: mainTypeVersionId,
      methodologyVersionId,
      templateVersion: 1,
      role: 'base',
      schemaVersion: 1,
      sampleGateStatus: 'passed',
      publishedAt: '2026-07-17T00:00:00.000Z',
      createdAt: '2026-07-17T00:00:00.000Z',
    } satisfies PromptTemplateVersion;

    expect(promptTemplateRegistryEntrySchema.safeParse(registryEntry).success).toBe(true);
    expect(promptTemplateVersionSchema.safeParse(version).success).toBe(true);
    expect(promptTemplateVersionSchema.safeParse({
      ...version,
      activationStatus: 'disabled',
    }).success).toBe(false);

    expect(createEditedPromptTemplateDraft(version, {
      id: 'prompt-version-2' as PromptTemplateVersionId,
      createdAt: '2026-07-17T01:00:00.000Z',
    })).toEqual({
      ...version,
      id: 'prompt-version-2',
      templateVersion: 2,
      sampleGateStatus: 'not_run',
      publishedAt: null,
      createdAt: '2026-07-17T01:00:00.000Z',
    });
  });
});
