import type { ReactElement } from 'react';
import { rendererText } from '../i18n';

export type LibraryAction = 'create' | 'open';

export type NoLibraryRouteProps = {
  readonly pendingAction: LibraryAction | null;
  readonly error: string | null;
  readonly onAction: (action: LibraryAction) => void;
};

export function NoLibraryRoute(props: NoLibraryRouteProps): ReactElement {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="empty-state" aria-describedby="library-state">
        <p className="eyebrow">{rendererText.appName}</p>
        <h1 id="app-title">{rendererText.emptyLibrary.title}</h1>
        <p id="library-state">{rendererText.emptyLibrary.description}</p>
        <div className="library-actions" aria-label={rendererText.emptyLibrary.actionsLabel}>
          <button
            type="button"
            onClick={() => props.onAction('create')}
            disabled={props.pendingAction !== null}
          >
            {rendererText.emptyLibrary.createButton}
          </button>
          <button
            type="button"
            onClick={() => props.onAction('open')}
            disabled={props.pendingAction !== null}
          >
            {rendererText.emptyLibrary.openButton}
          </button>
        </div>
        {props.error ? <p className="library-error" role="alert">{props.error}</p> : null}
      </section>
    </main>
  );
}
