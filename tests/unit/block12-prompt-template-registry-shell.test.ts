import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PROMPT_TEMPLATE_REGISTRY_SHELL_POLICY,
  createEditedPromptTemplateDraft,
  getPromptTemplateVersionLifecycle,
  promptTemplateRegistryAggregateSchema,
  promptTemplateRegistryEntrySchema,
  promptTemplateVersionSchema,
  type AnalysisModuleKey,
  type MethodologyVersion,
  type MethodologyVersionId,
  type PromptTemplateRegistryEntry,
  type PromptTemplateRegistryEntryId,
  type PromptTemplateVersion,
  type PromptTemplateVersionId,
  type TypeDefinitionId,
  type TypeDefinitionVersion,
  type TypeDefinitionVersionId,
} from '../../src/shared/domain';

const registryEntryId = 'prompt-entry-1' as PromptTemplateRegistryEntryId;
const versionOneId = 'prompt-version-1' as PromptTemplateVersionId;
const versionTwoId = 'prompt-version-2' as PromptTemplateVersionId;
const typeDefinitionId = 'builtin_main_001' as TypeDefinitionId;
const typeDefinitionVersionId = 'builtin_main_001_v1' as TypeDefinitionVersionId;
const methodologyVersionId = 'methodology-main-001-v1' as MethodologyVersionId;

const disabledEntry = {
  id: registryEntryId,
  registryKey: 'analysis.world-rules.builtin-main-001.base',
  moduleKey: 'world_rules' as AnalysisModuleKey,
  typeDefinitionId,
  role: 'base',
  publishedVersionId: null,
  activationStatus: 'disabled',
} satisfies PromptTemplateRegistryEntry;

const draftVersion = {
  id: versionOneId,
  registryEntryId,
  typeDefinitionVersionId,
  methodologyVersionId,
  templateVersion: 1,
  role: 'base',
  schemaVersion: 1,
  sampleGateStatus: 'not_run',
  publishedAt: null,
  createdAt: '2026-07-18T00:00:00.000Z',
} satisfies PromptTemplateVersion;

const typeDefinitionVersion = {
  id: typeDefinitionVersionId,
  typeDefinitionId,
  version: 1,
  displayName: '日轻校园',
  selectionDescription: '用户主动选择的内置主类型。',
  createdAt: '2026-07-18T00:00:00.000Z',
} satisfies TypeDefinitionVersion;

const methodologyVersion = {
  id: methodologyVersionId,
  typeDefinitionId,
  typeDefinitionVersionId,
  version: 1,
  role: 'base',
  schemaVersion: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
} satisfies MethodologyVersion;

function createAggregate(
  entry: PromptTemplateRegistryEntry = disabledEntry,
  versions: PromptTemplateVersion[] = [draftVersion],
) {
  return {
    entry,
    versions,
    typeDefinitionVersions: [typeDefinitionVersion],
    methodologyVersions: [methodologyVersion],
  };
}

describe('Block 12 Task 12.8 PromptTemplate registry shell', () => {
  it('freezes separate identity, version, sample, publication, and activation axes', () => {
    expect(promptTemplateRegistryAggregateSchema.safeParse(createAggregate()).success).toBe(true);
    expect(getPromptTemplateVersionLifecycle(draftVersion)).toBe('draft');
    expect(promptTemplateRegistryEntrySchema.safeParse({
      ...disabledEntry,
      status: 'draft',
    }).success).toBe(false);
    expect(promptTemplateVersionSchema.safeParse({
      ...draftVersion,
      status: 'sample_passed',
    }).success).toBe(false);
    expect(promptTemplateVersionSchema.safeParse({
      ...draftVersion,
      rolledBack: true,
    }).success).toBe(false);
  });

  it('rejects dangling publication pointers and cross-registry or duplicate versions', () => {
    const publishedEntry = {
      ...disabledEntry,
      publishedVersionId: versionOneId,
    } satisfies PromptTemplateRegistryEntry;
    const publishedVersion = {
      ...draftVersion,
      sampleGateStatus: 'passed',
      publishedAt: '2026-07-18T01:00:00.000Z',
    } satisfies PromptTemplateVersion;

    expect(promptTemplateRegistryAggregateSchema.safeParse(
      createAggregate(publishedEntry, [publishedVersion]),
    ).success).toBe(true);
    expect(getPromptTemplateVersionLifecycle(publishedVersion)).toBe('published');
    expect(promptTemplateRegistryAggregateSchema.safeParse(
      createAggregate(publishedEntry, [draftVersion]),
    ).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse(createAggregate(publishedEntry, [
      {
        ...publishedVersion,
        registryEntryId: 'another-entry' as PromptTemplateRegistryEntryId,
      },
    ])).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse(createAggregate(publishedEntry, [
      publishedVersion,
      { ...publishedVersion, id: versionTwoId },
    ])).success).toBe(false);
  });

  it('rejects unresolved or cross-owned TypeDefinition and Methodology provenance', () => {
    expect(promptTemplateRegistryAggregateSchema.safeParse({
      ...createAggregate(),
      typeDefinitionVersions: [],
    }).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse({
      ...createAggregate(),
      typeDefinitionVersions: [{
        ...typeDefinitionVersion,
        typeDefinitionId: 'another-definition',
      }],
    }).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse({
      ...createAggregate(),
      methodologyVersions: [{
        ...methodologyVersion,
        typeDefinitionId: 'another-definition',
      }],
    }).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse({
      ...createAggregate(),
      methodologyVersions: [{
        ...methodologyVersion,
        typeDefinitionVersionId: 'another-definition-version',
      }],
    }).success).toBe(false);
    expect(promptTemplateRegistryAggregateSchema.safeParse({
      ...createAggregate(),
      methodologyVersions: [{ ...methodologyVersion, role: 'overlay' }],
    }).success).toBe(false);
  });

  it('orders publication history by instant across mixed UTC offsets', () => {
    expect(promptTemplateVersionSchema.safeParse({
      ...draftVersion,
      sampleGateStatus: 'passed',
      createdAt: '2026-07-18T03:00:00+00:00',
      publishedAt: '2026-07-18T10:30:00+08:00',
    }).success).toBe(false);
    expect(promptTemplateVersionSchema.safeParse({
      ...draftVersion,
      sampleGateStatus: 'passed',
      createdAt: '2026-07-18T10:00:00+08:00',
      publishedAt: '2026-07-18T03:00:00+00:00',
    }).success).toBe(true);
    expect(promptTemplateVersionSchema.safeParse({
      ...draftVersion,
      sampleGateStatus: 'passed',
      createdAt: '2026-07-18T10:00:00+08:00',
      publishedAt: '2026-07-18T02:00:00+00:00',
    }).success).toBe(true);
  });

  it('creates a clean draft rather than mutating or inheriting publication state', () => {
    const publishedVersion = {
      ...draftVersion,
      sampleGateStatus: 'passed',
      publishedAt: '2026-07-18T01:00:00.000Z',
    } satisfies PromptTemplateVersion;

    expect(createEditedPromptTemplateDraft(publishedVersion, {
      id: versionTwoId,
      createdAt: '2026-07-18T02:00:00.000Z',
    })).toEqual({
      ...publishedVersion,
      id: versionTwoId,
      templateVersion: 2,
      sampleGateStatus: 'not_run',
      publishedAt: null,
      createdAt: '2026-07-18T02:00:00.000Z',
    });
  });

  it('requires edited drafts to use a new identity without chronological regression', () => {
    expect(() => createEditedPromptTemplateDraft(draftVersion, {
      id: versionOneId,
      createdAt: '2026-07-18T01:00:00.000Z',
    })).toThrow(/new version identity/i);

    expect(() => createEditedPromptTemplateDraft(draftVersion, {
      id: versionTwoId,
      createdAt: '2026-07-18T07:59:59+08:00',
    })).toThrow(/must not predate/i);

    expect(createEditedPromptTemplateDraft(draftVersion, {
      id: versionTwoId,
      createdAt: '2026-07-18T08:00:00+08:00',
    }).createdAt).toBe('2026-07-18T08:00:00+08:00');
  });

  it('keeps the registry metadata-only with no production owner or runtime', () => {
    expect(PROMPT_TEMPLATE_REGISTRY_SHELL_POLICY).toEqual({
      persistence: 'not_admitted',
      productionSeed: 'not_admitted',
      rendererEntryOwner: 'task_12_13',
      samplePreviewOwner: 'task_12_10',
      publicationStateMachineOwner: 'task_12_11',
      methodologyOwner: 'block_14',
      runtimeOwner: 'block_17',
    });

    for (const path of [
      'src/main/db/migrations/index.ts',
      'src/shared/contracts/channels.ts',
      'src/shared/contracts/preload-api.ts',
    ]) {
      expect(readFileSync(path, 'utf8')).not.toMatch(/prompt(?:[-_:]|Template)/i);
    }
  });
});
