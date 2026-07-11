import {
  useEffect,
  useState,
  type ReactElement,
} from 'react';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SCOPE_EXCLUDED_TARGETS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
  PERSPECTIVE_DEFINITIONS,
  PERSPECTIVE_IDENTITY_CONTRACT,
  PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES,
  TECHNIQUE_ASSET_OWNERSHIP,
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
} from '../shared/domain';
import type { BookSummary, ImportSourceResult, LibrarySummary } from '../shared/contracts';
import type { ContractRequest } from '../shared/contracts';
import { rendererText } from './i18n';
import {
  createSourceImportFailureViewModel,
  SourceImportFailurePanel,
  type SourceImportFailureAction,
  type SourceImportFailureViewModel,
} from './source-import-failure';

type LibraryAction = 'create' | 'open';

export function App(): ReactElement {
  const [currentLibrary, setCurrentLibrary] = useState<LibrarySummary | null>(null);
  const [pendingLibraryAction, setPendingLibraryAction] = useState<LibraryAction | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [pendingSourceImport, setPendingSourceImport] = useState(false);
  const [sourceImportResults, setSourceImportResults] = useState<ImportSourceResult[]>([]);
  const [sourceImportFailure, setSourceImportFailure] = useState<SourceImportFailureViewModel | null>(null);
  const [openedBook, setOpenedBook] = useState<BookSummary | null>(null);
  const readoutText = rendererText.analysisContractReadout;
  const techniqueReadoutText = rendererText.techniqueLibraryContractReadout;
  const perspectiveReadoutText = rendererText.perspectiveContractReadout;
  const aiConstraintSummary = ANALYSIS_SECONDARY_SYSTEM_PAGES[0];
  const techniqueEntryOwnership = TECHNIQUE_ASSET_OWNERSHIP.techniqueEntry;
  const techniqueEvidencePolicy = TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry;
  const manualCreatePolicy = TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let isMounted = true;

    void window.writestorm.library.getCurrent()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        if (response.ok) {
          setCurrentLibrary(response.data);
          setSourceImportResults([]);
          setSourceImportFailure(null);
          setOpenedBook(null);
          setLibraryError(null);
        } else {
          setLibraryError(response.error.message);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLibraryError(rendererText.emptyLibrary.actionError);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLibraryAction = async (action: LibraryAction): Promise<void> => {
    setPendingLibraryAction(action);
    setLibraryError(null);

    try {
      const response = action === 'create'
        ? await window.writestorm.library.create()
        : await window.writestorm.library.open();

      if (response.ok) {
        setCurrentLibrary(response.data);
        setSourceImportResults([]);
        setSourceImportFailure(null);
        setOpenedBook(null);
      } else {
        setLibraryError(response.error.message);
      }
    } catch {
      setLibraryError(rendererText.emptyLibrary.actionError);
    } finally {
      setPendingLibraryAction(null);
    }
  };

  const runSourceImport = async (
    request: ContractRequest<'books:import-source'>,
  ): Promise<void> => {
    setPendingSourceImport(true);
    setSourceImportFailure(null);

    try {
      const response = await window.writestorm.books.importSource(request);

      if (response.ok) {
        setSourceImportResults((results) => [...results, response.data]);
      } else {
        setSourceImportFailure(createSourceImportFailureViewModel(response.error));
      }
    } catch {
      setSourceImportFailure(createSourceImportFailureViewModel({
        code: 'IMPORT_ERROR',
        message: rendererText.sourceImport.actionError,
        recoverable: true,
        details: {
          reason: 'database_write_failed',
        },
      }));
    } finally {
      setPendingSourceImport(false);
    }
  };

  const handleSourceImport = async (): Promise<void> => runSourceImport({});

  const handleSourceImportFailureAction = async (action: SourceImportFailureAction): Promise<void> => {
    switch (action.kind) {
      case 'open_library':
        await handleLibraryAction('open');
        return;
      case 'choose_file':
      case 'choose_smaller_file':
      case 'retry_import':
        await handleSourceImport();
        return;
      case 'retry_encoding':
        await runSourceImport({
          pendingImportId: action.pendingImportId,
          encodingOverride: action.encodingOverride,
        });
        return;
      case 'open_existing_book': {
        setPendingSourceImport(true);
        try {
          const response = await window.writestorm.books.list();
          if (!response.ok) {
            setSourceImportFailure(createSourceImportFailureViewModel(response.error));
            return;
          }

          const existingBook = response.data.find((book) => book.id === action.existingBookId);
          if (!existingBook) {
            setSourceImportFailure(createSourceImportFailureViewModel({
              code: 'IMPORT_ERROR',
              message: rendererText.sourceImport.failure.existingBookNotFound,
              recoverable: true,
              details: { reason: 'database_write_failed' },
            }));
            return;
          }

          setOpenedBook(existingBook);
          setSourceImportFailure(null);
        } catch {
          setSourceImportFailure(createSourceImportFailureViewModel({
            code: 'IMPORT_ERROR',
            message: rendererText.sourceImport.actionError,
            recoverable: true,
            details: { reason: 'database_write_failed' },
          }));
        } finally {
          setPendingSourceImport(false);
        }
      }
    }
  };

  return (
    <main className="app-shell" aria-labelledby="app-title">
      {currentLibrary ? (
        <section className="library-shelf" aria-labelledby="app-title">
          <p className="eyebrow">{rendererText.libraryShelf.eyebrow}</p>
          <h1 id="app-title">{rendererText.libraryShelf.title}</h1>
          <div className="library-summary" aria-label={currentLibrary.name}>
            <div>
              <p className="readout-label">{currentLibrary.name}</p>
              <span className="library-path-label">{rendererText.libraryShelf.rootPathLabel}</span>
              <code>{currentLibrary.rootPath}</code>
            </div>
            <dl>
              <div>
                <dt>{rendererText.libraryShelf.schemaVersionLabel}</dt>
                <dd>{currentLibrary.schemaVersion}</dd>
              </div>
              <div>
                <dt>{rendererText.libraryShelf.appVersionLabel}</dt>
                <dd>{currentLibrary.appVersion}</dd>
              </div>
            </dl>
          </div>
          <section className="breakdown-empty-shelf" aria-labelledby="empty-breakdown-shelf-title">
            <div className="breakdown-shelf-header">
              <h2 id="empty-breakdown-shelf-title">
                {sourceImportResults.length > 0
                  ? rendererText.libraryShelf.importedTitle
                  : rendererText.libraryShelf.emptyTitle}
              </h2>
              <button
                type="button"
                onClick={() => void handleSourceImport()}
                disabled={pendingSourceImport}
              >
                {rendererText.sourceImport.button}
              </button>
            </div>
            {sourceImportFailure ? (
              <SourceImportFailurePanel
                failure={sourceImportFailure}
                onAction={(action) => void handleSourceImportFailureAction(action)}
              />
            ) : null}
            {openedBook ? (
              <p className="opened-book-status" role="status">
                {rendererText.libraryShelf.openedBookStatus(openedBook.title)}
              </p>
            ) : null}
            {sourceImportResults.length > 0 ? (
              <ul className="book-list" aria-label={rendererText.libraryShelf.importedTitle}>
                {sourceImportResults.map((result) => (
                  <li key={result.book.id}>
                    <strong>{result.book.title}</strong>
                    <span>{result.sourceText.fileName}</span>
                    <span>{result.job.checkpointSummary}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>
      ) : (
        <>
          <section className="empty-state" aria-describedby="library-state">
            <p className="eyebrow">{rendererText.appName}</p>
            <h1 id="app-title">{rendererText.emptyLibrary.title}</h1>
            <p id="library-state">{rendererText.emptyLibrary.description}</p>
            <div className="library-actions" aria-label={rendererText.emptyLibrary.actionsLabel}>
              <button
                type="button"
                onClick={() => void handleLibraryAction('create')}
                disabled={pendingLibraryAction !== null}
              >
                {rendererText.emptyLibrary.createButton}
              </button>
              <button
                type="button"
                onClick={() => void handleLibraryAction('open')}
                disabled={pendingLibraryAction !== null}
              >
                {rendererText.emptyLibrary.openButton}
              </button>
            </div>
            {libraryError ? <p className="library-error" role="alert">{libraryError}</p> : null}
          </section>

          <section
            className="analysis-contract-readout"
            aria-labelledby="analysis-contract-title"
            data-contract-source="shared-domain-analysis"
          >
            <div className="readout-header">
              <div>
                <p className="eyebrow">{readoutText.source}</p>
                <h2 id="analysis-contract-title">{readoutText.title}</h2>
              </div>
              <p className="module-count">
                {ANALYSIS_MODULE_DEFINITIONS.length} {readoutText.moduleCountSuffix}
              </p>
            </div>

            <ul className="module-list" aria-label={readoutText.title}>
              {ANALYSIS_MODULE_DEFINITIONS.map((moduleDefinition) => (
                <li className="module-card" key={moduleDefinition.key}>
                  <span className="module-name">{moduleDefinition.name}</span>
                  <code>{moduleDefinition.key}</code>
                  <span className="module-category">
                    {readoutText.categoryLabels[moduleDefinition.category]}
                  </span>
                </li>
              ))}
            </ul>

            <article className="secondary-system-page" aria-disabled="true">
              <div>
                <p className="readout-label">{readoutText.secondarySystemPage}</p>
                <h3>{aiConstraintSummary.name}</h3>
                <code>{aiConstraintSummary.key}</code>
              </div>
              <span className="disabled-placeholder">{readoutText.disabledPlaceholder}</span>
            </article>

            <section className="scope-exclusions" aria-labelledby="unsupported-scope-title">
              <h3 id="unsupported-scope-title">{readoutText.unsupportedScopeTitle}</h3>
              <ul>
                {ANALYSIS_SCOPE_EXCLUDED_TARGETS.map((excludedTarget) => (
                  <li key={`${excludedTarget.targetKey}:${excludedTarget.attemptedScope}`}>
                    <div className="scope-exclusion-meta">
                      <code>{excludedTarget.targetKey}</code>
                      <span>{excludedTarget.attemptedScope}</span>
                    </div>
                    <p>{excludedTarget.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <section
            className="perspective-contract-readout"
            aria-labelledby="perspective-contract-title"
            data-contract-source="shared-domain-perspective"
          >
            <div className="readout-header">
              <div>
                <p className="eyebrow">{perspectiveReadoutText.source}</p>
                <h2 id="perspective-contract-title">{perspectiveReadoutText.title}</h2>
              </div>
              <p className="module-count">
                {PERSPECTIVE_DEFINITIONS.length} {perspectiveReadoutText.viewCountSuffix}
              </p>
            </div>

            <ul className="perspective-list" aria-label={perspectiveReadoutText.title}>
              {PERSPECTIVE_DEFINITIONS.map((perspectiveDefinition) => (
                <li className="perspective-card" key={perspectiveDefinition.key} aria-disabled="true">
                  <span className="module-name">{perspectiveDefinition.name}</span>
                  <code>{perspectiveDefinition.key}</code>
                  <span className="module-category">{perspectiveReadoutText.boundaryLabel}</span>
                </li>
              ))}
            </ul>

            <div className="perspective-readout-grid">
              <article className="perspective-boundary-shell" aria-disabled="true">
                <p className="readout-label">{perspectiveReadoutText.blockedShellLabel}</p>
                <h3>{perspectiveReadoutText.boundaryLabel}</h3>
                <dl>
                  <div>
                    <dt>{perspectiveReadoutText.viewKindLabel}</dt>
                    <dd>
                      <code>{PERSPECTIVE_IDENTITY_CONTRACT.definitionKind}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{perspectiveReadoutText.scopeMeaningLabel}</dt>
                    <dd>
                      <code>{PERSPECTIVE_IDENTITY_CONTRACT.scopeRefMeaning}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{perspectiveReadoutText.factSourceLabel}</dt>
                    <dd>{PERSPECTIVE_IDENTITY_CONTRACT.isFactSource ? 'fact source' : 'not a fact source'}</dd>
                  </div>
                </dl>
              </article>

              <section className="perspective-status-shell" aria-labelledby="perspective-status-title">
                <h3 id="perspective-status-title">{perspectiveReadoutText.dependencyStatusTitle}</h3>
                <ul>
                  {PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES.map((fixture) => (
                    <li key={`${fixture.perspectiveKey}:${fixture.missingAssetKind}`}>
                      <div>
                        <code>{fixture.perspectiveKey}</code>
                        <span className="status-pill">{fixture.displayStatus}</span>
                      </div>
                      <p>
                        {perspectiveReadoutText.missingAssetLabel}: <code>{fixture.missingAssetKind}</code>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>

          <section
            className="technique-library-readout"
            aria-labelledby="technique-library-contract-title"
            data-contract-source="shared-domain-technique"
          >
            <div className="readout-header">
              <div>
                <p className="eyebrow">{techniqueReadoutText.source}</p>
                <h2 id="technique-library-contract-title">{techniqueReadoutText.title}</h2>
              </div>
              <span className="disabled-placeholder">
                {techniqueReadoutText.manualActionUnavailable}
              </span>
            </div>

            <div className="technique-readout-grid">
              <article className="technique-empty-readout" aria-disabled="true">
                <p className="readout-label">{techniqueReadoutText.emptyStateLabel}</p>
                <h3>{manualCreatePolicy.emptyStateCopyText}</h3>
                <p>
                  {techniqueReadoutText.ownerBoundaryPrefix}{' '}
                  <code>{techniqueEntryOwnership.ownerKind}</code>,{' '}
                  {techniqueReadoutText.ownerBoundarySuffix}
                </p>
              </article>

              <article className="technique-detail-shell" aria-disabled="true">
                <div>
                  <p className="readout-label">{techniqueReadoutText.provenancePosition}</p>
                  <h3>{techniqueReadoutText.detailShellTitle}</h3>
                </div>
                <dl>
                  <div>
                    <dt>{techniqueReadoutText.snapshotFieldLabel}</dt>
                    <dd>
                      <code>{techniqueEvidencePolicy.sourceSnapshotField}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{techniqueReadoutText.evidenceSummaryLabel}</dt>
                    <dd>
                      <code>{techniqueEvidencePolicy.evidenceSummarySource}</code>
                    </dd>
                  </div>
                </dl>
              </article>
            </div>

            <p className="blocked-flow-note">
              {manualCreatePolicy.futureManualCreateRequiresProductDecision
                ? techniqueReadoutText.futureManualDecision
                : techniqueReadoutText.manualActionUnavailable}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
