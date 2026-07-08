import type { ReactElement } from 'react';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SCOPE_EXCLUDED_TARGETS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
  TECHNIQUE_ASSET_OWNERSHIP,
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
} from '../shared/domain';
import { rendererText } from './i18n';

export function App(): ReactElement {
  const readoutText = rendererText.analysisContractReadout;
  const techniqueReadoutText = rendererText.techniqueLibraryContractReadout;
  const aiConstraintSummary = ANALYSIS_SECONDARY_SYSTEM_PAGES[0];
  const techniqueEntryOwnership = TECHNIQUE_ASSET_OWNERSHIP.techniqueEntry;
  const techniqueEvidencePolicy = TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry;
  const manualCreatePolicy = TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY;

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="empty-state" aria-describedby="library-state">
        <p className="eyebrow">{rendererText.appName}</p>
        <h1 id="app-title">{rendererText.emptyLibrary.title}</h1>
        <p id="library-state">{rendererText.emptyLibrary.description}</p>
      </section>

      <section
        className="analysis-contract-readout"
        aria-labelledby="analysis-contract-title"
        data-contract-source="shared-domain-analysis"
      >
        <div className="readout-header">
          <div>
            <p className="eyebrow">{readoutText.source}</p>
            <h2 id="analysis-contract-title">{readoutText.title}</h2>
          </div>
          <p className="module-count">
            {ANALYSIS_MODULE_DEFINITIONS.length} {readoutText.moduleCountSuffix}
          </p>
        </div>

        <ul className="module-list" aria-label={readoutText.title}>
          {ANALYSIS_MODULE_DEFINITIONS.map((moduleDefinition) => (
            <li className="module-card" key={moduleDefinition.key}>
              <span className="module-name">{moduleDefinition.name}</span>
              <code>{moduleDefinition.key}</code>
              <span className="module-category">
                {readoutText.categoryLabels[moduleDefinition.category]}
              </span>
            </li>
          ))}
        </ul>

        <article className="secondary-system-page" aria-disabled="true">
          <div>
            <p className="readout-label">{readoutText.secondarySystemPage}</p>
            <h3>{aiConstraintSummary.name}</h3>
            <code>{aiConstraintSummary.key}</code>
          </div>
          <span className="disabled-placeholder">{readoutText.disabledPlaceholder}</span>
        </article>

        <section className="scope-exclusions" aria-labelledby="unsupported-scope-title">
          <h3 id="unsupported-scope-title">{readoutText.unsupportedScopeTitle}</h3>
          <ul>
            {ANALYSIS_SCOPE_EXCLUDED_TARGETS.map((excludedTarget) => (
              <li key={`${excludedTarget.targetKey}:${excludedTarget.attemptedScope}`}>
                <div className="scope-exclusion-meta">
                  <code>{excludedTarget.targetKey}</code>
                  <span>{excludedTarget.attemptedScope}</span>
                </div>
                <p>{excludedTarget.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section
        className="technique-library-readout"
        aria-labelledby="technique-library-contract-title"
        data-contract-source="shared-domain-technique"
      >
        <div className="readout-header">
          <div>
            <p className="eyebrow">{techniqueReadoutText.source}</p>
            <h2 id="technique-library-contract-title">{techniqueReadoutText.title}</h2>
          </div>
          <span className="disabled-placeholder">
            {techniqueReadoutText.manualActionUnavailable}
          </span>
        </div>

        <div className="technique-readout-grid">
          <article className="technique-empty-readout" aria-disabled="true">
            <p className="readout-label">{techniqueReadoutText.emptyStateLabel}</p>
            <h3>{manualCreatePolicy.emptyStateCopyText}</h3>
            <p>
              {techniqueReadoutText.ownerBoundaryPrefix}{' '}
              <code>{techniqueEntryOwnership.ownerKind}</code>,{' '}
              {techniqueReadoutText.ownerBoundarySuffix}
            </p>
          </article>

          <article className="technique-detail-shell" aria-disabled="true">
            <div>
              <p className="readout-label">{techniqueReadoutText.provenancePosition}</p>
              <h3>{techniqueReadoutText.detailShellTitle}</h3>
            </div>
            <dl>
              <div>
                <dt>{techniqueReadoutText.snapshotFieldLabel}</dt>
                <dd>
                  <code>{techniqueEvidencePolicy.sourceSnapshotField}</code>
                </dd>
              </div>
              <div>
                <dt>{techniqueReadoutText.evidenceSummaryLabel}</dt>
                <dd>
                  <code>{techniqueEvidencePolicy.evidenceSummarySource}</code>
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <p className="blocked-flow-note">
          {manualCreatePolicy.futureManualCreateRequiresProductDecision
            ? techniqueReadoutText.futureManualDecision
            : techniqueReadoutText.manualActionUnavailable}
        </p>
      </section>
    </main>
  );
}
