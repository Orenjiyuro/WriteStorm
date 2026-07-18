import type { ReactElement } from 'react';
import type { LibrarySessionSummary } from '../../shared/contracts';
import {
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
} from '../../shared/domain';
import { rendererText } from '../i18n';

export type TechniqueLibraryRouteProps = {
  readonly library: LibrarySessionSummary;
};

export function TechniqueLibraryRoute(props: TechniqueLibraryRouteProps): ReactElement {
  const sourceSnapshotPolicy = TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry;

  return (
    <main className="app-shell" aria-labelledby="technique-library-title">
      <section className="technique-library">
        <p className="eyebrow">{rendererText.techniqueLibrary.eyebrow}</p>
        <h1 id="technique-library-title">{rendererText.techniqueLibrary.title}</h1>
        <p className="technique-library-context">
          {rendererText.techniqueLibrary.currentLibrary(props.library.library.name)}
        </p>
        <section
          className="technique-library-empty-state"
          aria-labelledby="technique-library-empty-title"
        >
          <h2 id="technique-library-empty-title">
            {TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopyText}
          </h2>
          <p>{rendererText.techniqueLibrary.emptyDescription}</p>
          <p className="technique-library-blocker">
            {rendererText.techniqueLibrary.persistenceBlocker}
          </p>
          <div className="technique-adoption-action">
            <button
              type="button"
              disabled
              aria-describedby="technique-adoption-disabled-reason"
            >
              {rendererText.techniqueLibrary.adoptCandidateButton}
            </button>
            <p id="technique-adoption-disabled-reason">
              {rendererText.techniqueLibrary.adoptCandidateDisabledReason}
            </p>
          </div>
        </section>
        <section
          className="technique-editing-unavailable"
          aria-labelledby="technique-editing-title"
          aria-disabled="true"
        >
          <h2 id="technique-editing-title">
            {rendererText.techniqueLibrary.editingUnavailableTitle}
          </h2>
          <p>{rendererText.techniqueLibrary.editingUnavailableReason}</p>
        </section>
        <section
          className="technique-source-snapshot-contract"
          aria-labelledby="technique-source-snapshot-title"
          data-contract-source="shared-domain-technique"
          data-instance-state="absent"
        >
          <div className="technique-contract-header">
            <div>
              <p className="readout-label">
                {rendererText.techniqueLibrary.sourceSnapshotPositionLabel}
              </p>
              <h2 id="technique-source-snapshot-title">
                {rendererText.techniqueLibrary.sourceSnapshotTitle}
              </h2>
            </div>
            <span className="status-pill">
              {rendererText.techniqueLibrary.sourceSnapshotReadonlyLabel}
            </span>
          </div>
          <p>{rendererText.techniqueLibrary.sourceSnapshotPosition}</p>
          <dl>
            <div>
              <dt>{rendererText.techniqueLibrary.sourceSnapshotFieldLabel}</dt>
              <dd><code>{sourceSnapshotPolicy.sourceSnapshotField}</code></dd>
            </div>
            <div>
              <dt>{rendererText.techniqueLibrary.sourceSnapshotEvidenceLabel}</dt>
              <dd><code>{sourceSnapshotPolicy.evidenceSummarySource}</code></dd>
            </div>
          </dl>
          <p className="technique-source-snapshot-boundary">
            {rendererText.techniqueLibrary.sourceSnapshotReadonlyBoundary}
          </p>
          <p className="technique-source-snapshot-absence">
            {rendererText.techniqueLibrary.sourceSnapshotInstanceAbsent}
          </p>
        </section>
      </section>
    </main>
  );
}
