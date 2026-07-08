import { describe, expect, it } from 'vitest';
import {
  PERSPECTIVE_EDIT_POLICY,
  type PerspectiveEditPolicy,
  type PerspectiveEditableViewField,
  type PerspectiveSourceFactEditRule,
  type PerspectiveSourceFactKind,
} from '../../src/shared/domain';

const viewNoteField: PerspectiveEditableViewField = 'view_note';
const annotationField: PerspectiveEditableViewField = 'annotation';
const relationFactKind: PerspectiveSourceFactKind = 'relation_fact';

// @ts-expect-error Perspective view notes are not relation facts.
const invalidEditableViewField: PerspectiveEditableViewField = 'relation_fact';

const invalidSourceFactEditRule: PerspectiveSourceFactEditRule = {
  factKind: 'relation_fact',
  sourceAssetKind: 'relation_link',
  requiredEditSurface: 'source_module',
  // @ts-expect-error Source facts must not be editable from a perspective.
  editableFromPerspective: true,
};

const expectedEditPolicy = {
  perspectiveMayCreateFacts: false,
  editableViewFields: [
    {
      field: 'view_note',
      writableByUser: true,
      createsFacts: false,
    },
    {
      field: 'annotation',
      writableByUser: true,
      createsFacts: false,
    },
  ],
  derivedSummaryRefresh: {
    derivedSummaryMayExist: true,
    manualRefreshRequiresFutureAuthorizedFlow: true,
    autoRefreshEnabled: false,
    refreshOnOpen: false,
    refreshCreatesFacts: false,
  },
  sourceFactEditRules: [
    {
      factKind: 'relation_fact',
      sourceAssetKind: 'relation_link',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
    {
      factKind: 'evidence_state',
      sourceAssetKind: 'evidence_anchor',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
    {
      factKind: 'reusable_technique_candidate',
      sourceAssetKind: 'reusable_technique_candidate',
      requiredEditSurface: 'source_module',
      editableFromPerspective: false,
    },
  ],
} as const satisfies PerspectiveEditPolicy;

const invalidAutoRefreshPolicy = {
  ...expectedEditPolicy,
  derivedSummaryRefresh: {
    ...expectedEditPolicy.derivedSummaryRefresh,
    // @ts-expect-error Task 5.4 can only express future authorized refresh, not auto refresh.
    autoRefreshEnabled: true,
  },
} satisfies PerspectiveEditPolicy;

const invalidRefreshOnOpenPolicy = {
  ...expectedEditPolicy,
  derivedSummaryRefresh: {
    ...expectedEditPolicy.derivedSummaryRefresh,
    // @ts-expect-error Opening a perspective must not recompute and overwrite derived views.
    refreshOnOpen: true,
  },
} satisfies PerspectiveEditPolicy;

describe('perspective edit policy', () => {
  it('allows only user view note and annotation edits without creating facts', () => {
    expect(viewNoteField).toBe('view_note');
    expect(annotationField).toBe('annotation');
    expect(PERSPECTIVE_EDIT_POLICY.editableViewFields).toEqual(
      expectedEditPolicy.editableViewFields,
    );

    for (const fieldPolicy of PERSPECTIVE_EDIT_POLICY.editableViewFields) {
      expect(fieldPolicy.writableByUser).toBe(true);
      expect(fieldPolicy.createsFacts).toBe(false);
    }
  });

  it('keeps derived summary refresh as a future authorized flow, not automatic behavior', () => {
    expect(PERSPECTIVE_EDIT_POLICY.derivedSummaryRefresh).toEqual({
      derivedSummaryMayExist: true,
      manualRefreshRequiresFutureAuthorizedFlow: true,
      autoRefreshEnabled: false,
      refreshOnOpen: false,
      refreshCreatesFacts: false,
    });
    expect(invalidAutoRefreshPolicy.derivedSummaryRefresh.autoRefreshEnabled).toBe(true);
    expect(invalidRefreshOnOpenPolicy.derivedSummaryRefresh.refreshOnOpen).toBe(true);
  });

  it('requires source module editing for relation facts, evidence state, and technique candidates', () => {
    expect(relationFactKind).toBe('relation_fact');
    expect(PERSPECTIVE_EDIT_POLICY.sourceFactEditRules).toEqual(
      expectedEditPolicy.sourceFactEditRules,
    );

    for (const editRule of PERSPECTIVE_EDIT_POLICY.sourceFactEditRules) {
      expect(editRule.requiredEditSurface).toBe('source_module');
      expect(editRule.editableFromPerspective).toBe(false);
    }
  });

  it('keeps perspectives from becoming fact creation or fact editing entry points', () => {
    expect(PERSPECTIVE_EDIT_POLICY).toEqual(expectedEditPolicy);
    expect(PERSPECTIVE_EDIT_POLICY.perspectiveMayCreateFacts).toBe(false);
  });
});
