import type { ReactElement } from 'react';
import { rendererText } from './i18n';

export function App(): ReactElement {
  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="empty-state" aria-describedby="library-state">
        <p className="eyebrow">{rendererText.appName}</p>
        <h1 id="app-title">{rendererText.emptyLibrary.title}</h1>
        <p id="library-state">{rendererText.emptyLibrary.description}</p>
      </section>
    </main>
  );
}
