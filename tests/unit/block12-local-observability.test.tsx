import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalObservabilityShell } from '../../src/renderer/features/settings/LocalObservabilityShell';
import {
  LOCAL_OBSERVABILITY_POLICY,
  LOCAL_OBSERVABILITY_SHELL_STATE,
} from '../../src/shared/domain';

describe('Block 12 Task 12.15 local observability shell', () => {
  it('freezes local-only logging and default-off remote upload policy', () => {
    expect(LOCAL_OBSERVABILITY_POLICY).toEqual({
      storageScope: 'local_only',
      remoteUploadByDefault: {
        crashReports: false,
        usageStatistics: false,
        sourceTextSnippets: false,
      },
      sourceTextSnippetsMayBeRecorded: false,
      clearRequiresExplicitUserAction: true,
      manualExportRequiresExplicitUserAction: true,
      execution: 'not_admitted',
    });
  });

  it('shows policy and an honest unavailable recent-error summary', () => {
    const markup = renderToStaticMarkup(<LocalObservabilityShell />);

    expect(markup).toContain('Local observability');
    expect(markup).toContain('Local only');
    expect(markup).toContain('Crash reports');
    expect(markup).toContain('Not uploaded by default');
    expect(markup).toContain('Usage statistics');
    expect(markup).toContain('Source text snippets');
    expect(markup).toContain('Never recorded or uploaded');
    expect(markup).toContain('Recent error summary');
    expect(markup).toContain('Unavailable');
    expect(markup).toContain(
      'No local error-summary reader is admitted. This does not mean that no errors occurred.',
    );
    expect(markup).not.toContain('No recent errors');
    expect(LOCAL_OBSERVABILITY_SHELL_STATE.recentErrorSummary.errorCount).toBeNull();
  });

  it('shows disabled clear and manual-export entries with linked reasons', () => {
    const markup = renderToStaticMarkup(<LocalObservabilityShell />);

    expect(markup).toContain('Clear local logs');
    expect(markup).toContain('Manually export logs');
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup).toContain('aria-describedby="clear-local-logs-disabled-reason"');
    expect(markup).toContain('aria-describedby="manual-log-export-disabled-reason"');
    expect(markup).toContain('local_log_clear_not_admitted');
    expect(markup).toContain('manual_log_export_not_admitted');
  });

  it('keeps local log operations out of renderer and preload boundaries', () => {
    const componentSource = readFileSync(
      'src/renderer/features/settings/LocalObservabilityShell.tsx',
      'utf8',
    );
    const channels = readFileSync('src/shared/contracts/channels.ts', 'utf8');
    const preload = readFileSync('src/shared/contracts/preload-api.ts', 'utf8');

    expect(componentSource).not.toMatch(/onClick=|window\.writestorm|preload|\bipc\b|node:fs/);
    expect(componentSource).not.toMatch(/readonly onClear|readonly onExport|readonly errors/);
    expect(`${channels}\n${preload}`).not.toMatch(/logs:(?:read|clear|export)|observability:/);
  });
});
