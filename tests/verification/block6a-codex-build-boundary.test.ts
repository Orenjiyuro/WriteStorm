import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const utilityBuildPath = path.join(rootDir, '.vite/build/utility-entry.js');
const rendererBuildDir = path.join(rootDir, '.vite/renderer/main_window');

describe('Block 6A.4 built output boundary', () => {
  it('keeps the SDK external in the dedicated utility bundle', () => {
    const utilityOutput = readFileSync(utilityBuildPath, 'utf8');

    expect(utilityOutput).toContain('@openai/codex-sdk');
    expect(utilityOutput).not.toContain('class CodexExec');
    expect(utilityOutput).not.toContain('const commandArgs = ["exec", "--experimental-json"]');
  });

  it('keeps renderer output free of SDK, process and secret-bearing runtime surfaces', () => {
    const rendererOutput = readTextFiles(rendererBuildDir);

    expect(rendererOutput).not.toMatch(/@openai\/|node:child_process|node:fs|process\.env/);
    expect(rendererOutput).not.toMatch(/\b(?:apiKey|accessToken|authToken|credentialValue|secretValue|secureStorageValue|codexSession)\b/);
  });

  it('has a positive rejection witness for both build guards', () => {
    const forbiddenUtilityBundle = 'class CodexExec { run() { return ["exec", "--experimental-json"]; } }';
    const forbiddenRendererBundle = 'const accessToken = process.env.CODEX_TOKEN;';

    expect(forbiddenUtilityBundle).toContain('class CodexExec');
    expect(forbiddenRendererBundle).toMatch(/process\.env/);
    expect(forbiddenRendererBundle).toMatch(/\baccessToken\b/);
  });
});

function readTextFiles(dir: string): string {
  return files(dir)
    .filter((filePath) => /\.(?:js|mjs|cjs|html|css|json|map)$/.test(filePath))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    return statSync(entryPath).isDirectory() ? files(entryPath) : [entryPath];
  });
}
