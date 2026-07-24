import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  AiConnectionCheckViewController,
} from '../../src/renderer/features/settings/ai-connection-check-view-state';
import { SettingsRoute } from '../../src/renderer/routes/SettingsRoute';

const checkedData = {
  gate: {
    status: 'passed' as const,
    feasibility: 'windows_passed' as const,
    platform: 'macos_deferred' as const,
    overallVerdict: 'conditional_go' as const,
  },
  compatibility: {
    state: 'fresh' as const,
    fingerprint: 'a'.repeat(64),
  },
  runtime: {
    authState: 'authenticated' as const,
    observedAt: '2026-07-24T12:00:00.000Z',
  },
};

describe('Block 13.12 Settings explicit connection check', () => {
  it('renders unknown without invoking runtime during route render', () => {
    const checkConnection = vi.fn();
    const markup = renderToStaticMarkup(
      <SettingsRoute api={{ ai: { checkConnection } }} />,
    );

    expect(checkConnection).not.toHaveBeenCalled();
    expect(markup).toContain('Check connection');
    expect(markup).toContain('Windows feasibility');
    expect(markup).toContain('macOS deferred');
    expect(markup).toContain('Overall verdict');
    expect(markup).toContain('Conditional Go');
    expect(markup).toContain('SDK compatibility');
    expect(markup).toContain('Unknown');
    expect(markup).toContain('Not observed');
    expect(markup).toContain('AI actions remain disabled');
  });

  it('deduplicates concurrent clicks and clears the old presentation at attempt start', async () => {
    const pending = deferred<Awaited<ReturnType<
      ConstructorParameters<typeof AiConnectionCheckViewController>[0]
    >>>();
    const invoke = vi.fn(() => pending.promise);
    const states: unknown[] = [];
    const controller = new AiConnectionCheckViewController(invoke, (state) => states.push(state));

    const first = controller.check();
    const second = controller.check();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(controller.read()).toMatchObject({
      pending: true,
      data: { runtime: { authState: 'unknown', observedAt: null } },
    });
    pending.resolve({ ok: true, data: checkedData });
    await Promise.all([first, second]);
    expect(controller.read()).toMatchObject({
      pending: false,
      data: { runtime: { authState: 'authenticated' } },
    });
  });

  it('ignores a late response after leaving Settings', async () => {
    const pending = deferred<Awaited<ReturnType<
      ConstructorParameters<typeof AiConnectionCheckViewController>[0]
    >>>();
    const published = vi.fn();
    const controller = new AiConnectionCheckViewController(() => pending.promise, published);
    const running = controller.check();
    controller.dispose();
    pending.resolve({ ok: true, data: checkedData });
    await running;

    expect(published).toHaveBeenCalledTimes(1);
    expect(controller.read()).toMatchObject({
      pending: true,
      data: { runtime: { authState: 'unknown' } },
    });
  });
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
