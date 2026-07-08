import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/App';
import {
  PERSPECTIVE_DEFINITIONS,
  PERSPECTIVE_IDENTITY_CONTRACT,
  PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES,
} from '../../src/shared/domain';

describe('renderer perspective contract readout', () => {
  it('shows the five built-in perspectives as a no-library contract readout', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Perspective contract readout');
    expect(markup).toContain('Source: shared perspective domain contract');
    expect(markup).toContain('data-contract-source="shared-domain-perspective"');
    expect(markup).toContain(`${PERSPECTIVE_DEFINITIONS.length} derived views`);

    for (const perspectiveDefinition of PERSPECTIVE_DEFINITIONS) {
      expect(markup).toContain(perspectiveDefinition.name);
      expect(markup).toContain(perspectiveDefinition.key);
    }
  });

  it('makes the derived-view boundary visible instead of presenting an eighth module', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Derived view, not an AnalysisModule');
    expect(markup).toContain(PERSPECTIVE_IDENTITY_CONTRACT.definitionKind);
    expect(markup).toContain(PERSPECTIVE_IDENTITY_CONTRACT.scopeRefMeaning);
    expect(markup).toContain('not a fact source');
    expect(markup).toContain('7 contract modules');
    expect(markup).not.toContain('8 contract modules');
  });

  it('shows missing dependency partial and blocked states from fixtures', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Dependency status shell');

    for (const fixture of PERSPECTIVE_MISSING_DEPENDENCY_FIXTURES) {
      expect(markup).toContain(fixture.perspectiveKey);
      expect(markup).toContain(fixture.missingAssetKind);
      expect(markup).toContain(fixture.displayStatus);
    }

    expect(markup).toContain('partial');
    expect(markup).toContain('blocked');
  });

  it('does not expose perspective compute, refresh, edit, or module actions', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Blocked shell');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('Run perspective');
    expect(markup).not.toContain('Refresh perspective');
    expect(markup).not.toContain('Edit relation');
    expect(markup).not.toContain('Adopt TechniqueEntry');
  });
});
