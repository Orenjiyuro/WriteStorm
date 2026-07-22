import { extractFile, listPackage } from '@electron/asar';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const resourcesDir = path.join(rootDir, 'out', `writestorm-win32-${process.arch}`, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');

describe('Block 6A packaged security boundary', () => {
  it('keeps packaged renderer resources free of SDK and secret-bearing runtime surfaces', () => {
    expect(existsSync(asarPath)).toBe(true);
    const entries = normalizedEntries();
    const rendererEntries = entries.filter(({ normalized }) => (
      normalized.startsWith('.vite/renderer/main_window/') && /\.(?:js|css|html|json|map)$/.test(normalized)
    ));
    const rendererOutput = rendererEntries
      .map(({ raw }) => extractFile(asarPath, raw.replace(/^[/\\]+/, '')).toString('utf8'))
      .join('\n');

    expect(rendererEntries.length).toBeGreaterThan(0);
    expect(rendererOutput).not.toMatch(/@openai\/|node:child_process|node:fs|process\.env/);
    expect(rendererOutput).not.toMatch(/\b(?:apiKey|accessToken|authToken|credentialValue|secretValue|secureStorageValue|codexSession)\b/);
  });

  it('keeps the Codex feasibility SDK, CLI and utility outside the product package', () => {
    const entries = normalizedEntries().map(({ normalized }) => normalized);

    expect(entries).toContain('.vite/build/main.js');
    expect(entries).not.toContain('.vite/build/utility-entry.js');
    expect(entries.some((entry) => entry.startsWith('node_modules/@openai/codex'))).toBe(false);
  });

  it('does not leave an unpacked Codex runtime beside the product ASAR', () => {
    expect(existsSync(path.join(
      resourcesDir,
      'app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-win32-x64',
    ))).toBe(false);
  });

  it('has a positive rejection witness for packaged renderer and platform contamination', () => {
    const forbiddenRenderer = 'const credentialValue = process.env.CODEX_TOKEN;';
    const contaminatedProductEntries = [
      '.vite/build/utility-entry.js',
      'node_modules/@openai/codex-sdk/dist/index.js',
    ];

    expect(forbiddenRenderer).toMatch(/process\.env/);
    expect(forbiddenRenderer).toMatch(/\bcredentialValue\b/);
    expect(contaminatedProductEntries).toContain('.vite/build/utility-entry.js');
  });
});

function normalizedEntries(): Array<{ readonly raw: string; readonly normalized: string }> {
  return listPackage(asarPath, { isPack: false }).map((raw) => ({
    raw,
    normalized: raw.replaceAll('\\', '/').replace(/^\/+/, ''),
  }));
}
