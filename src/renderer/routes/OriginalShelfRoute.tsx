import type { ReactElement } from 'react';
import type { LibrarySessionSummary } from '../../shared/contracts';
import { rendererText } from '../i18n';

export type OriginalShelfRouteProps = {
  readonly library: LibrarySessionSummary;
};

export function OriginalShelfRoute(props: OriginalShelfRouteProps): ReactElement {
  return (
    <main className="app-shell original-shelf-route" aria-labelledby="original-shelf-title">
      <section className="original-shelf-page">
        <p className="eyebrow">{rendererText.originalShelf.eyebrow}</p>
        <h1 id="original-shelf-title">{rendererText.originalShelf.title}</h1>
        <p className="original-shelf-context">
          {rendererText.originalShelf.currentLibrary(props.library.library.name)}
        </p>

        <section className="original-shelf-placeholder" aria-labelledby="original-placeholder-title">
          <header>
            <div>
              <p className="readout-label">{rendererText.originalShelf.statusLabel}</p>
              <h2 id="original-placeholder-title">{rendererText.originalShelf.placeholderTitle}</h2>
            </div>
            <span className="blocked-status">{rendererText.originalShelf.placeholderStatus}</span>
          </header>
          <p>{rendererText.originalShelf.placeholderDescription}</p>
          <button
            type="button"
            disabled
            aria-describedby="original-project-create-disabled-reason"
          >
            {rendererText.originalShelf.createAction}
          </button>
          <p id="original-project-create-disabled-reason" className="original-shelf-disabled-reason">
            {rendererText.originalShelf.createDisabledReason}
          </p>
          <aside className="original-shelf-boundary">
            <strong>{rendererText.originalShelf.boundaryTitle}</strong>
            <span>{rendererText.originalShelf.boundaryDescription}</span>
          </aside>
        </section>
      </section>
    </main>
  );
}
