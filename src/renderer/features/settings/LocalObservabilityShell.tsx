import type { ReactElement } from 'react';
import {
  LOCAL_OBSERVABILITY_POLICY,
  LOCAL_OBSERVABILITY_SHELL_STATE,
} from '../../../shared/domain';
import { rendererText } from '../../i18n';

export function LocalObservabilityShell(): ReactElement {
  const text = rendererText.localObservability;

  return (
    <section className="local-observability-shell" aria-labelledby="local-observability-title">
      <header className="local-observability-header">
        <div>
          <p className="readout-label">{text.label}</p>
          <h2 id="local-observability-title">{text.title}</h2>
        </div>
        <span className="blocked-status">{text.localOnlyStatus}</span>
      </header>

      <article className="local-observability-policy" aria-labelledby="local-policy-title">
        <h3 id="local-policy-title">{text.policyTitle}</h3>
        <dl>
          <div>
            <dt>{text.crashReportsLabel}</dt>
            <dd>{LOCAL_OBSERVABILITY_POLICY.remoteUploadByDefault.crashReports
              ? text.uploadedByDefault
              : text.notUploadedByDefault}</dd>
          </div>
          <div>
            <dt>{text.usageStatisticsLabel}</dt>
            <dd>{LOCAL_OBSERVABILITY_POLICY.remoteUploadByDefault.usageStatistics
              ? text.uploadedByDefault
              : text.notUploadedByDefault}</dd>
          </div>
          <div>
            <dt>{text.sourceTextSnippetsLabel}</dt>
            <dd>{text.sourceTextSnippetsValue}</dd>
          </div>
        </dl>
      </article>

      <article className="local-observability-summary" aria-labelledby="recent-error-summary-title">
        <header>
          <h3 id="recent-error-summary-title">{text.recentErrorSummaryTitle}</h3>
          <span>{text.unavailableStatus}</span>
        </header>
        <p>{text.recentErrorSummaryReason}</p>
        <code>{LOCAL_OBSERVABILITY_SHELL_STATE.recentErrorSummary.reasonCode}</code>
      </article>

      <ul className="local-observability-actions" aria-label={text.actionsLabel}>
        <li>
          <button
            type="button"
            disabled
            aria-describedby="clear-local-logs-disabled-reason"
          >
            {text.clearLogsAction}
          </button>
          <p id="clear-local-logs-disabled-reason">
            {text.clearLogsReason}{' '}
            <code>{LOCAL_OBSERVABILITY_SHELL_STATE.clearLogs.reasonCode}</code>
          </p>
        </li>
        <li>
          <button
            type="button"
            disabled
            aria-describedby="manual-log-export-disabled-reason"
          >
            {text.manualExportAction}
          </button>
          <p id="manual-log-export-disabled-reason">
            {text.manualExportReason}{' '}
            <code>{LOCAL_OBSERVABILITY_SHELL_STATE.manualExport.reasonCode}</code>
          </p>
        </li>
      </ul>
    </section>
  );
}
