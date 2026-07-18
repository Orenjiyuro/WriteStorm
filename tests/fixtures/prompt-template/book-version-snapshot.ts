import { ANALYSIS_MODULE_KEYS } from '../../../src/shared/domain';

const bookId = '00000000-0000-4000-8000-000000000901';
const libraryId = '00000000-0000-4000-8000-000000000001';
const sourceTextId = '00000000-0000-4000-8000-000000000902';
const mainType = {
  typeDefinitionId: 'builtin_main_001',
  typeDefinitionVersionId: 'builtin_main_001_v1',
};
const contentFocus = {
  priority: 1,
  typeDefinitionId: 'builtin_focus_001',
  typeDefinitionVersionId: 'builtin_focus_001_v1',
};

function createSnapshot(
  id: string,
  upgradedModuleKey: (typeof ANALYSIS_MODULE_KEYS)[number] | null,
) {
  return {
    id,
    bookId,
    sourceClassificationRevision: 1,
    typeLibraryVersion: 1,
    mainType,
    contentFocuses: [contentFocus],
    effectiveMethodology: {
      analysisConfigurationSnapshotId: id,
      base: {
        typeDefinitionVersionId: mainType.typeDefinitionVersionId,
        methodologyVersionId: 'methodology-main-001-v1',
      },
      overlays: [{
        priority: 1,
        typeDefinitionVersionId: contentFocus.typeDefinitionVersionId,
        methodologyVersionId: 'methodology-focus-001-v1',
      }],
      schemaVersion: 1,
      compositionVersion: 1,
    },
    effectivePrompt: {
      analysisConfigurationSnapshotId: id,
      modules: ANALYSIS_MODULE_KEYS.map((moduleKey) => {
        const templateVersion = moduleKey === upgradedModuleKey ? 2 : 1;
        return {
          moduleKey,
          base: {
            typeDefinitionVersionId: mainType.typeDefinitionVersionId,
            promptTemplateRegistryEntryId: `prompt.${moduleKey}.builtin_main_001.base`,
            promptTemplateVersionId:
              `prompt.${moduleKey}.builtin_main_001.base.v${templateVersion}`,
            templateVersion,
          },
          overlays: [{
            priority: 1,
            typeDefinitionVersionId: contentFocus.typeDefinitionVersionId,
            promptTemplateRegistryEntryId: `prompt.${moduleKey}.builtin_focus_001.overlay`,
            promptTemplateVersionId: `prompt.${moduleKey}.builtin_focus_001.overlay.v1`,
            templateVersion: 1,
          }],
          schemaVersion: 1,
        };
      }),
      compositionVersion: 1,
    },
    createdAt: upgradedModuleKey === null
      ? '2026-07-18T00:00:00.000Z'
      : '2026-07-18T01:00:00.000Z',
  };
}

export const previousAnalysisConfigurationSnapshot = createSnapshot(
  'analysis-configuration-1',
  null,
);

export const upgradedAnalysisConfigurationSnapshot = createSnapshot(
  'analysis-configuration-2',
  'world_rules',
);

export const bookMetadataDetailFixture = {
  book: {
    id: bookId,
    libraryId,
    title: 'Snapshot fixture book',
    sourceTextId,
    sourceTextEdition: 1,
    structureEdition: 1,
    mainTypeDisplayName: '日轻校园',
    contentFocusDisplayNames: ['恋爱炒股'],
    updatedAt: '2026-07-18T00:00:00.000Z',
  },
  currentTypeBinding: {
    bookId,
    typeLibraryVersion: 1,
    revision: 1,
    mainType,
    contentFocuses: [contentFocus],
    updatedAt: '2026-07-18T00:00:00.000Z',
  },
  latestAnalysisConfigurationSnapshot: previousAnalysisConfigurationSnapshot,
};

export const selectiveTemplateUpgradeFixture = {
  previousSnapshot: previousAnalysisConfigurationSnapshot,
  nextSnapshot: upgradedAnalysisConfigurationSnapshot,
  impactPlan: {
    bookId,
    fromSnapshotId: previousAnalysisConfigurationSnapshot.id,
    toSnapshotId: upgradedAnalysisConfigurationSnapshot.id,
    derivation: {
      algorithm: 'analysis_configuration_snapshot_diff_v1',
      moduleImpacts: [{
        moduleKey: 'world_rules',
        reasonCodes: ['effective_prompt_module_changed'],
      }],
    },
    affectedModuleKeys: ['world_rules'],
    rebuildModuleKeys: ['world_rules'],
    completeRerunConfirmed: false,
  },
};
