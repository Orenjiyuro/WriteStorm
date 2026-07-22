import { extractFile, listPackage } from '@electron/asar';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES,
  evaluateWindowsPlatformRuntimeFiles,
} from '../../scripts/block6a-windows-platform-package-guard.mjs';

const rootDir = path.resolve(__dirname, '../..');
const artifactRoot = process.env.WRITESTORM_BLOCK6A_CERTIFICATION_ARTIFACT_ROOT;
if (!artifactRoot || !path.isAbsolute(artifactRoot)) {
  throw new Error('Explicit Block 6A certification artifact root is required.');
}
const resourcesDir = path.join(artifactRoot, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const unpackedRoot = path.join(resourcesDir, 'app.asar.unpacked');
const windowsTarget = 'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc';

describe('Block 6A isolated certification package boundary', () => {
  it('contains the fail-closed certification main and dedicated utility', () => {
    const entries = normalizedEntries();
    const names = entries.map(({ normalized }) => normalized);
    const main = extractNormalized(entries, '.vite/build/main.js');
    const utility = extractNormalized(entries, '.vite/build/utility-entry.js');

    expect(names).toContain('.vite/build/main.js');
    expect(names).toContain('.vite/build/utility-entry.js');
    expect(main).toContain('WriteStorm Block 6A Certification');
    expect(main).not.toContain('BrowserWindow');
    expect(utility).toContain('@openai/codex-sdk');
    expect(utility).not.toContain('class CodexExec');
  });

  it('keeps packaged renderer resources free of SDK and secret-bearing runtime surfaces', () => {
    const rendererEntries = normalizedEntries().filter(({ normalized }) => (
      normalized.startsWith('.vite/renderer/main_window/')
      && /\.(?:js|css|html|json|map)$/.test(normalized)
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
    const targetRoot = path.join(unpackedRoot, ...windowsTarget.split('/'));
    const observedFiles = relativeFiles(targetRoot);
    expect(evaluateWindowsPlatformRuntimeFiles(observedFiles)).toEqual({
      passed: true,
      missing: [],
      extra: [],
      duplicates: [],
    });

    for (const relativePath of APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES) {
      const absolutePath = path.join(targetRoot, ...relativePath.split('/'));
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(readFileSync(absolutePath).byteLength).toBeGreaterThan(0);
    }
  });
});

function normalizedEntries(): Array<{ readonly raw: string; readonly normalized: string }> {
  return listPackage(asarPath, { isPack: false }).map((raw) => ({
    raw,
    normalized: raw.replaceAll('\\', '/').replace(/^\/+/, ''),
  }));
}

function extractNormalized(
  entries: Array<{ readonly raw: string; readonly normalized: string }>,
  normalizedPath: string,
): string {
  const rawPath = entries.find(({ normalized }) => normalized === normalizedPath)?.raw;
  expect(rawPath).toBeDefined();
  return extractFile(asarPath, rawPath!.replace(/^[/\\]+/, '')).toString('utf8');
}

function relativeFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? relativeFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  }).sort();
}
