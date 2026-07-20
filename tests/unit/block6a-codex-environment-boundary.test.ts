import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCodexCliEnvironment,
  CODEX_CLI_BASE_ENVIRONMENT_KEYS,
  CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY,
  CODEX_UTILITY_ENVIRONMENT_KEYS,
  createCodexUtilityEnvironment,
} from '../../src/main/codex-feasibility/environment';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A remediation R2 environment boundary', () => {
  it('gives the SDK utility only explicit Windows runtime, auth, proxy and probe-input keys', () => {
    const environment = createCodexUtilityEnvironment({
      Path: 'fixture-path',
      PATHEXT: 'fixture-pathext',
      SystemRoot: 'fixture-system-root',
      COMSPEC: 'fixture-comspec',
      TEMP: 'fixture-temp',
      USERPROFILE: 'fixture-user-profile',
      APPDATA: 'fixture-appdata',
      LOCALAPPDATA: 'fixture-localappdata',
      CODEX_HOME: 'fixture-codex-home',
      HTTPS_PROXY: 'fixture-proxy',
      NODE_EXTRA_CA_CERTS: 'fixture-ca-path',
      WRITESTORM_CODEX_SYNTHETIC_INPUT: 'fixture-input',
      WRITESTORM_CODEX_SYNTHETIC_EXPECTED: 'fixture-expected',
      WRITESTORM_CODEX_CAPABILITY_RESULT: 'must-not-cross-utility-boundary',
      OPENAI_API_KEY: 'must-not-cross-utility-boundary',
      CODEX_API_KEY: 'must-not-cross-utility-boundary',
      CODEX_ACCESS_TOKEN: 'must-not-cross-utility-boundary',
      AWS_SECRET_ACCESS_KEY: 'must-not-cross-utility-boundary',
      GH_TOKEN: 'must-not-cross-utility-boundary',
      NODE_OPTIONS: '--require must-not-cross-utility-boundary',
      PRODUCER_INVENTED_SECRET: 'must-not-cross-utility-boundary',
    });

    expect(Object.keys(environment).sort()).toEqual([
      'APPDATA',
      'CODEX_HOME',
      'COMSPEC',
      'HTTPS_PROXY',
      'LOCALAPPDATA',
      'NODE_EXTRA_CA_CERTS',
      'PATH',
      'PATHEXT',
      'SYSTEMROOT',
      'TEMP',
      'USERPROFILE',
      'WRITESTORM_CODEX_SYNTHETIC_EXPECTED',
      'WRITESTORM_CODEX_SYNTHETIC_INPUT',
    ]);
    expect(Object.keys(environment).every((key) => (
      CODEX_UTILITY_ENVIRONMENT_KEYS as readonly string[]
    ).includes(key))).toBe(true);
    expect(environment).not.toHaveProperty('NODE_OPTIONS');
    expect(environment).not.toHaveProperty('OPENAI_API_KEY');
    expect(environment).not.toHaveProperty('WRITESTORM_CODEX_CAPABILITY_RESULT');
  });

  it('uses a narrower CLI base and replaces CODEX_HOME only for the isolated auth scenario', () => {
    const utilityEnvironment = createCodexUtilityEnvironment({
      Path: 'fixture-path',
      USERPROFILE: 'fixture-user-profile',
      CODEX_HOME: 'fixture-current-codex-home',
      HTTPS_PROXY: 'fixture-proxy',
      WRITESTORM_CODEX_SYNTHETIC_INPUT: 'fixture-input',
      WRITESTORM_CODEX_SYNTHETIC_EXPECTED: 'fixture-expected',
    });
    const current = buildCodexCliEnvironment(utilityEnvironment, { authMode: 'current' });
    const isolated = buildCodexCliEnvironment(utilityEnvironment, {
      authMode: 'isolated-empty',
      isolatedCodexHome: 'fixture-isolated-codex-home',
    });

    expect(Object.keys(current).sort()).toEqual([
      'CODEX_HOME',
      'HTTPS_PROXY',
      'PATH',
      'USERPROFILE',
    ]);
    expect(Object.keys(current).every((key) => (
      CODEX_CLI_BASE_ENVIRONMENT_KEYS as readonly string[]
    ).includes(key))).toBe(true);
    expect(isolated.CODEX_HOME === current.CODEX_HOME).toBe(false);
    expect(current).not.toHaveProperty('WRITESTORM_CODEX_SYNTHETIC_INPUT');
    expect(current).not.toHaveProperty('WRITESTORM_CODEX_SYNTHETIC_EXPECTED');
    expect(() => buildCodexCliEnvironment(utilityEnvironment, {
      authMode: 'isolated-empty',
    })).toThrow('An isolated CODEX_HOME is required');
  });

  it('pins the exact SDK 0.144.6 overlay keys from installed official source', () => {
    const sdkRoot = path.join(rootDir, 'node_modules/@openai/codex-sdk');
    const manifest = JSON.parse(readFileSync(path.join(sdkRoot, 'package.json'), 'utf8')) as {
      version: string;
    };
    const source = readFileSync(path.join(sdkRoot, 'dist/index.js'), 'utf8');
    const originatorKey = source.match(/var INTERNAL_ORIGINATOR_ENV = "([A-Z0-9_]+)"/)?.[1];
    const conditionalDirectKeys = [...source.matchAll(/env\.([A-Z][A-Z0-9_]+)\s*=/g)]
      .map((match) => match[1]);

    expect(manifest.version).toBe('0.144.6');
    expect([originatorKey]).toEqual(
      CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY.alwaysInjectedKeys,
    );
    expect(conditionalDirectKeys).toEqual(
      CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY.apiKeyOptionConditionalKeys,
    );
    expect(source).toContain('if (args.apiKey)');
    expect(source).toContain('prependPathDirs(env, this.pathDirs)');
    expect(CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY.automaticResolutionMutatedKeys)
      .toEqual(['PATH']);

    const utilitySource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
      'utf8',
    );
    expect(utilitySource).not.toMatch(/\bapiKey\s*:/);
    for (const sdkOwnedKey of [originatorKey, ...conditionalDirectKeys]) {
      expect(CODEX_UTILITY_ENVIRONMENT_KEYS).not.toContain(sdkOwnedKey);
      expect(CODEX_CLI_BASE_ENVIRONMENT_KEYS).not.toContain(sdkOwnedKey);
    }
  });

  it('requires every probe producer to use the shared minimal utility policy', () => {
    for (const relativePath of [
      'src/main/codex-feasibility/probe-main.ts',
      'src/main/codex-feasibility/output-schema-probe-main.ts',
      'src/main/codex-feasibility/lifecycle-probe-main.ts',
      'src/main/codex-feasibility/packaged-probe.ts',
    ]) {
      const source = readFileSync(path.join(rootDir, relativePath), 'utf8');
      expect(source).toContain('createCodexUtilityEnvironment');
      expect(source).not.toContain('function createUtilityEnvironment');
    }
  });

  it('records only key names and booleans in the static environment evidence', () => {
    const evidenceText = readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r2-environment-boundary.json',
    ), 'utf8');
    const evidence = JSON.parse(evidenceText) as {
      source: string;
      classification: string;
      writeStormUtilityAllowlistKeys: string[];
      writeStormCliBaseAllowlistKeys: string[];
      sdkEnvironmentOverlay: typeof CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY;
      assertions: Record<string, boolean>;
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('utility_environment_boundary_frozen');
    expect(evidence.writeStormUtilityAllowlistKeys).toEqual(CODEX_UTILITY_ENVIRONMENT_KEYS);
    expect(evidence.writeStormCliBaseAllowlistKeys).toEqual(CODEX_CLI_BASE_ENVIRONMENT_KEYS);
    expect(evidence.sdkEnvironmentOverlay).toEqual(CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY);
    expect(Object.values(evidence.assertions).every((value) => value === true)).toBe(true);
    expect(evidenceText).not.toMatch(/"(?:value|secret|token|credential|authorization)"\s*:/i);
  });
});
