import type { ReactElement } from 'react';
import { rendererText } from '../../i18n';

const placeholderKeys = ['templates', 'schemas', 'repair', 'health'] as const;

export function SettingsUnavailableShell(): ReactElement {
  return (
    <section className="settings-unavailable-shell" aria-labelledby="settings-ai-title">
      <h2 id="settings-ai-title">{rendererText.settingsUnavailable.title}</h2>
      <article className="ai-connector-status-shell" aria-labelledby="ai-status-title">
        <header>
          <div>
            <p className="readout-label">{rendererText.settingsUnavailable.aiStatusLabel}</p>
            <h3 id="ai-status-title">{rendererText.settingsUnavailable.aiStatusTitle}</h3>
          </div>
          <span className="blocked-status">{rendererText.settingsUnavailable.aiDisabledStatus}</span>
        </header>
        <dl>
          <div>
            <dt>{rendererText.settingsUnavailable.codexGateLabel}</dt>
            <dd>{rendererText.settingsUnavailable.codexGateStatus}</dd>
          </div>
          <div>
            <dt>{rendererText.settingsUnavailable.connectorLabel}</dt>
            <dd>{rendererText.settingsUnavailable.connectorStatus}</dd>
          </div>
        </dl>
        <p>{rendererText.settingsUnavailable.aiDisabledReason}</p>
      </article>

      <section className="settings-placeholder-list" aria-labelledby="settings-placeholders-title">
        <h3 id="settings-placeholders-title">
          {rendererText.settingsUnavailable.placeholdersTitle}
        </h3>
        <ul>
          {placeholderKeys.map((key) => {
            const item = rendererText.settingsUnavailable.placeholders[key];
            const reasonId = `settings-${key}-disabled-reason`;
            return (
              <li key={key} data-settings-placeholder={key}>
                <button type="button" disabled aria-describedby={reasonId}>
                  {item.action}
                </button>
                <p id={reasonId}>{item.reason}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
