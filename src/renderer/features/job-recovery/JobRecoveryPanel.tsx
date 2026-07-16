import type { ReactElement } from 'react';
import type { JobDetail, JobSummary } from '../../../shared/contracts';
import {
  JOB_CAPABILITIES,
  canTransitionJob,
  type JobId,
} from '../../../shared/domain';
import { rendererFormats, rendererText } from '../../i18n';

export type JobRecoveryPanelProps = {
  readonly jobs: readonly JobSummary[];
  readonly selectedJobId: JobId | null;
  readonly detail: JobDetail | null;
  readonly loading: boolean;
  readonly detailLoading: boolean;
  readonly error: string | null;
  readonly cancelPending: boolean;
  readonly bookTitles?: Readonly<Record<string, string>>;
  readonly onSelectJob: (jobId: JobId) => void;
  readonly onCancelJob: (jobId: JobId) => void;
};

export function JobRecoveryPanel(props: JobRecoveryPanelProps): ReactElement {
  const text = rendererText.jobRecovery;

  return (
    <section className="job-recovery-panel" aria-labelledby="job-recovery-title">
      <header className="job-recovery-header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2 id="job-recovery-title">{text.title}</h2>
        </div>
        <span>{text.jobCount(props.jobs.length)}</span>
      </header>
      {props.error ? <p className="job-recovery-error" role="alert">{props.error}</p> : null}
      {props.loading ? (
        <p className="job-recovery-state" role="status">{text.loading}</p>
      ) : props.jobs.length === 0 ? (
        <p className="job-recovery-state">{text.empty}</p>
      ) : (
        <div className="job-recovery-layout">
          <JobList {...props} />
          <JobDetailPanel {...props} />
        </div>
      )}
    </section>
  );
}

function JobList(props: JobRecoveryPanelProps): ReactElement {
  const text = rendererText.jobRecovery;
  return (
    <ul className="job-recovery-list" aria-label={text.listLabel}>
      {props.jobs.map((job) => (
        <li key={job.id}>
          <button
            type="button"
            aria-pressed={props.selectedJobId === job.id}
            onClick={() => props.onSelectJob(job.id)}
          >
            <span className="job-recovery-list-title">
              <strong>{job.title}</strong>
              <JobStateBadge state={job.state} />
            </span>
            <span>{formatBook(job.bookId, props.bookTitles)}</span>
            <span>{formatProgress(job)}</span>
            <time dateTime={job.updatedAt}>{rendererFormats.dateTime.format(new Date(job.updatedAt))}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}

function JobDetailPanel(props: JobRecoveryPanelProps): ReactElement {
  const text = rendererText.jobRecovery;
  if (!props.selectedJobId) {
    return <p className="job-recovery-detail-state">{text.selectJob}</p>;
  }
  if (props.detailLoading) {
    return <p className="job-recovery-detail-state" role="status">{text.detailLoading}</p>;
  }
  if (!props.detail || props.detail.id !== props.selectedJobId) {
    return <p className="job-recovery-detail-state">{text.detailUnavailable}</p>;
  }

  const detail = props.detail;
  const capability = JOB_CAPABILITIES[detail.type];
  const canCancel = capability.cancellation === 'runtime_owner_first' &&
    canTransitionJob(detail.state, 'cancelled');
  const showKeepDraft = capability.keepDraft === 'structure_disabled';
  const resumeReasonId = `job-resume-reason-${detail.id}`;
  const keepDraftReasonId = `job-keep-draft-reason-${detail.id}`;

  return (
    <article className="job-recovery-detail" aria-labelledby="job-recovery-detail-title">
      <header>
        <div>
          <p className="readout-label">{text.typeLabels[detail.type]}</p>
          <h3 id="job-recovery-detail-title">{detail.title}</h3>
        </div>
        <JobStateBadge state={detail.state} />
      </header>
      {detail.state === 'failed' || detail.state === 'resumable' ? (
        <p className="job-recovery-notice" role="status">{text.recoveryState(detail.state)}</p>
      ) : null}
      <dl>
        <div><dt>{text.progressLabel}</dt><dd>{formatProgress(detail)}</dd></div>
        <div><dt>{text.updatedLabel}</dt><dd><time dateTime={detail.updatedAt}>{rendererFormats.dateTime.format(new Date(detail.updatedAt))}</time></dd></div>
        <div><dt>{text.bookLabel}</dt><dd>{formatBook(detail.bookId, props.bookTitles)}</dd></div>
      </dl>
      {detail.failureReason ? (
        <section className="job-failure-reason" aria-labelledby="job-failure-reason-title">
          <h4 id="job-failure-reason-title">{text.failureReasonTitle}</h4>
          <code>{detail.failureReason}</code>
        </section>
      ) : null}
      <section className="job-checkpoints" aria-labelledby="job-checkpoints-title">
        <h4 id="job-checkpoints-title">{text.checkpointsTitle}</h4>
        {detail.checkpoints.length === 0 ? <p>{text.noCheckpoints}</p> : (
          <ol>
            {detail.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <strong>{text.checkpointSequence(checkpoint.sequence)}</strong>
                <code>{checkpoint.kind}</code>
                <span>{text.schemaVersion(checkpoint.payloadSchemaVersion)}</span>
                <time dateTime={checkpoint.createdAt}>
                  {rendererFormats.dateTime.format(new Date(checkpoint.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="job-recovery-actions" aria-labelledby="job-recovery-actions-title">
        <h4 id="job-recovery-actions-title">{text.actionsTitle}</h4>
        <ul>
          {canCancel ? (
            <li>
              <button
                type="button"
                disabled={props.cancelPending}
                onClick={() => props.onCancelJob(detail.id)}
              >
                {props.cancelPending ? text.cancelling : text.cancel}
              </button>
            </li>
          ) : null}
          <li>
            <button type="button" disabled aria-describedby={resumeReasonId}>{text.resume}</button>
            <p id={resumeReasonId}>{text.resumeDisabledReason}</p>
          </li>
          {showKeepDraft ? (
            <li>
              <button type="button" disabled aria-describedby={keepDraftReasonId}>{text.keepDraft}</button>
              <p id={keepDraftReasonId}>{text.keepDraftDisabledReason}</p>
            </li>
          ) : null}
        </ul>
      </section>
    </article>
  );
}

function JobStateBadge({ state }: Pick<JobSummary, 'state'>): ReactElement {
  return <span className="job-state-badge" data-state={state}>{rendererText.jobRecovery.stateLabels[state]}</span>;
}

function formatProgress(job: Pick<JobSummary, 'completedUnits' | 'totalUnits'>): string {
  return job.totalUnits === null
    ? rendererText.jobRecovery.unknownTotalProgress(job.completedUnits)
    : rendererText.jobRecovery.knownProgress(job.completedUnits, job.totalUnits);
}

function formatBook(
  bookId: JobSummary['bookId'],
  bookTitles: JobRecoveryPanelProps['bookTitles'],
): string {
  if (bookId === null) return rendererText.jobRecovery.unboundBook;
  return bookTitles?.[bookId] ?? bookId;
}
