import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiagnosticsRoute } from '../../src/renderer/routes/DiagnosticsRoute';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SCOPE_EXCLUDED_TARGETS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
} from '../../src/shared/domain';

describe('renderer analysis contract readout', () => {
  it('shows the Block 3 module shell from shared domain contracts', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);

    expect(markup).toContain('Analysis module contract readout');
    expect(markup).toContain('Source: shared domain contract');
    expect(markup).toContain(`${ANALYSIS_MODULE_DEFINITIONS.length} contract modules`);

    for (const moduleDefinition of ANALYSIS_MODULE_DEFINITIONS) {
      expect(markup).toContain(moduleDefinition.name);
      expect(markup).toContain(moduleDefinition.key);
    }
  });

  it('shows AI constraint summary as a disabled secondary system page placeholder', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);
    const aiConstraintSummary = ANALYSIS_SECONDARY_SYSTEM_PAGES[0];

    expect(markup).toContain(aiConstraintSummary.name);
    expect(markup).toContain(aiConstraintSummary.key);
    expect(markup).toContain('Secondary system page');
    expect(markup).toContain('Disabled placeholder');
    expect(markup).toContain('aria-disabled="true"');
  });

  it('shows unsupported scope and target reasons from the contract exclusions', () => {
    const markup = renderToStaticMarkup(<DiagnosticsRoute />);

    expect(markup).toContain('Unsupported scope and target exclusions');

    for (const excludedTarget of ANALYSIS_SCOPE_EXCLUDED_TARGETS) {
      expect(markup).toContain(excludedTarget.targetKey);
      expect(markup).toContain(excludedTarget.attemptedScope);
      expect(markup).toContain(excludedTarget.reason);
    }
  });
});
