import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TypeLibraryBindingEditor } from '../../src/renderer/features/type-library/TypeLibraryBindingEditor';
import type {
  TypeDefinitionId,
  TypeDefinitionVersionId,
  TypeLibraryReleaseOptions,
} from '../../src/shared/domain';

const release = {
  version: 1,
  options: [
    {
      typeDefinitionId: 'builtin_main_001', typeDefinitionVersionId: 'builtin_main_001_v1',
      kind: 'main_type', origin: 'built_in', stableKey: 'builtin_main_001',
      displayName: '日轻校园', selectionDescription: '校园与社团舞台。', sortOrder: 0,
    },
    {
      typeDefinitionId: 'builtin_focus_001', typeDefinitionVersionId: 'builtin_focus_001_v1',
      kind: 'content_focus', origin: 'built_in', stableKey: 'builtin_focus_001',
      displayName: '恋爱炒股', selectionDescription: '多位女主的情感互动。', sortOrder: 0,
    },
  ],
} as TypeLibraryReleaseOptions;

describe('natural TypeLibrary renderer path', () => {
  it('connects preload DTO reads and CAS mutation to the existing Breakdown shelf', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(source).toContain('typeLibraryOptionsQueryOptions(');
    expect(source).toContain('typeLibraryBindingQueryOptions(');
    expect(source).toContain('createTypeLibraryBindingMutationOptions(');
    expect(source).toContain('typeLibrary={{');
    expect(source).toContain("createImportRequest(selection, typeLibraryOptionsQuery.data?.version)");
  });

  it('renders user-only selectors, ordered focuses, and the exact readiness gate', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'import-classification',
      title: 'Optional book classification',
      options: release,
      value: { mainType: null, contentFocuses: [] },
      pending: false,
      error: null,
      onChange: vi.fn(),
    }));

    expect(html).toContain('Optional book classification');
    expect(html).toContain('日轻校园');
    expect(html).toContain('恋爱炒股');
    expect(html).toContain('Content focus priority 1');
    expect(html).toContain('Content focus priority 3');
    expect(html).toContain('方法论尚未就绪，不能开始正式分析');
    expect(html).toContain('missing_main_type');
    expect(html).not.toContain('Automatically detected');
  });

  it('exposes an honest disabled custom-type shell without a callable path', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'import-classification',
      title: 'Optional book classification',
      options: release,
      value: { mainType: null, contentFocuses: [] },
      pending: false,
      error: null,
      onChange: vi.fn(),
    }));
    const shellSource = readFileSync(
      'src/renderer/features/type-library/CustomTypeDisabledShell.tsx',
      'utf8',
    );

    expect(html).toContain('Custom types');
    expect(html).toContain('Copy a built-in template to customize');
    expect(html).toContain('disabled=""');
    expect(html).toContain(
      'aria-describedby="import-classification-custom-type-disabled-reason"',
    );
    expect(html).toContain('local identity');
    expect(html).toContain('persistence');
    expect(html).toContain('versioning');
    expect(html).toContain('sample validation');
    expect(html).toContain('publication');
    expect(shellSource).not.toContain('onClick');
    expect(shellSource).not.toContain('window.writestorm');
    expect(shellSource).not.toContain('typeLibrary.');
  });

  it('shows methodology blockers rather than pretending a selected MainType is analysis-ready', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'book-classification',
      title: 'Book classification',
      options: release,
      value: {
        mainType: {
          typeDefinitionId: release.options[0].typeDefinitionId,
          typeDefinitionVersionId: release.options[0].typeDefinitionVersionId,
        },
        contentFocuses: [{
          typeDefinitionId: release.options[1].typeDefinitionId,
          typeDefinitionVersionId: release.options[1].typeDefinitionVersionId,
        }],
      },
      pending: false,
      error: null,
      onChange: vi.fn(),
      onSave: vi.fn(),
    }));

    expect(html).toContain('Save classification');
    expect(html).toContain('methodology_not_ready');
    expect(html).toContain('prompt_not_ready');
    expect(html).toContain('schema_not_ready');
    expect(html).toMatch(
      /<option value="builtin_main_001_v1" selected="">日轻校园<\/option>/,
    );
    expect(html).toMatch(
      /<option value="builtin_focus_001_v1" selected="">恋爱炒股<\/option>/,
    );
    expect(html).toContain(
      'id="book-classification-main-type-description">校园与社团舞台。</span>',
    );
    expect(html).toContain(
      'id="book-classification-focus-1-description">多位女主的情感互动。</span>',
    );
    expect(html).not.toContain('日轻校园 — 校园与社团舞台。');
    expect(html).not.toContain('恋爱炒股 — 多位女主的情感互动。');
  });

  it('renders shared readiness results with localized reasons', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'book-classification',
      title: 'Book classification',
      options: release,
      value: {
        mainType: {
          typeDefinitionId: release.options[0].typeDefinitionId,
          typeDefinitionVersionId: release.options[0].typeDefinitionVersionId,
        },
        contentFocuses: [],
      },
      readinessDependencies: {
        methodologyReady: true,
        promptReady: true,
        schemaReady: true,
        compositionStatus: 'conflict',
      },
      pending: false,
      error: null,
      onChange: vi.fn(),
    }));

    expect(html).toContain('data-blocker-code="composition_conflict"');
    expect(html).toContain('The selected type methodologies cannot be composed safely.');
    expect(html).not.toContain('data-blocker-code="methodology_not_ready"');
    expect(html).not.toContain('data-blocker-code="prompt_not_ready"');
    expect(html).not.toContain('data-blocker-code="schema_not_ready"');
  });

  it('shows explicit revision-conflict recovery while preserving the selected draft', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'book-classification',
      title: 'Book classification',
      options: release,
      value: {
        mainType: {
          typeDefinitionId: release.options[0].typeDefinitionId,
          typeDefinitionVersionId: release.options[0].typeDefinitionVersionId,
        },
        contentFocuses: [{
          typeDefinitionId: release.options[1].typeDefinitionId,
          typeDefinitionVersionId: release.options[1].typeDefinitionVersionId,
        }],
      },
      pending: false,
      error: null,
      conflict: true,
      onChange: vi.fn(),
      onSave: vi.fn(),
      onLoadLatest: vi.fn(),
    }));
    const routerSource = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(html).toContain('Classification changed in another session');
    expect(html).toContain('Your unsaved selection is still preserved');
    expect(html).toContain('Retry my selection');
    expect(html).toContain('Load latest saved classification');
    expect(html).toContain('value="builtin_main_001_v1"');
    expect(routerSource).toContain('if (openedBookTypeSelectionDirty) return;');
    expect(routerSource).toContain('isTypeLibraryRevisionConflict(error)');
  });

  it('shows an archived pinned option without making it selectable again', () => {
    const html = renderToStaticMarkup(createElement(TypeLibraryBindingEditor, {
      idPrefix: 'book-classification',
      title: 'Book classification',
      options: release,
      pinnedOptions: [{
        typeDefinitionId: 'archived-main' as TypeDefinitionId,
        typeDefinitionVersionId: 'archived-main-v1' as TypeDefinitionVersionId,
        kind: 'main_type',
        origin: 'user_defined',
        stableKey: null,
        displayName: 'Archived Main',
        selectionDescription: 'Historical pinned display.',
        availability: 'archived',
      }],
      value: {
        mainType: {
          typeDefinitionId: 'archived-main' as TypeDefinitionId,
          typeDefinitionVersionId: 'archived-main-v1' as TypeDefinitionVersionId,
        },
        contentFocuses: [],
      },
      pending: false,
      error: null,
      onChange: vi.fn(),
      onSave: vi.fn(),
    }));

    expect(html).toContain('Archived Main');
    expect(html).toContain('value="archived-main-v1" disabled="" selected=""');
    expect(html).toContain('Archived selection · Historical pinned display.');
    expect(html).toContain('data-blocker-code="type_definition_version_unavailable"');
    expect(html).toContain('A selected type version is archived or unavailable.');
  });

  it('delegates readiness decisions to the shared evaluator', () => {
    const source = readFileSync(
      'src/renderer/features/type-library/TypeLibraryBindingEditor.tsx',
      'utf8',
    );

    expect(source).toContain('evaluateTypeLibraryAnalysisReadiness');
    expect(source).not.toContain("? ['missing_main_type']");
  });
});
