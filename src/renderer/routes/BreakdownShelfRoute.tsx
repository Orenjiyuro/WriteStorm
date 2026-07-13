import type { ReactElement } from 'react';
import type {
  BookSummary,
  ImportSourceResult,
  LibrarySessionSummary,
} from '../../shared/contracts';
import { rendererText } from '../i18n';
import {
  SourceImportFailurePanel,
  type SourceImportFailureAction,
  type SourceImportFailureViewModel,
} from '../features/breakdown-shelf/source-import-failure';

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
  readonly onImport: () => void;
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
            <button type="button" onClick={props.onImport} disabled={props.importPending}>
              {rendererText.sourceImport.button}
            </button>
          </div>
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
      </section>
    </main>
  );
}
