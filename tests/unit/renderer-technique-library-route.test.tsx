import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveAppRoute } from '../../src/renderer/app/AppRouter';
import { ProductNavigation } from '../../src/renderer/components/ProductNavigation';
import { TechniqueLibraryRoute } from '../../src/renderer/routes/TechniqueLibraryRoute';
import type { LibrarySessionSummary } from '../../src/shared/contracts';
import {
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
  TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY,
  type LibraryId,
} from '../../src/shared/domain';

const library: LibrarySessionSummary = {
  sessionId: '00000000-0000-4000-8000-000000000012',
  library: {
    id: 'library-block-12' as LibraryId,
    name: 'Block 12 Library',
    rootPath: 'C:\\Libraries\\Block12',
    schemaVersion: 5,
    appVersion: '0.1.0-test',
  },
};

describe('renderer technique library product route', () => {
  it('exposes a natural product navigation entry', () => {
    const markup = renderToStaticMarkup(<ProductNavigation activeRoute="techniques" />);

    expect(resolveAppRoute('#/techniques')).toBe('techniques');
    expect(markup).toContain('aria-label="Product navigation"');
    expect(markup).toContain('href="#/techniques"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Technique library');
    expect(markup).toContain('Breakdown shelf');
  });

  it('renders a truthful empty state without fake entries or manual creation', () => {
    const markup = renderToStaticMarkup(<TechniqueLibraryRoute library={library} />);

    expect(markup).toContain('Technique library');
    expect(markup).toContain('Block 12 Library');
    expect(markup).toContain(TECHNIQUE_LIBRARY_MANUAL_CREATE_POLICY.emptyStateCopyText);
    expect(markup).toContain('future adopted reusable-technique candidates');
    expect(markup).toContain('No TechniqueEntry persistence or adoption producer is admitted yet.');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('Edit technique');
    expect(markup).not.toContain('Create technique');
    expect(markup).not.toContain('technique-entry-1');
    expect(markup).not.toContain('candidate-1');
  });

  it('explains why editing is unavailable without exposing an edit form', () => {
    const markup = renderToStaticMarkup(<TechniqueLibraryRoute library={library} />);

    expect(markup).toContain('Editing unavailable');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain(
      'TechniqueEntry persistence and the adopted-candidate adoption transaction are not admitted.',
    );
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('<textarea');
    expect(markup).not.toContain('<select');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('Save technique');
  });

  it('shows the SourceSnapshot contract position and readonly boundary without an instance', () => {
    const markup = renderToStaticMarkup(<TechniqueLibraryRoute library={library} />);
    const policy = TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry;

    expect(markup).toContain('SourceSnapshot contract');
    expect(markup).toContain('data-contract-source="shared-domain-technique"');
    expect(markup).toContain('Future TechniqueEntry detail · secondary provenance information');
    expect(markup).toContain(policy.sourceSnapshotField);
    expect(markup).toContain(policy.evidenceSummarySource);
    expect(markup).toContain('Read-only · no write-back');
    expect(markup).toContain(
      'Technique Library never updates source observations, candidates, EvidenceAnchors, review state, or the source Breakdown Book.',
    );
    expect(markup).toContain('No SourceSnapshot instance is available in this blocked state.');
    expect(markup).not.toContain('sourceBookId');
    expect(markup).not.toContain('sourceCandidateId');
    expect(markup).not.toContain('sourceObservationIds');
    expect(markup).not.toContain('capturedAt');
    expect(markup).not.toContain('readonly_source_trace');
  });

  it('shows a natively disabled adoption affordance with an accessibility-linked reason', () => {
    const markup = renderToStaticMarkup(<TechniqueLibraryRoute library={library} />);

    expect(markup).toContain('Adopt confirmed candidate');
    expect(markup).toContain('<button');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-describedby="technique-adoption-disabled-reason"');
    expect(markup).toContain('id="technique-adoption-disabled-reason"');
    expect(markup).toContain(
      'Unavailable: the reusable-candidate owner, confirmed-candidate query, and atomic adoption transaction are not admitted.',
    );
    expect(markup).not.toContain('candidate-1');
  });

  it('keeps adoption outside the component API and source event boundary', () => {
    const source = readFileSync('src/renderer/routes/TechniqueLibraryRoute.tsx', 'utf8');

    expect(source).toContain('readonly library: LibrarySessionSummary');
    expect(source).not.toMatch(/readonly onAdopt|readonly onAction|readonly onClick/);
    expect(source).not.toMatch(/onClick=|onAdopt=|onAction=/);
  });
});
