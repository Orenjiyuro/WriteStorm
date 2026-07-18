import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_MODULE_DISABLED_ACTIONS,
  AnalysisModuleWorkbench,
} from '../../src/renderer/features/module-workbench/AnalysisModuleWorkbench';
import { BreakdownShelfRoute } from '../../src/renderer/routes/BreakdownShelfRoute';
import type { JobRecoveryPanelProps } from '../../src/renderer/features/job-recovery/JobRecoveryPanel';
import type {
  BookSummary,
  LibrarySessionSummary,
  ModuleInstanceSummary,
} from '../../src/shared/contracts';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  type AnalysisModuleInstanceId,
  type BreakdownBookId,
  type LibraryId,
} from '../../src/shared/domain';

const bookId = 'book-module-workbench' as BreakdownBookId;
const book: BookSummary = {
  id: bookId,
  libraryId: 'library-module-workbench' as LibraryId,
  title: 'Frozen workbench book',
  sourceTextId: null,
  sourceTextEdition: 1,
  structureEdition: 1,
  mainTypeDisplayName: null,
  contentFocusDisplayNames: [],
  updatedAt: '2026-07-15T00:00:00.000Z',
};
const library: LibrarySessionSummary = {
  sessionId: 'session-module-workbench',
  library: {
    id: book.libraryId,
    name: 'Module workbench library',
    rootPath: 'C:\\Libraries\\ModuleWorkbench',
    schemaVersion: 5,
    appVersion: '0.1.0-test',
  },
};
const instances: ModuleInstanceSummary[] = ANALYSIS_MODULE_DEFINITIONS.map((definition, index) => ({
  id: `module-instance-${index + 1}` as AnalysisModuleInstanceId,
  bookId,
  moduleId: definition.id,
  scope: { kind: 'book', bookId },
  status: index === 4 ? 'needs_rebuild' : 'not_generated',
  structureEdition: 1,
  analysisRevision: 0,
  updatedAt: '2026-07-15T00:00:00.000Z',
}));
const emptyJobRecovery: JobRecoveryPanelProps = {
  jobs: [], selectedJobId: null, detail: null, loading: false, detailLoading: false,
  error: null, cancelPending: false, onSelectJob: vi.fn(), onCancelJob: vi.fn(),
};

describe('AnalysisModuleWorkbench', () => {
  it('shows the authoritative module list and a selected detail with scope, status, and body placeholder', () => {
    const markup = renderToStaticMarkup(<AnalysisModuleWorkbench
      instances={instances}
      initialSelectedInstanceId={instances[4].id}
    />);

    expect(markup).toContain('Analysis workbench');
    expect(markup).toContain('7 module instances');
    for (const definition of ANALYSIS_MODULE_DEFINITIONS) {
      expect(markup).toContain(definition.name);
    }
    expect(markup).toContain('Book scope');
    expect(markup).toContain('Not generated');
    expect(markup).toContain('Needs rebuild');
    expect(markup).toContain('Markdown body');
    expect(markup).toContain('尚无资产');
    expect(markup).toContain('world_rules</p><h3 id="analysis-module-detail-title">世界设定与规则</h3>');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('shows analysis, rerun, and diff as disabled actions with separate accessible reasons', () => {
    const markup = renderToStaticMarkup(<AnalysisModuleWorkbench instances={instances} />);

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Run analysis<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Rerun module<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>View rerun diff<\/button>/);
    expect(markup).toContain('aria-describedby="analysis-action-analysis-reason"');
    expect(markup).toContain('aria-describedby="analysis-action-rerun-reason"');
    expect(markup).toContain('aria-describedby="analysis-action-diff-reason"');
    expect(markup).toContain('Codex SDK compatibility spike has not passed');
    expect(markup).toContain('AI Job runtime is not admitted');
    expect(markup).toContain('No rerun candidate exists');
    expect(ANALYSIS_MODULE_DISABLED_ACTIONS.map(({ key }) => key))
      .toEqual(['analysis', 'rerun', 'diff']);
    expect(ANALYSIS_MODULE_DISABLED_ACTIONS.every((action) =>
      Object.keys(action).sort().join(',') === 'key,label,reason')).toBe(true);
  });

  it('mounts only at the natural opened-book shelf entry after structure freeze', () => {
    const commonProps = {
      library,
      books: [book],
      importPending: false,
      lastImport: null,
      failure: null,
      openedBook: book,
      structureLoading: false,
      structureActionPending: false,
      structureError: null,
      jobRecovery: emptyJobRecovery,
      moduleInstances: instances,
      onImport: vi.fn(),
      onOpenBook: vi.fn(),
      onDetectStructure: vi.fn(),
      onRecoverStructureDetection: vi.fn(),
      onCreateStructureDraft: vi.fn(),
      onCreateManualStructureDraft: vi.fn(),
      onUpdateStructureNode: vi.fn(),
      onUpdateStructureRange: vi.fn(),
      onDiscardStructureDraft: vi.fn(),
      onFreezeStructure: vi.fn(),
      onUnfreezeStructure: vi.fn(),
      onFailureAction: vi.fn(),
    } as const;
    const unfrozen = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      ...commonProps,
      structureWorkspace: {
        bookId,
        latestDetectionRun: null,
        candidate: null,
        draft: null,
        frozen: null,
        capabilities: { canDetect: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
    }));
    const frozen = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      ...commonProps,
      structureWorkspace: {
        bookId,
        latestDetectionRun: null,
        candidate: null,
        draft: null,
        frozen: { id: 'frozen-1', structureEdition: 1, nodes: [], storyRanges: [] },
        capabilities: { canUnfreeze: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
    }));

    expect(unfrozen).not.toContain('Analysis workbench');
    expect(frozen).toContain('Opened book: Frozen workbench book');
    expect(frozen).toContain('Frozen structure');
    expect(frozen).toContain('Analysis workbench');
    expect(frozen).toContain('Run analysis');
    expect(frozen).toContain('Rerun module');
    expect(frozen).toContain('View rerun diff');
    expect(frozen).not.toContain('#/modules');
  });

  it('shows module loading and stable query errors only after the Book is frozen', () => {
    const baseProps = {
      library,
      books: [book],
      importPending: false,
      lastImport: null,
      failure: null,
      openedBook: book,
      structureWorkspace: {
        bookId,
        latestDetectionRun: null,
        candidate: null,
        draft: null,
        frozen: { id: 'frozen-1', structureEdition: 1, nodes: [], storyRanges: [] },
        capabilities: { canUnfreeze: true, blockers: [] },
      } as unknown as import('../../src/shared/contracts/structure').StructureWorkspace,
      structureLoading: false,
      structureActionPending: false,
      structureError: null,
      jobRecovery: emptyJobRecovery,
      onImport: vi.fn(), onOpenBook: vi.fn(), onDetectStructure: vi.fn(),
      onRecoverStructureDetection: vi.fn(), onCreateStructureDraft: vi.fn(),
      onCreateManualStructureDraft: vi.fn(), onUpdateStructureNode: vi.fn(),
      onUpdateStructureRange: vi.fn(), onDiscardStructureDraft: vi.fn(),
      onFreezeStructure: vi.fn(), onUnfreezeStructure: vi.fn(), onFailureAction: vi.fn(),
    } as const;
    const loading = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      ...baseProps,
      moduleInstancesLoading: true,
    }));
    const error = renderToStaticMarkup(createElement(BreakdownShelfRoute, {
      ...baseProps,
      moduleInstancesLoading: false,
      moduleInstancesError: 'The seven book-scope module instances are incomplete.',
    }));

    expect(loading).toContain('Loading module instances…');
    expect(loading).toContain('role="status"');
    expect(error).toContain('The seven book-scope module instances are incomplete.');
    expect(error).toContain('role="alert"');
  });
});
