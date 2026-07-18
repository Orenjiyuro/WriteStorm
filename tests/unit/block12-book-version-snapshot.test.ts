import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CONFIGURATION_SNAPSHOT_POLICY,
  ANALYSIS_MODULE_KEYS,
  analysisConfigurationSnapshotSchema,
  analysisConfigurationUpgradeEnvelopeSchema,
  deriveAnalysisConfigurationImpact,
  effectivePromptSnapshotSchema,
} from '../../src/shared/domain';
import {
  bookMetadataDetailSchema,
  bookSummarySchema,
} from '../../src/shared/contracts';
import {
  bookMetadataDetailFixture,
  previousAnalysisConfigurationSnapshot,
  selectiveTemplateUpgradeFixture,
  upgradedAnalysisConfigurationSnapshot,
} from '../fixtures/prompt-template/book-version-snapshot';

describe('Block 12 Task 12.9 Book version snapshots', () => {
  it('pins one ordered PromptTemplate version set for every ordinary module', () => {
    const parsed = analysisConfigurationSnapshotSchema.parse(
      previousAnalysisConfigurationSnapshot,
    );

    expect(parsed.effectivePrompt.modules.map((module) => module.moduleKey))
      .toEqual(ANALYSIS_MODULE_KEYS);
    expect(parsed.effectivePrompt.modules).toHaveLength(7);
    expect(parsed.effectivePrompt.modules[0].base).toMatchObject({
      promptTemplateRegistryEntryId:
        'prompt.structure_and_segments.builtin_main_001.base',
      promptTemplateVersionId:
        'prompt.structure_and_segments.builtin_main_001.base.v1',
      templateVersion: 1,
    });
    expect(effectivePromptSnapshotSchema.safeParse({
      ...previousAnalysisConfigurationSnapshot.effectivePrompt,
      modules: previousAnalysisConfigurationSnapshot.effectivePrompt.modules.slice(0, 6),
    }).success).toBe(false);
    expect(effectivePromptSnapshotSchema.safeParse({
      ...previousAnalysisConfigurationSnapshot.effectivePrompt,
      modules: previousAnalysisConfigurationSnapshot.effectivePrompt.modules.map(
        (module, index) => index === 1 ? { ...module, moduleKey: ANALYSIS_MODULE_KEYS[0] } : module,
      ),
    }).success).toBe(false);
  });

  it('keeps full snapshots in Book metadata detail rather than BookSummary', () => {
    expect(bookMetadataDetailSchema.parse(bookMetadataDetailFixture))
      .toEqual(bookMetadataDetailFixture);
    expect(bookSummarySchema.safeParse({
      ...bookMetadataDetailFixture.book,
      latestAnalysisConfigurationSnapshot: previousAnalysisConfigurationSnapshot,
    }).success).toBe(false);
    expect(bookMetadataDetailSchema.safeParse({
      ...bookMetadataDetailFixture,
      currentTypeBinding: {
        ...bookMetadataDetailFixture.currentTypeBinding,
        bookId: 'another-book',
      },
    }).success).toBe(false);
  });

  it('creates a distinct immutable snapshot and an explicit selective impact plan', () => {
    const previousBeforeUpgrade = structuredClone(previousAnalysisConfigurationSnapshot);
    const parsed = analysisConfigurationUpgradeEnvelopeSchema.parse(
      selectiveTemplateUpgradeFixture,
    );

    expect(parsed.previousSnapshot.id).not.toBe(parsed.nextSnapshot.id);
    expect(parsed.impactPlan.affectedModuleKeys).toEqual(['world_rules']);
    expect(parsed.impactPlan.rebuildModuleKeys).toEqual(['world_rules']);
    expect(parsed.impactPlan.derivation).toEqual(
      deriveAnalysisConfigurationImpact(
        previousAnalysisConfigurationSnapshot,
        upgradedAnalysisConfigurationSnapshot,
      ),
    );
    expect(previousAnalysisConfigurationSnapshot).toEqual(previousBeforeUpgrade);
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      ...selectiveTemplateUpgradeFixture,
      nextSnapshot: previousAnalysisConfigurationSnapshot,
    }).success).toBe(false);
  });

  it('rejects caller-declared impact that is not derived from the two snapshots', () => {
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      ...selectiveTemplateUpgradeFixture,
      impactPlan: {
        ...selectiveTemplateUpgradeFixture.impactPlan,
        derivation: {
          algorithm: 'analysis_configuration_snapshot_diff_v1',
          moduleImpacts: [{
            moduleKey: 'characters',
            reasonCodes: ['effective_prompt_module_changed'],
          }],
        },
        affectedModuleKeys: ['characters'],
        rebuildModuleKeys: ['characters'],
      },
    }).success).toBe(false);
  });

  it('derives global methodology changes as affecting every module', () => {
    const nextSnapshot = {
      ...upgradedAnalysisConfigurationSnapshot,
      effectiveMethodology: {
        ...upgradedAnalysisConfigurationSnapshot.effectiveMethodology,
        base: {
          ...upgradedAnalysisConfigurationSnapshot.effectiveMethodology.base,
          methodologyVersionId: 'methodology-main-001-v2',
        },
      },
    };
    const derivation = deriveAnalysisConfigurationImpact(
      previousAnalysisConfigurationSnapshot,
      nextSnapshot,
    );

    expect(derivation.moduleImpacts.map((impact) => impact.moduleKey))
      .toEqual(ANALYSIS_MODULE_KEYS);
    expect(derivation.moduleImpacts[0].reasonCodes)
      .toContain('effective_methodology_changed');
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      previousSnapshot: previousAnalysisConfigurationSnapshot,
      nextSnapshot,
      impactPlan: {
        ...selectiveTemplateUpgradeFixture.impactPlan,
        derivation,
        affectedModuleKeys: ANALYSIS_MODULE_KEYS,
        rebuildModuleKeys: ANALYSIS_MODULE_KEYS,
        completeRerunConfirmed: false,
      },
    }).success).toBe(false);
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      previousSnapshot: previousAnalysisConfigurationSnapshot,
      nextSnapshot,
      impactPlan: {
        ...selectiveTemplateUpgradeFixture.impactPlan,
        derivation,
        affectedModuleKeys: ANALYSIS_MODULE_KEYS,
        rebuildModuleKeys: ANALYSIS_MODULE_KEYS,
        completeRerunConfirmed: true,
      },
    }).success).toBe(true);
  });

  it('orders upgrade snapshots by instant across mixed UTC offsets', () => {
    const chronologicallyLater = {
      ...selectiveTemplateUpgradeFixture,
      previousSnapshot: {
        ...previousAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T10:00:00+08:00',
      },
      nextSnapshot: {
        ...upgradedAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T03:00:01+00:00',
      },
    };
    const chronologicallyEarlier = {
      ...selectiveTemplateUpgradeFixture,
      previousSnapshot: {
        ...previousAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T03:00:00+00:00',
      },
      nextSnapshot: {
        ...upgradedAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T10:30:00+08:00',
      },
    };
    const sameInstant = {
      ...selectiveTemplateUpgradeFixture,
      previousSnapshot: {
        ...previousAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T10:00:00+08:00',
      },
      nextSnapshot: {
        ...upgradedAnalysisConfigurationSnapshot,
        createdAt: '2026-07-18T02:00:00+00:00',
      },
    };

    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse(
      chronologicallyLater,
    ).success).toBe(true);
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse(
      chronologicallyEarlier,
    ).success).toBe(false);
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse(
      sameInstant,
    ).success).toBe(false);
  });

  it('requires explicit confirmation before a complete rerun', () => {
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      previousSnapshot: previousAnalysisConfigurationSnapshot,
      nextSnapshot: upgradedAnalysisConfigurationSnapshot,
      impactPlan: {
        ...selectiveTemplateUpgradeFixture.impactPlan,
        rebuildModuleKeys: ANALYSIS_MODULE_KEYS,
        completeRerunConfirmed: false,
      },
    }).success).toBe(false);
    expect(analysisConfigurationUpgradeEnvelopeSchema.safeParse({
      previousSnapshot: previousAnalysisConfigurationSnapshot,
      nextSnapshot: upgradedAnalysisConfigurationSnapshot,
      impactPlan: {
        ...selectiveTemplateUpgradeFixture.impactPlan,
        rebuildModuleKeys: ANALYSIS_MODULE_KEYS,
        completeRerunConfirmed: true,
      },
    }).success).toBe(true);
  });

  it('keeps Task 12.9 contract-only with no silent production upgrade path', () => {
    expect(ANALYSIS_CONFIGURATION_SNAPSHOT_POLICY).toEqual({
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
    });

    for (const path of [
      'src/main/db/migrations/index.ts',
      'src/shared/contracts/channels.ts',
      'src/shared/contracts/preload-api.ts',
    ]) {
      expect(readFileSync(path, 'utf8')).not.toMatch(
        /analysis(?:[-_]configuration|:configuration|Configuration)/,
      );
    }
  });
});
