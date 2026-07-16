import type { ReactElement } from 'react';
import type { ExportStatusDto } from '../../../shared/contracts';
import { rendererText } from '../../i18n';

export type ExportStatusPanelProps = {
  readonly status: ExportStatusDto | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export function ExportStatusPanel(props: ExportStatusPanelProps): ReactElement {
  const text = rendererText.exportStatus;

  return (
    <section className="export-status-panel" aria-labelledby="export-status-title">
      <header className="export-status-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2 id="export-status-title">{text.title}</h2>
        </div>
        <span>{text.notAJob}</span>
      </header>
      {props.error ? (
        <p className="export-status-error" role="alert">{props.error}</p>
      ) : props.loading ? (
        <p className="export-status-state" role="status">{text.loading}</p>
      ) : props.status ? (
        <>
          <div className="export-target-grid">
            {props.status.targets.map((target) => {
              const reasonId = `export-${target.kind}-disabled-reason`;
              return (
                <article className="export-target-card" key={target.kind}>
                  <header>
                    <h3>{text.targetLabels[target.kind]}</h3>
                    <span className="export-availability" data-availability={target.availability}>
                      {text.availabilityLabels[target.availability]}
                    </span>
                  </header>
                  <dl>
                    <div>
                      <dt>{text.structure}</dt>
                      <dd>{target.preview.structure.status === 'frozen'
                        ? text.frozenStructure(target.preview.structure.structureEdition)
                        : text.notFrozenStructure}</dd>
                    </div>
                    <div>
                      <dt>{text.moduleBodies}</dt>
                      <dd>{text.moduleBodiesSummary(
                        target.preview.moduleInstances.nonEmptyBodyCount,
                        target.preview.moduleInstances.actualCount,
                        target.preview.moduleInstances.expectedCount,
                      )}</dd>
                    </div>
                  </dl>
                  <section className="export-blockers" aria-label={text.blockers}>
                    <h4>{text.blockers}</h4>
                    <ul>
                      {target.blockers.map((blocker) => (
                        <li key={blocker}>
                          <span>{text.blockerLabels[blocker]}</span>
                          <code>{blocker}</code>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <button type="button" disabled aria-describedby={reasonId}>
                    {text.execute}
                  </button>
                  <p id={reasonId} className="export-disabled-reason">
                    {text.executionDisabled}
                  </p>
                </article>
              );
            })}
          </div>
          <section className="export-exclusions" aria-labelledby="export-exclusions-title">
            <h3 id="export-exclusions-title">{text.excludedContent}</h3>
            <p>{text.excludedContentDescription}</p>
            <ul>
              {props.status.excludedContent.map((excluded) => (
                <li key={excluded}>
                  <span>{text.excludedContentLabels[excluded]}</span>
                  <code>{excluded}</code>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="export-status-state">{text.unavailable}</p>
      )}
    </section>
  );
}
