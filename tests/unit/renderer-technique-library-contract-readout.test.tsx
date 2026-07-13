import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiagnosticsRoute } from '../../src/renderer/routes/DiagnosticsRoute';
import {
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
} from '../../src/shared/domain';

describe('renderer technique library contract readout', () => {
  it('shows the technique library shell from shared domain contracts', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);

    expect(markup).toContain('Technique library contract readout');
    expect(markup).toContain('Source: shared technique domain contract');
    expect(markup).toContain('data-contract-source="shared-domain-technique"');
    expect(markup).toContain(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopyText);
  });

  it('shows source snapshot as secondary information without fake technique data', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);

    expect(markup).toContain('Source snapshot secondary information');
    expect(markup).toContain(TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry.sourceSnapshotField);
    expect(markup).toContain(TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry.evidenceSummarySource);
    expect(markup).toContain('Read-only provenance position');
    expect(markup).not.toContain('technique-entry-1');
    expect(markup).not.toContain('candidate-1');
  });

  it('does not expose manual create, edit, adopt, or merge actions', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);

    expect(markup).toContain('Manual primary action unavailable');
    expect(markup).toContain('Future manual creation requires a new product decision.');
    expect(markup).not.toContain('Create TechniqueEntry');
    expect(markup).not.toContain('Edit technique');
    expect(markup).not.toContain('Adopt candidate');
    expect(markup).not.toContain('Merge technique');
  });
});
