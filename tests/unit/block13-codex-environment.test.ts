import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CODEX_UTILITY_ENVIRONMENT_KEYS,
  createCodexUtilityEnvironment,
} from '../../src/main/ai/providers/codex/codex-environment';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.6 Codex environment and config boundary', () => {
  it('passes only runtime/auth/proxy locations and never API credentials or injection hooks', () => {
    const environment = createCodexUtilityEnvironment({
      Path: 'fixture-path',
      PATHEXT: 'fixture-pathext',
      USERPROFILE: 'fixture-user',
      APPDATA: 'fixture-appdata',
      LOCALAPPDATA: 'fixture-localappdata',
      CODEX_HOME: 'fixture-codex-home',
      HTTPS_PROXY: 'fixture-proxy',
      NODE_EXTRA_CA_CERTS: 'fixture-ca',
      OPENAI_API_KEY: 'must-not-cross',
      CODEX_API_KEY: 'must-not-cross',
      CODEX_ACCESS_TOKEN: 'must-not-cross',
      AUTHORIZATION: 'must-not-cross',
      NODE_OPTIONS: '--require must-not-cross',
      ELECTRON_RUN_AS_NODE: '1',
      WRITESTORM_INVENTED_CONFIG: 'must-not-cross',
    });

    expect(environment).toEqual({
      APPDATA: 'fixture-appdata',
      CODEX_HOME: 'fixture-codex-home',
      HTTPS_PROXY: 'fixture-proxy',
      LOCALAPPDATA: 'fixture-localappdata',
      NODE_EXTRA_CA_CERTS: 'fixture-ca',
      PATH: 'fixture-path',
      PATHEXT: 'fixture-pathext',
      USERPROFILE: 'fixture-user',
    });
    expect(Object.isFrozen(environment)).toBe(true);
    expect(Object.keys(environment).every((key) => (
      CODEX_UTILITY_ENVIRONMENT_KEYS as readonly string[]
    ).includes(key))).toBe(true);
  });

  it('keeps environment/config and auth implementation out of persistence/export/shared layers', () => {
    for (const relativePath of [
      'src/main/ai/ai-runtime-observation.ts',
      'src/main/ai/providers/codex/codex-auth-observation.ts',
      'src/main/ai/providers/codex/codex-environment.ts',
    ]) {
      const source = readFileSync(path.join(rootDir, relativePath), 'utf8');
      expect(source).not.toMatch(
        /better-sqlite3|LibraryService|JobCheckpoint|AnalysisModuleInstance|src\/shared|src\/renderer/,
      );
      expect(source).not.toMatch(/writeFile|appendFile|localStorage|sessionStorage/);
    }

    for (const relativeRoot of [
      'src/main/db',
      'src/main/exports',
      'src/shared',
      'src/renderer',
    ]) {
      const source = readAllSource(path.join(rootDir, relativeRoot));
      expect(source).not.toMatch(
        /CodexAuthProbeObservation|CodexUtilityEnvironment|CODEX_UTILITY_ENVIRONMENT_KEYS/,
      );
    }
  });
});

function readAllSource(directory: string): string {
  const { existsSync, readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  if (!existsSync(directory)) return '';
  return readdirSync(directory).map((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) return readAllSource(entryPath);
    return /\.(?:ts|tsx)$/.test(entryPath) ? readFileSync(entryPath, 'utf8') : '';
  }).join('\n');
}
