import { extractFile, listPackage } from '@electron/asar';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const resourcesDir = path.join(rootDir, 'out', `writestorm-win32-${process.arch}`, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');

describe('Block 13.11 product packaged security boundary', () => {
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

  it('includes only the production Codex utility and pinned product runtime', () => {
    const entries = normalizedEntries().map(({ normalized }) => normalized);

    expect(entries).toContain('.vite/build/main.js');
    expect(entries).toContain('.vite/build/codex-utility-entry.js');
    expect(entries).not.toContain('.vite/build/utility-entry.js');
    expect(entries).toContain('node_modules/@openai/codex-sdk/package.json');
    expect(entries).toContain('node_modules/@openai/codex/package.json');
    expect(entries).toContain('node_modules/@openai/codex-win32-x64/package.json');

    const productMain = extractFile(asarPath, '.vite\\build\\main.js').toString('utf8');
    const productUtility = extractFile(
      asarPath,
      '.vite\\build\\codex-utility-entry.js',
    ).toString('utf8');
    expect(productMain).not.toContain('@openai/codex-sdk');
    expect(productMain).not.toContain('certification-main');
    expect(productUtility).toContain('@openai/codex-sdk');
    expect(productUtility).not.toContain('codex-feasibility');
  });

  it('unpacks the exact Windows Codex executable required by the production utility', () => {
    expect(existsSync(path.join(
      resourcesDir,
      'app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    ))).toBe(true);
  });

  it('has a positive rejection witness for packaged renderer and platform contamination', () => {
    const forbiddenRenderer = 'const credentialValue = process.env.CODEX_TOKEN;';
    const contaminatedProductEntries = [
      '.vite/build/utility-entry.js',
      '.vite/build/certification-main.js',
    ];

    expect(forbiddenRenderer).toMatch(/process\.env/);
    expect(forbiddenRenderer).toMatch(/\bcredentialValue\b/);
    expect(contaminatedProductEntries).toContain('.vite/build/utility-entry.js');
    expect(contaminatedProductEntries).toContain('.vite/build/certification-main.js');
  });
});

function normalizedEntries(): Array<{ readonly raw: string; readonly normalized: string }> {
  return listPackage(asarPath, { isPack: false }).map((raw) => ({
    raw,
    normalized: raw.replaceAll('\\', '/').replace(/^\/+/, ''),
  }));
}
