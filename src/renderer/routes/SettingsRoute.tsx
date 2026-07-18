import type { ReactElement } from 'react';
import { PROMPT_SAMPLE_PREVIEW_POLICY } from '../../shared/domain';
import { rendererText } from '../i18n';
import { PromptPublicationControlsShell } from '../features/prompt-template/PromptPublicationControlsShell';
import { LocalObservabilityShell } from '../features/settings/LocalObservabilityShell';
import { SettingsUnavailableShell } from '../features/settings/SettingsUnavailableShell';

export function SettingsRoute(): ReactElement {
  return (
    <main className="app-shell settings-route" aria-labelledby="settings-title">
      <section className="settings-page">
        <p className="eyebrow">{rendererText.settings.eyebrow}</p>
        <h1 id="settings-title">{rendererText.settings.title}</h1>
        <p className="settings-context">{rendererText.settings.context}</p>

        <SettingsUnavailableShell />
        <LocalObservabilityShell />

        <section className="template-settings" aria-labelledby="template-settings-title">
          <h2 id="template-settings-title">{rendererText.settings.templatesTitle}</h2>
          <article className="sample-preview-shell" aria-labelledby="sample-preview-title">
            <header>
              <div>
                <p className="readout-label">{rendererText.samplePreview.label}</p>
                <h3 id="sample-preview-title">{rendererText.samplePreview.title}</h3>
              </div>
              <span className="blocked-status">{rendererText.samplePreview.blockedStatus}</span>
            </header>
            <button
              type="button"
              disabled
              aria-describedby="sample-preview-disabled-reason"
            >
              {rendererText.samplePreview.runAction}
            </button>
            <p id="sample-preview-disabled-reason">
              {rendererText.samplePreview.disabledReason}
            </p>
            <ul aria-label={rendererText.samplePreview.blockerListLabel}>
              {PROMPT_SAMPLE_PREVIEW_POLICY.blockerCodes.map((code) => (
                <li key={code}><code>{code}</code></li>
              ))}
            </ul>
            <aside className="publication-hard-gate">
              <strong>{rendererText.samplePreview.publicationGateTitle}</strong>
              <span>{rendererText.samplePreview.publicationGateDescription}</span>
            </aside>
          </article>
          <PromptPublicationControlsShell />
        </section>
      </section>
    </main>
  );
}
