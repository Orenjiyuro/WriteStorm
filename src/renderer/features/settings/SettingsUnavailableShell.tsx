import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  UNKNOWN_AI_CONNECTION_CHECK_DATA,
  type WritestormApi,
} from '../../../shared/contracts';
import { rendererText } from '../../i18n';
import {
  AiConnectionCheckViewController,
  type AiConnectionCheckViewState,
} from './ai-connection-check-view-state';

const placeholderKeys = ['templates', 'schemas', 'repair', 'health'] as const;

export function SettingsUnavailableShell(props: {
  readonly api?: Pick<WritestormApi, 'ai'> | null;
}): ReactElement {
  const [connection, setConnection] = useState<AiConnectionCheckViewState>({
    pending: false,
    data: UNKNOWN_AI_CONNECTION_CHECK_DATA,
    failed: false,
  });
  const controller = useRef<AiConnectionCheckViewController | null>(null);
  if (!controller.current && props.api) {
    controller.current = new AiConnectionCheckViewController(
      () => props.api!.ai.checkConnection(),
      setConnection,
    );
  }
  useEffect(() => () => controller.current?.dispose(), []);
  const { gate, compatibility, runtime } = connection.data;
  const text = rendererText.settingsUnavailable;

  return (
    <section className="settings-unavailable-shell" aria-labelledby="settings-ai-title">
      <h2 id="settings-ai-title">{text.title}</h2>
      <article className="ai-connector-status-shell" aria-labelledby="ai-status-title">
        <header>
          <div>
            <p className="readout-label">{text.aiStatusLabel}</p>
            <h3 id="ai-status-title">{text.aiStatusTitle}</h3>
          </div>
          <span className="blocked-status">{text.aiDisabledStatus}</span>
        </header>
        <dl className="ai-connection-state">
          <div>
            <dt>{text.gateLabel}</dt>
            <dd>{formatState(gate.status)}</dd>
          </div>
          <div>
            <dt>{text.feasibilityLabel}</dt>
            <dd>{formatState(gate.feasibility)}</dd>
          </div>
          <div>
            <dt>{text.verdictLabel}</dt>
            <dd>{formatState(gate.overallVerdict)}</dd>
          </div>
          <div>
            <dt>{text.platformLabel}</dt>
            <dd>{formatState(gate.platform)}</dd>
          </div>
          <div>
            <dt>{text.compatibilityLabel}</dt>
            <dd>{formatState(compatibility.state)}</dd>
          </div>
          <div>
            <dt>{text.runtimeLabel}</dt>
            <dd>{formatState(runtime.authState)}</dd>
          </div>
          <div>
            <dt>{text.observedAtLabel}</dt>
            <dd>{runtime.observedAt ?? text.notObserved}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={!props.api || connection.pending}
          onClick={() => void controller.current?.check()}
        >
          {connection.pending ? text.checkingAction : text.checkConnectionAction}
        </button>
        {connection.failed ? <p role="alert">{text.connectionCheckFailed}</p> : null}
        <p>{text.aiDisabledReason}</p>
      </article>

      <section className="settings-placeholder-list" aria-labelledby="settings-placeholders-title">
        <h3 id="settings-placeholders-title">
          {rendererText.settingsUnavailable.placeholdersTitle}
        </h3>
        <ul>
          {placeholderKeys.map((key) => {
            const item = text.placeholders[key];
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

function formatState(value: string): string {
  if (value === 'macos_deferred') return 'macOS deferred';
  return value.split('_').map((part) => (
    part.length === 0 ? part : `${part[0]!.toUpperCase()}${part.slice(1)}`
  )).join(' ');
}
