import type { ReactElement } from 'react';
import type {
  BookSummary,
  ContractRequest,
  ImportSourceResult,
  LibrarySessionSummary,
  ModuleInstanceSummary,
  ExportStatusDto,
} from '../../shared/contracts';
import type {
  TypeLibraryPinnedOption,
  TypeLibraryReleaseOptions,
} from '../../shared/domain';
import { rendererText } from '../i18n';
import {
  SourceImportFailurePanel,
  type SourceImportFailureAction,
  type SourceImportFailureViewModel,
} from '../features/breakdown-shelf/source-import-failure';
import { StructureReviewPanel } from '../features/structure-review/StructureReviewPanel';
import type { StructureWorkspace } from '../../shared/contracts/structure';
import { AnalysisModuleWorkbench } from '../features/module-workbench/AnalysisModuleWorkbench';
import {
  JobRecoveryPanel,
  type JobRecoveryPanelProps,
} from '../features/job-recovery/JobRecoveryPanel';
import { ExportStatusPanel } from '../features/export-status/ExportStatusPanel';
import {
  TypeLibraryBindingEditor,
  type TypeLibrarySelectionValue,
} from '../features/type-library/TypeLibraryBindingEditor';

export type LastImportPresentation = {
  readonly sessionId: string;
  readonly result: ImportSourceResult;
};

export type BreakdownShelfRouteProps = {
  readonly library: LibrarySessionSummary;
  readonly books: readonly BookSummary[];
  readonly importPending: boolean;
  readonly lastImport: LastImportPresentation | null;
  readonly failure: SourceImportFailureViewModel | null;
  readonly openedBook: BookSummary | null;
  readonly exportStatus?: ExportStatusDto | null;
  readonly exportStatusLoading?: boolean;
  readonly exportStatusError?: string | null;
  readonly structureWorkspace: StructureWorkspace | null;
  readonly structureLoading: boolean;
  readonly structureActionPending: boolean;
  readonly structureError: string | null;
  readonly moduleInstances?: readonly ModuleInstanceSummary[];
  readonly moduleInstancesLoading?: boolean;
  readonly moduleInstancesError?: string | null;
  readonly jobRecovery: JobRecoveryPanelProps;
  readonly typeLibrary?: {
    readonly options: TypeLibraryReleaseOptions | null;
    readonly openedBookOptions: TypeLibraryReleaseOptions | null;
    readonly openedBookPinnedOptions: readonly TypeLibraryPinnedOption[];
    readonly optionsError: string | null;
    readonly importSelection: TypeLibrarySelectionValue;
    readonly openedBookSelection: TypeLibrarySelectionValue;
    readonly bindingPending: boolean;
    readonly bindingError: string | null;
    readonly bindingConflict: boolean;
    readonly onImportSelectionChange: (value: TypeLibrarySelectionValue) => void;
    readonly onOpenedBookSelectionChange: (value: TypeLibrarySelectionValue) => void;
    readonly onSaveOpenedBookBinding: () => void;
    readonly onLoadLatestBookBinding: () => void;
  };
  readonly onImport: (selection?: TypeLibrarySelectionValue) => void;
  readonly onOpenBook: (book: BookSummary) => void;
  readonly onDetectStructure: () => void;
  readonly onRecoverStructureDetection: () => void;
  readonly onCreateStructureDraft: (replacementFrozenSetId?: ContractRequest<'structure:create-draft'>['replacementFrozenSetId']) => void;
  readonly onCreateManualStructureDraft: () => void;
  readonly onUpdateStructureNode: (command: ContractRequest<'structure:update-node'>['command']) => void;
  readonly onUpdateStructureRange: (command: ContractRequest<'structure:update-story-range'>['command']) => void;
  readonly onDiscardStructureDraft: () => void;
  readonly onFreezeStructure: () => void;
  readonly onUnfreezeStructure: () => void;
  readonly onFailureAction: (action: SourceImportFailureAction) => void;
};

export function BreakdownShelfRoute(props: BreakdownShelfRouteProps): ReactElement {
  const hasBooks = props.books.length > 0;

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="library-shelf" aria-labelledby="app-title">
        <p className="eyebrow">{rendererText.libraryShelf.eyebrow}</p>
        <h1 id="app-title">{rendererText.libraryShelf.title}</h1>
        <div className="library-summary" aria-label={props.library.library.name}>
          <div>
            <p className="readout-label">{props.library.library.name}</p>
            <span className="library-path-label">{rendererText.libraryShelf.rootPathLabel}</span>
            <code>{props.library.library.rootPath}</code>
          </div>
          <dl>
            <div>
              <dt>{rendererText.libraryShelf.schemaVersionLabel}</dt>
              <dd>{props.library.library.schemaVersion}</dd>
            </div>
            <div>
              <dt>{rendererText.libraryShelf.appVersionLabel}</dt>
              <dd>{props.library.library.appVersion}</dd>
            </div>
          </dl>
        </div>
        <section className="breakdown-empty-shelf" aria-labelledby="empty-breakdown-shelf-title">
          <div className="breakdown-shelf-header">
            <h2 id="empty-breakdown-shelf-title">
              {hasBooks ? rendererText.libraryShelf.importedTitle : rendererText.libraryShelf.emptyTitle}
            </h2>
            <button
              type="button"
              onClick={() => props.onImport(props.typeLibrary?.importSelection)}
              disabled={props.importPending}
            >
              {rendererText.sourceImport.button}
            </button>
          </div>
          {props.typeLibrary ? (
            <TypeLibraryBindingEditor
              idPrefix="import-classification"
              title={rendererText.typeLibraryBinding.optionalImportTitle}
              options={props.typeLibrary.options}
              value={props.typeLibrary.importSelection}
              pending={props.importPending}
              error={props.typeLibrary.optionsError}
              onChange={props.typeLibrary.onImportSelectionChange}
            />
          ) : null}
          {props.failure ? (
            <SourceImportFailurePanel failure={props.failure} onAction={props.onFailureAction} />
          ) : null}
          {props.openedBook ? (
            <p className="opened-book-status" role="status">
              {rendererText.libraryShelf.openedBookStatus(props.openedBook.title)}
            </p>
          ) : null}
          {hasBooks ? (
            <ul className="book-list" aria-label={rendererText.libraryShelf.importedTitle}>
              {props.books.map((book) => (
                <li key={book.id}>
                  <strong>{book.title}</strong>
                  <span className="book-classification-summary">
                    {book.mainTypeDisplayName ?? rendererText.typeLibraryBinding.mainTypeUnassigned}
                    {book.contentFocusDisplayNames.length > 0
                      ? ` · ${book.contentFocusDisplayNames.join(' → ')}` : ''}
                  </span>
                  <button type="button" onClick={() => props.onOpenBook(book)}>
                    {rendererText.libraryShelf.reviewStructure}
                  </button>
                  {props.lastImport?.sessionId === props.library.sessionId &&
                  props.lastImport.result.book.id === book.id ? (
                    <>
                      <span>{props.lastImport.result.sourceText.fileName}</span>
                      <span>{props.lastImport.result.job.checkpointSummary}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <JobRecoveryPanel
          {...props.jobRecovery}
          bookTitles={Object.fromEntries(props.books.map((book) => [book.id, book.title]))}
        />
        {props.openedBook && props.typeLibrary ? (
          <TypeLibraryBindingEditor
            idPrefix="book-classification"
            title={rendererText.typeLibraryBinding.bookMetadataTitle}
            options={props.typeLibrary.openedBookOptions}
            pinnedOptions={props.typeLibrary.openedBookPinnedOptions}
            value={props.typeLibrary.openedBookSelection}
            pending={props.typeLibrary.bindingPending}
            error={props.typeLibrary.bindingError}
            conflict={props.typeLibrary.bindingConflict}
            onChange={props.typeLibrary.onOpenedBookSelectionChange}
            onSave={props.typeLibrary.onSaveOpenedBookBinding}
            onLoadLatest={props.typeLibrary.onLoadLatestBookBinding}
          />
        ) : null}
        {props.openedBook ? (
          <>
            <ExportStatusPanel
              status={props.exportStatus ?? null}
              loading={props.exportStatusLoading ?? props.exportStatus === undefined}
              error={props.exportStatusError ?? null}
            />
            <StructureReviewPanel
              book={props.openedBook}
              workspace={props.structureWorkspace}
              loading={props.structureLoading}
              actionPending={props.structureActionPending}
              error={props.structureError}
              onDetect={props.onDetectStructure}
              onRecoverDetection={props.onRecoverStructureDetection}
              onCreateDraft={props.onCreateStructureDraft}
              onCreateManualDraft={props.onCreateManualStructureDraft}
              onUpdateNode={props.onUpdateStructureNode}
              onUpdateRange={props.onUpdateStructureRange}
              onDiscardDraft={props.onDiscardStructureDraft}
              onFreeze={props.onFreezeStructure}
              onUnfreeze={props.onUnfreezeStructure}
            />
            {props.structureWorkspace?.frozen ? (
              props.moduleInstancesLoading ? (
                <p className="analysis-workbench-state" role="status">
                  {rendererText.moduleWorkbench.loading}
                </p>
              ) : props.moduleInstancesError ? (
                <p className="analysis-workbench-error" role="alert">
                  {props.moduleInstancesError}
                </p>
              ) : props.moduleInstances ? (
                <AnalysisModuleWorkbench instances={props.moduleInstances} />
              ) : null
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
