import { describe, expect, it } from 'vitest';
import { createFailureActionImportRequest } from '../../src/renderer/app/AppRouter';
import type { SourceImportFailureAction } from '../../src/renderer/features/breakdown-shelf/source-import-failure';
import type { TypeLibrarySelectionValue } from '../../src/renderer/features/type-library/TypeLibraryBindingEditor';
import { BUILT_IN_TYPE_OPTIONS_V1 } from '../../src/shared/domain';

const mainType = BUILT_IN_TYPE_OPTIONS_V1.find(({ definition }) =>
  definition.stableKey === 'builtin_main_004')!;
const firstFocus = BUILT_IN_TYPE_OPTIONS_V1.find(({ definition }) =>
  definition.stableKey === 'builtin_focus_003')!;
const secondFocus = BUILT_IN_TYPE_OPTIONS_V1.find(({ definition }) =>
  definition.stableKey === 'builtin_focus_007')!;

const selection: TypeLibrarySelectionValue = {
  mainType: {
    typeDefinitionId: mainType.definition.id,
    typeDefinitionVersionId: mainType.definitionVersion.id,
  },
  contentFocuses: [firstFocus, secondFocus].map((option) => ({
    typeDefinitionId: option.definition.id,
    typeDefinitionVersionId: option.definitionVersion.id,
  })),
};

describe('Block 12 Task 12.6R1 import retry classification retention', () => {
  it.each(['choose_file', 'choose_smaller_file', 'retry_import'] as const)(
    'rebuilds %s from the retained user selection and current release',
    (kind) => {
      const action = { kind, label: 'Retry' } satisfies SourceImportFailureAction;

      expect(createFailureActionImportRequest(action, selection, 1)).toEqual({
        typeBinding: {
          typeLibraryVersion: 1,
          mainType: selection.mainType,
          contentFocuses: selection.contentFocuses,
        },
      });
    },
  );

  it('keeps an intentionally unassigned retry unassigned', () => {
    expect(createFailureActionImportRequest(
      { kind: 'retry_import', label: 'Retry' },
      { mainType: null, contentFocuses: [] },
      1,
    )).toEqual({});
  });

  it('keeps encoding retry token-owned and cannot replace its original classification', () => {
    expect(createFailureActionImportRequest({
      kind: 'retry_encoding',
      label: 'Retry as UTF-8',
      pendingImportId: 'pending-import-1',
      encodingOverride: 'utf-8',
    }, selection, 1)).toEqual({
      pendingImportId: 'pending-import-1',
      encodingOverride: 'utf-8',
    });
  });

  it('does not turn non-import repair actions into import requests', () => {
    expect(createFailureActionImportRequest(
      { kind: 'open_library', label: 'Open library' },
      selection,
      1,
    )).toBeNull();
    expect(createFailureActionImportRequest({
      kind: 'open_existing_book',
      label: 'Open existing book',
      existingBookId: 'book-1',
      existingSourceTextId: 'source-1',
    }, selection, 1)).toBeNull();
  });
});
