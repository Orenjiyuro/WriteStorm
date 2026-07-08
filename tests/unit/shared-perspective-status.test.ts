import { describe, expect, it } from 'vitest';
import {
  PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES,
  PERSPECTIVE_SOURCE_CHANGE_STATUS_RULES,
  PERSPECTIVE_STATUS_FIXTURES,
  PERSPECTIVE_STATUSES,
  type PerspectiveInstanceStatus,
  type PerspectiveSourceChangeStatusRule,
  type PerspectiveStatusFixture,
  type PerspectiveStatusReasonKind,
} from '../../src/shared/domain';

const currentStatus: PerspectiveInstanceStatus = 'current';
const partialStatus: PerspectiveInstanceStatus = 'partial';
const staleStatus: PerspectiveInstanceStatus = 'stale';
const blockedStatus: PerspectiveInstanceStatus = 'blocked';
const needsRefreshStatus: PerspectiveInstanceStatus = 'needs_refresh';
const sourceErrorReason: PerspectiveStatusReasonKind = 'broken_evidence_anchor';

// @ts-expect-error Perspective status vocabulary is fixed for Task 5.5.
const invalidPerspectiveStatus: PerspectiveInstanceStatus = 'ready';

const expectedStructureChangeRule = {
  sourceChangeKind: 'structure_changed',
  marksAffectedPerspectives: true,
  affectedStatus: 'needs_refresh',
  preservesStoredView: true,
  autoRecompute: false,
  overwriteExistingViewOnOpen: false,
} as const satisfies PerspectiveSourceChangeStatusRule;

const expectedStatusFixtures = [
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

const invalidSilentCurrentFixture = {
  perspectiveKey: 'setting_rule_payoff',
  reasonKind: 'broken_evidence_anchor',
  // @ts-expect-error Broken or missing source status must not silently stay current.
  displayStatus: 'current',
  displayReason: 'source_error',
  silentDisplayAllowed: false,
} satisfies PerspectiveStatusFixture;

describe('perspective stale, missing, and broken-link status rules', () => {
  it('locks the perspective status vocabulary', () => {
    expect(currentStatus).toBe('current');
    expect(partialStatus).toBe('partial');
    expect(staleStatus).toBe('stale');
    expect(blockedStatus).toBe('blocked');
    expect(needsRefreshStatus).toBe('needs_refresh');
    expect(PERSPECTIVE_STATUSES).toEqual([
      'current',
      'partial',
      'stale',
      'blocked',
      'needs_refresh',
    ]);
  });

  it('marks structure changes as affected perspectives without auto recompute', () => {
    expect(PERSPECTIVE_SOURCE_CHANGE_STATUS_RULES).toEqual([expectedStructureChangeRule]);
    expect(PERSPECTIVE_STATUS_FIXTURES).toContainEqual({
      perspectiveKey: 'foreshadowing_suspense_payoff',
      reasonKind: 'structure_changed',
      displayStatus: 'needs_refresh',
      marksAffectedPerspectives: true,
      autoRecompute: false,
      overwriteExistingViewOnOpen: false,
      silentDisplayAllowed: false,
    });
  });

  it('shows broken evidence anchors as source errors instead of silent current views', () => {
    expect(sourceErrorReason).toBe('broken_evidence_anchor');
    expect(PERSPECTIVE_STATUS_FIXTURES).toContainEqual({
      perspectiveKey: 'setting_rule_payoff',
      reasonKind: 'broken_evidence_anchor',
      displayStatus: 'blocked',
      displayReason: 'source_error',
      silentDisplayAllowed: false,
    });
    expect(invalidSilentCurrentFixture.displayStatus).toBe('current');
  });

  it('shows missing module instances as partial while preserving blocked for other hard gaps', () => {
    expect(PERSPECTIVE_STATUS_FIXTURES).toEqual(expectedStatusFixtures);
    expect(PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES).toContainEqual({
      perspectiveKey: 'foreshadowing_suspense_payoff',
      missingAssetKind: 'analysis_module_instance',
      missingRequirement: 'required',
      displayStatus: 'partial',
    });
    expect(PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES).toContainEqual({
      perspectiveKey: 'technique_source_trace',
      missingAssetKind: 'reusable_technique_candidate',
      missingRequirement: 'required',
      displayStatus: 'blocked',
    });
  });
});
