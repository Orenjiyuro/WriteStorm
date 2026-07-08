import { describe, expect, it } from 'vitest';
import {
  PERSPECTIVE_DEPENDENCY_ASSET_KINDS,
  PERSPECTIVE_EXPORT_POLICY,
  PERSPECTIVE_EXPORT_POLICY_FIXTURES,
  type PerspectiveExportParticipationKind,
  type PerspectiveExportPolicy,
  type PerspectiveExportPolicyFixture,
  type PerspectiveExportStatusMarkerStatus,
  type PerspectiveOriginalContextSourceAssetKind,
} from '../../src/shared/domain';

const exportParticipation: PerspectiveExportParticipationKind =
  'exportable_derived_reading_view';
const staleStatusMarker: PerspectiveExportStatusMarkerStatus = 'stale';
const originalContextSourceAsset: PerspectiveOriginalContextSourceAssetKind = 'evidence_anchor';

// @ts-expect-error Perspective exports are derived reading views, not fact-source exports.
const invalidFactSourceExportParticipation: PerspectiveExportParticipationKind =
  'exportable_fact_source';

// @ts-expect-error Current perspective exports do not carry stale/partial status markers.
const invalidCurrentStatusMarker: PerspectiveExportStatusMarkerStatus = 'current';

// @ts-expect-error Module instances are containers, not original reference source assets.
const invalidModuleInstanceOriginalSource: PerspectiveOriginalContextSourceAssetKind =
  'analysis_module_instance';

const expectedExportPolicy = {
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

const expectedExportFixtures = [
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

const invalidFactSourceFixture = {
  perspectiveKey: 'pacing_emotion_drive',
  instanceStatus: 'current',
  exportParticipation: 'exportable_derived_reading_view',
  requiresStatusMarker: false,
  // @ts-expect-error Export fixtures cannot present perspective views as fact sources.
  exportedAsFactSource: true,
} satisfies PerspectiveExportPolicyFixture;

describe('perspective export and original-reference policy', () => {
  it('exports perspectives only as derived reading views', () => {
    expect(exportParticipation).toBe('exportable_derived_reading_view');
    expect(PERSPECTIVE_EXPORT_POLICY).toEqual(expectedExportPolicy);
    expect(PERSPECTIVE_EXPORT_POLICY.exportableAsDerivedReadingView).toBe(true);
    expect(PERSPECTIVE_EXPORT_POLICY.exportedAsFactSource).toBe(false);
    expect(invalidFactSourceExportParticipation).toBe('exportable_fact_source');
    expect(invalidFactSourceFixture.exportedAsFactSource).toBe(true);
  });

  it('requires stale and partial exports to carry status markers', () => {
    expect(staleStatusMarker).toBe('stale');
    expect(invalidCurrentStatusMarker).toBe('current');
    expect(PERSPECTIVE_EXPORT_POLICY.statusMarkerRequiredFor).toEqual(['partial', 'stale']);
    expect(PERSPECTIVE_EXPORT_POLICY.statusMarkerField).toBe('perspectiveStatus');
    expect(PERSPECTIVE_EXPORT_POLICY_FIXTURES).toEqual(expectedExportFixtures);

    for (const fixture of PERSPECTIVE_EXPORT_POLICY_FIXTURES) {
      if (fixture.instanceStatus === 'partial' || fixture.instanceStatus === 'stale') {
        expect(fixture.requiresStatusMarker).toBe(true);
        expect(fixture.statusMarker).toBe(fixture.instanceStatus);
      }
    }
  });

  it('allows original references only to confirmed source assets, not perspective facts', () => {
    expect(originalContextSourceAsset).toBe('evidence_anchor');
    expect(invalidModuleInstanceOriginalSource).toBe('analysis_module_instance');
    expect(PERSPECTIVE_EXPORT_POLICY.originalContext.allowedSourceAssetKinds).toEqual(
      PERSPECTIVE_DEPENDENCY_ASSET_KINDS.filter(
        (assetKind) => assetKind !== 'analysis_module_instance',
      ),
    );
    expect(PERSPECTIVE_EXPORT_POLICY.originalContext.requiredSourceReviewStatus).toBe(
      'confirmed',
    );
    expect(PERSPECTIVE_EXPORT_POLICY.originalContext.requiresConfirmedSourceAssets).toBe(true);
    expect(PERSPECTIVE_EXPORT_POLICY.originalContext.perspectiveViewMayParticipate).toBe(false);
    expect(
      PERSPECTIVE_EXPORT_POLICY.originalContext.perspectiveDerivedFactsMayBeCitedAsSource,
    ).toBe(false);
  });
});
