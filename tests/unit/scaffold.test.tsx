import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../../src/renderer/App';
import { rendererText } from '../../src/renderer/i18n';

describe('scaffold boundary', () => {
  it('keeps the initial product surface in a no-library state', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain(rendererText.emptyLibrary.title);
    expect(markup).toContain(rendererText.emptyLibrary.description);
  });
});
