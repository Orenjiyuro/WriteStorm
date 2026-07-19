import { extractFile, listPackage } from '@electron/asar';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const resourcesDir = path.join(rootDir, 'out', `writestorm-win32-${process.arch}`, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const unpackedRoot = path.join(resourcesDir, 'app.asar.unpacked');
const windowsTarget = 'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc';

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

  it('packages the external SDK and only the Windows x64 Codex platform runtime', () => {
    const entries = normalizedEntries().map(({ normalized }) => normalized);
    const platformPackageRoots = entries
      .filter((entry) => /^node_modules\/@openai\/codex-(?!sdk)(?:darwin|linux|win32)-[^/]+\/package\.json$/.test(entry))
      .map((entry) => path.posix.dirname(entry));

    expect(entries).toContain('node_modules/@openai/codex-sdk/dist/index.js');
    expect(entries).toContain('node_modules/@openai/codex/bin/codex.js');
    expect(platformPackageRoots).toEqual(['node_modules/@openai/codex-win32-x64']);
  });

  it('places the complete approved Windows target in app.asar.unpacked', () => {
    const requiredRuntimeFiles = [
      'bin/codex.exe',
      'bin/codex-code-mode-host.exe',
      'codex-path/rg.exe',
      'codex-resources/codex-command-runner.exe',
      'codex-resources/codex-windows-sandbox-setup.exe',
      'codex-package.json',
    ];

    for (const relativePath of requiredRuntimeFiles) {
      const absolutePath = path.join(unpackedRoot, ...windowsTarget.split('/'), ...relativePath.split('/'));
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(readFileSync(absolutePath).byteLength).toBeGreaterThan(0);
    }
  });

  it('has a positive rejection witness for packaged renderer and platform contamination', () => {
    const forbiddenRenderer = 'const credentialValue = process.env.CODEX_TOKEN;';
    const contaminatedPlatforms = [
      'node_modules/@openai/codex-win32-x64',
      'node_modules/@openai/codex-darwin-arm64',
    ];

    expect(forbiddenRenderer).toMatch(/process\.env/);
    expect(forbiddenRenderer).toMatch(/\bcredentialValue\b/);
    expect(contaminatedPlatforms).not.toEqual(['node_modules/@openai/codex-win32-x64']);
  });
});

function normalizedEntries(): Array<{ readonly raw: string; readonly normalized: string }> {
  return listPackage(asarPath, { isPack: false }).map((raw) => ({
    raw,
    normalized: raw.replaceAll('\\', '/').replace(/^\/+/, ''),
  }));
}
