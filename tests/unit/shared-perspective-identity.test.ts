import { describe, expect, it } from 'vitest';
import type { ModuleInstanceSummary } from '../../src/shared/contracts/modules';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SCOPE_EXCLUDED_TARGETS,
  type AnalysisModuleKey,
  type BreakdownBookId,
  PERSPECTIVE_IDENTITY_CONTRACT,
  type PerspectiveDefinition,
  type PerspectiveInstance,
  type PerspectiveInstanceId,
  type PerspectiveKey,
  type ScopeRef,
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const perspectiveKey: PerspectiveKey = 'foreshadowing_suspense_payoff';
const perspectiveInstanceId = 'perspective-instance-1' as PerspectiveInstanceId;

const scopeRef = {
  kind: 'book',
  bookId,
} satisfies ScopeRef;

const definition = {
  key: perspectiveKey,
  name: 'Contract perspective',
  kind: 'derived_composite_view',
  createsAnalysisModuleInstance: false,
  isFactSource: false,
  mayStoreViewInstance: true,
} satisfies PerspectiveDefinition;

const instance = {
  id: perspectiveInstanceId,
  perspectiveKey,
  bookId,
  scopeRef,
  status: 'blocked',
  sourceRevisionSnapshot: {
    sourceTextEdition: 1,
    structureEdition: 2,
    analysisRevision: 3,
  },
} satisfies PerspectiveInstance;

// @ts-expect-error Perspective keys must not be usable as ordinary analysis module keys.
const invalidAnalysisModuleKey: AnalysisModuleKey = perspectiveKey;

// @ts-expect-error PerspectiveInstance is not a ModuleInstanceSummary.
const invalidModuleInstanceSummary: ModuleInstanceSummary = instance;

const invalidOffsetScopedPerspective = {
  ...instance,
  scopeRef: {
    // @ts-expect-error PerspectiveInstance scopeRef uses analysis target boundaries, not offsets.
    kind: 'offset_range',
    startOffset: 0,
    endOffset: 120,
  },
} satisfies PerspectiveInstance;

describe('perspective identity contract', () => {
  it('defines Perspective as a derived composite view, not an AnalysisModule', () => {
    expect(definition).toEqual({
      key: perspectiveKey,
      name: 'Contract perspective',
      kind: 'derived_composite_view',
      createsAnalysisModuleInstance: false,
      isFactSource: false,
      mayStoreViewInstance: true,
    });
    expect(
      ANALYSIS_MODULE_DEFINITIONS.some(
        (moduleDefinition) => String(moduleDefinition.key) === String(definition.key),
      ),
    ).toBe(false);
    expect(PERSPECTIVE_IDENTITY_CONTRACT.createsAnalysisModuleInstance).toBe(false);
    expect(PERSPECTIVE_IDENTITY_CONTRACT.isFactSource).toBe(false);
  });

  it('locks PerspectiveInstance identity to key, book, scope, status, and source revision snapshot', () => {
    expect(instance).toEqual({
      id: perspectiveInstanceId,
      perspectiveKey,
      bookId,
      scopeRef,
      status: 'blocked',
      sourceRevisionSnapshot: {
        sourceTextEdition: 1,
        structureEdition: 2,
        analysisRevision: 3,
      },
    });
    expect(PERSPECTIVE_IDENTITY_CONTRACT.identityFields).toEqual([
      'id',
      'perspectiveKey',
      'bookId',
      'scopeRef',
      'status',
      'sourceRevisionSnapshot',
    ]);
  });

  it('keeps scopeRef as the analysis target boundary, not text offsets or UI position', () => {
    expect(PERSPECTIVE_IDENTITY_CONTRACT.scopeRefMeaning).toBe('analysis_target_boundary');
    expect(instance.scopeRef).toEqual(scopeRef);
    expect('startOffset' in instance.scopeRef).toBe(false);
    expect('endOffset' in instance.scopeRef).toBe(false);
    expect('uiRoute' in instance.scopeRef).toBe(false);
    expect(invalidOffsetScopedPerspective.scopeRef.kind).toBe('offset_range');
  });

  it('keeps thematic perspectives outside the analysis module scope matrix', () => {
    expect(ANALYSIS_SCOPE_EXCLUDED_TARGETS).toContainEqual({
      targetKey: 'thematic_perspective',
      targetKind: 'derived_view_family',
      attemptedScope: 'story_segment_range',
      reason: '专题视角是跨模块派生视图，不属于 AnalysisModule scope matrix。',
    });
  });
});
