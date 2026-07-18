import { describe, expect, it } from 'vitest';
import {
  PROMPT_PUBLICATION_ACTIONS,
  PROMPT_PUBLICATION_BLOCKER_CODES,
  PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
  evaluatePromptPublicationPermission,
  previewPromptPublicationTransition,
  promptPublicationShellStateSchema,
  promptTemplateRegistryAggregateSchema,
} from '../../src/shared/domain';
import type {
  AnalysisModuleKey,
  MethodologyVersion,
  MethodologyVersionId,
  PromptTemplateRegistryAggregate,
  PromptTemplateRegistryEntryId,
  PromptTemplateVersion,
  PromptTemplateVersionId,
  TypeDefinitionId,
  TypeDefinitionVersion,
  TypeDefinitionVersionId,
} from '../../src/shared/domain';

const registryEntryId = 'prompt-registry-entry' as PromptTemplateRegistryEntryId;
const rollbackTargetVersionId = 'prompt-version-rollback' as PromptTemplateVersionId;
const publishedVersionId = 'prompt-version-published' as PromptTemplateVersionId;
const draftVersionId = 'prompt-version-draft' as PromptTemplateVersionId;
const newerPublishedVersionId = 'prompt-version-newer-published' as PromptTemplateVersionId;
const typeDefinitionId = 'builtin-main-001' as TypeDefinitionId;
const typeDefinitionVersionId = 'builtin-main-001-v1' as TypeDefinitionVersionId;
const methodologyVersionId = 'methodology-main-001-v1' as MethodologyVersionId;

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

function createVersion(
  id: PromptTemplateVersionId,
  templateVersion: number,
  overrides: Partial<PromptTemplateVersion>,
): PromptTemplateVersion {
  return {
    id,
    registryEntryId,
    typeDefinitionVersionId,
    methodologyVersionId,
    templateVersion,
    role: 'base',
    schemaVersion: 1,
    sampleGateStatus: 'passed',
    publishedAt: null,
    createdAt: `2026-07-18T0${templateVersion}:00:00.000Z`,
    ...overrides,
  };
}

function createAggregate(
  draftSampleGateStatus: PromptTemplateVersion['sampleGateStatus'] = 'passed',
  activationStatus: 'enabled' | 'disabled' = 'enabled',
): PromptTemplateRegistryAggregate {
  return promptTemplateRegistryAggregateSchema.parse({
    entry: {
      id: registryEntryId,
      registryKey: 'analysis.world-rules.builtin-main-001.base',
      moduleKey: 'world_rules' as AnalysisModuleKey,
      typeDefinitionId,
      role: 'base',
      publishedVersionId,
      activationStatus,
    },
    versions: [
      createVersion(rollbackTargetVersionId, 1, {
        publishedAt: '2026-07-18T01:30:00.000Z',
      }),
      createVersion(publishedVersionId, 2, {
        publishedAt: '2026-07-18T02:30:00.000Z',
      }),
      createVersion(draftVersionId, 3, {
        sampleGateStatus: draftSampleGateStatus,
      }),
    ],
    typeDefinitionVersions: [typeDefinitionVersion],
    methodologyVersions: [methodologyVersion],
  });
}

function createState(overrides: Record<string, unknown> = {}) {
  return promptPublicationShellStateSchema.parse({
    aggregate: createAggregate(),
    draftVersionId,
    rollbackTargetVersionId,
    persistenceAdmitted: true,
    ...overrides,
  });
}

describe('Block 12 Task 12.11R Prompt publication aggregate state machine', () => {
  it('freezes the three operations and exact blocker vocabulary', () => {
    expect(PROMPT_PUBLICATION_ACTIONS).toEqual(['publish', 'rollback', 'disable']);
    expect(PROMPT_PUBLICATION_BLOCKER_CODES).toEqual([
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
    ]);
  });

  it('keeps every operation blocked when no production registry instance exists', () => {
    for (const action of PROMPT_PUBLICATION_ACTIONS) {
      const permission = evaluatePromptPublicationPermission(
        PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
        action,
      );

      expect(permission.allowed).toBe(false);
      expect(permission.blockerCodes).toContain('prompt_template_persistence_not_admitted');
    }

    expect(evaluatePromptPublicationPermission(
      PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
      'publish',
    ).blockerCodes).toContain('sample_preview_not_passed');
  });

  it.each(['not_run', 'blocked', 'failed'] as const)(
    'refuses publish while the aggregate draft sample gate is %s',
    (draftSampleGateStatus) => {
      const state = createState({ aggregate: createAggregate(draftSampleGateStatus) });

      expect(evaluatePromptPublicationPermission(state, 'publish')).toEqual({
        action: 'publish',
        allowed: false,
        blockerCodes: ['sample_preview_not_passed'],
      });
      expect(previewPromptPublicationTransition(state, {
        action: 'publish',
        publishedAt: '2026-07-18T04:00:00.000Z',
      })).toEqual({
        applied: false,
        state,
        permission: {
          action: 'publish',
          allowed: false,
          blockerCodes: ['sample_preview_not_passed'],
        },
      });
    },
  );

  it('publishes the passed draft and records publication history before repointing', () => {
    const state = createState({ aggregate: createAggregate('passed', 'disabled') });
    const result = previewPromptPublicationTransition(state, {
      action: 'publish',
      publishedAt: '2026-07-18T04:00:00.000Z',
    });

    expect(result.applied).toBe(true);
    expect(result.state.aggregate?.entry).toMatchObject({
      publishedVersionId: draftVersionId,
      activationStatus: 'disabled',
    });
    expect(result.state.aggregate?.versions.find(({ id }) => id === draftVersionId)?.publishedAt)
      .toBe('2026-07-18T04:00:00.000Z');
    expect(result.state.draftVersionId).toBeNull();
    expect(result.state.rollbackTargetVersionId).toBe(publishedVersionId);
    expect(promptTemplateRegistryAggregateSchema.safeParse(result.state.aggregate).success).toBe(true);
  });

  it('refuses publish when the selected draft is older than the current published version', () => {
    const aggregate = createAggregate();
    const publishedVersion = aggregate.versions.find(({ id }) => id === publishedVersionId)!;
    const olderDraft = {
      ...aggregate.versions.find(({ id }) => id === draftVersionId)!,
      templateVersion: 1,
    };
    const state = createState({
      aggregate: promptTemplateRegistryAggregateSchema.parse({
        ...aggregate,
        versions: [publishedVersion, olderDraft],
      }),
      rollbackTargetVersionId: null,
    });

    expect(evaluatePromptPublicationPermission(state, 'publish')).toEqual({
      action: 'publish',
      allowed: false,
      blockerCodes: ['draft_version_not_newer'],
    });
    expect(previewPromptPublicationTransition(state, {
      action: 'publish',
      publishedAt: '2026-07-18T04:00:00.000Z',
    }).applied).toBe(false);
  });

  it('rejects a publication instant earlier than the draft creation instant', () => {
    const state = createState();

    expect(() => previewPromptPublicationTransition(state, {
      action: 'publish',
      publishedAt: '2026-07-18T10:30:00+08:00',
    })).toThrow('Published template versions cannot predate creation.');
  });

  it('orders a new publication fact after the current publication instant', () => {
    const aggregate = createAggregate();
    const state = createState({
      aggregate: promptTemplateRegistryAggregateSchema.parse({
        ...aggregate,
        versions: aggregate.versions.map((version) => version.id === publishedVersionId
          ? { ...version, publishedAt: '2026-07-18T04:00:00.000Z' }
          : version),
      }),
    });

    expect(() => previewPromptPublicationTransition(state, {
      action: 'publish',
      publishedAt: '2026-07-18T11:30:00+08:00',
    })).toThrow('New publication fact cannot predate the current publication fact.');

    expect(previewPromptPublicationTransition(state, {
      action: 'publish',
      publishedAt: '2026-07-18T12:00:00+08:00',
    }).applied).toBe(true);
  });

  it('refuses rollback unless the selected target has historical publication fact', () => {
    const state = createState({ rollbackTargetVersionId: draftVersionId });
    const result = previewPromptPublicationTransition(state, { action: 'rollback' });

    expect(result.applied).toBe(false);
    expect(result.permission.blockerCodes).toEqual(['rollback_target_not_published']);
    expect(result.state).toBe(state);
  });

  it('rolls back only by repointing to a historically published version', () => {
    const state = createState();
    const result = previewPromptPublicationTransition(state, { action: 'rollback' });

    expect(result.applied).toBe(true);
    expect(result.state.aggregate?.entry.publishedVersionId).toBe(rollbackTargetVersionId);
    expect(result.state.rollbackTargetVersionId).toBeNull();
    expect(result.state.aggregate?.versions).toEqual(state.aggregate?.versions);
    expect(promptTemplateRegistryAggregateSchema.safeParse(result.state.aggregate).success).toBe(true);
    expect(JSON.stringify(result)).not.toContain('rolled_back');
  });

  it('rejects a historically published target that is newer than the current version', () => {
    const aggregate = createAggregate();
    const newerPublishedVersion = createVersion(newerPublishedVersionId, 4, {
      publishedAt: '2026-07-18T04:30:00.000Z',
      createdAt: '2026-07-18T04:00:00.000Z',
    });
    const state = createState({
      aggregate: promptTemplateRegistryAggregateSchema.parse({
        ...aggregate,
        versions: [...aggregate.versions, newerPublishedVersion],
      }),
      rollbackTargetVersionId: newerPublishedVersionId,
    });

    expect(evaluatePromptPublicationPermission(state, 'rollback')).toEqual({
      action: 'rollback',
      allowed: false,
      blockerCodes: ['rollback_target_not_earlier'],
    });
    expect(previewPromptPublicationTransition(state, { action: 'rollback' }).applied).toBe(false);
  });

  it('disables activation while retaining the aggregate publication pointer', () => {
    const state = createState();
    const result = previewPromptPublicationTransition(state, { action: 'disable' });

    expect(result.applied).toBe(true);
    expect(result.state.aggregate?.entry.activationStatus).toBe('disabled');
    expect(result.state.aggregate?.entry.publishedVersionId).toBe(publishedVersionId);
    expect(result.state.aggregate?.versions).toEqual(state.aggregate?.versions);
  });

  it('rejects shell references without a validated aggregate', () => {
    expect(() => createState({ aggregate: null })).toThrow();
    expect(() => promptPublicationShellStateSchema.parse({
      aggregate: null,
      draftVersionId: null,
      rollbackTargetVersionId: null,
      persistenceAdmitted: true,
    })).toThrow();
  });
});
