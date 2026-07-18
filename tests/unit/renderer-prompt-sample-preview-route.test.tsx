import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter, resolveAppRoute } from '../../src/renderer/app/AppRouter';
import { ProductNavigation } from '../../src/renderer/components/ProductNavigation';
import { SettingsRoute } from '../../src/renderer/routes/SettingsRoute';
import { PROMPT_SAMPLE_PREVIEW_POLICY } from '../../src/shared/domain';

describe('Block 12 Task 12.10 Prompt sample preview route', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exposes Settings as a natural product navigation entry', () => {
    const markup = renderToStaticMarkup(<ProductNavigation activeRoute="settings" />);

    expect(resolveAppRoute('#/settings')).toBe('settings');
    expect(markup).toContain('href="#/settings"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Settings');
  });

  it('shows sample preview as blocked and as a publication hard gate', () => {
    const markup = renderToStaticMarkup(<SettingsRoute />);

    expect(markup).toContain('Settings');
    expect(markup).toContain('Templates &amp; schemas');
    expect(markup).toContain('Sample preview');
    expect(markup).toContain('Blocked');
    expect(markup).toContain('Run sample preview');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-describedby="sample-preview-disabled-reason"');
    expect(markup).toContain('Publication hard gate');
    expect(markup).toContain(
      'A template version cannot be published until its sample preview status is passed.',
    );
    for (const code of PROMPT_SAMPLE_PREVIEW_POLICY.blockerCodes) {
      expect(markup).toContain(code);
    }
    expect(markup).not.toContain('<form');
  });

  it('keeps Settings discoverable and usable before a Library is opened', () => {
    vi.stubGlobal('window', {
      location: { hash: '#/settings' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AppRouter api={null} />
      </QueryClientProvider>,
    );

    expect(markup).toContain('aria-label="Product navigation"');
    expect(markup).toContain('href="#/settings"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('<h1 id="settings-title">Settings</h1>');
    expect(markup).toContain('Codex SDK gate');
    expect(markup).not.toContain('No library open');
  });

  it('keeps the blocked shell outside handlers and privileged boundaries', () => {
    const routeSource = readFileSync('src/renderer/routes/SettingsRoute.tsx', 'utf8');
    const routerSource = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(routeSource).not.toMatch(/onClick=|window\.writestorm|preload|ipc|Codex|@openai/);
    expect(routerSource).toContain("route === 'settings'");
    expect(routerSource).toContain('<SettingsRoute />');
  });
});
