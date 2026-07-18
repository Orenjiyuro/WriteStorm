import type { ReactElement } from 'react';
import {
  PROMPT_PUBLICATION_ACTIONS,
  PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
  evaluatePromptPublicationPermission,
} from '../../../shared/domain';
import { rendererText } from '../../i18n';

export function PromptPublicationControlsShell(): ReactElement {
  return (
    <article className="publication-controls-shell" aria-labelledby="publication-controls-title">
      <header>
        <div>
          <p className="readout-label">{rendererText.publicationControls.label}</p>
          <h3 id="publication-controls-title">{rendererText.publicationControls.title}</h3>
        </div>
        <span className="blocked-status">{rendererText.publicationControls.unavailableStatus}</span>
      </header>

      <dl className="publication-state-readout">
        <div>
          <dt>{rendererText.publicationControls.sampleGateLabel}</dt>
          <dd>{rendererText.publicationControls.sampleGateValue}</dd>
        </div>
        <div>
          <dt>{rendererText.publicationControls.publishedVersionLabel}</dt>
          <dd>{rendererText.publicationControls.unavailableStatus}</dd>
        </div>
        <div>
          <dt>{rendererText.publicationControls.activationLabel}</dt>
          <dd>{rendererText.publicationControls.activationValue}</dd>
        </div>
      </dl>

      <ul className="publication-action-list" aria-label={rendererText.publicationControls.actionListLabel}>
        {PROMPT_PUBLICATION_ACTIONS.map((action) => {
          const permission = evaluatePromptPublicationPermission(
            PROMPT_PUBLICATION_CURRENT_SHELL_STATE,
            action,
          );
          const reasonId = `publication-${action}-disabled-reason`;
          return (
            <li key={action}>
              <button type="button" disabled aria-describedby={reasonId}>
                {rendererText.publicationControls.actionLabels[action]}
              </button>
              <p id={reasonId}>{rendererText.publicationControls.actionReasons[action]}</p>
              <ul aria-label={rendererText.publicationControls.blockerListLabels[action]}>
                {permission.blockerCodes.map((code) => (
                  <li key={code}><code>{code}</code></li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="publication-boundary">{rendererText.publicationControls.boundary}</p>
    </article>
  );
}
