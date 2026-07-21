import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';
import { validateMinimalStructuredOutput } from '../../src/main/codex-feasibility/structured-output';
import {
  isPinnedSdkLocalOutputSchemaGuardProbe,
  resolveInstalledCodexSdkVersion,
  resolvePackageManifestPath,
  resolveUtilityModuleAnchor,
} from '../../src/main/codex-feasibility/utility-entry';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.6 minimal outputSchema boundary', () => {
  it('locks real SDK and local fixture evidence as separate provenance classes', () => {
    const realEvidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a6-real-output-schema.json',
    ), 'utf8')) as Record<string, unknown> & { assertions: Record<string, boolean>; scenarios: unknown[] };
    const fixtureEvidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a6-validator-fixtures.json',
    ), 'utf8')) as Record<string, unknown> & { assertions: Record<string, boolean>; cases: unknown[] };

    expect(realEvidence.source).toBe('real_sdk');
    expect(realEvidence.classification).toBe('output_schema_probe_completed');
    expect(Object.values(realEvidence.assertions).every(Boolean)).toBe(true);
    expect(realEvidence.scenarios).toEqual([
      expect.objectContaining({
        scenario: 'valid-minimal',
        outcome: 'success',
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
      }),
      expect.objectContaining({
        scenario: 'invalid-schema',
        outcome: 'invalid_schema_rejected',
        invalidSchemaRejectedBySdk: true,
      }),
    ]);
    expect(fixtureEvidence.source).toBe('local_validator_fixture');
    expect(Object.values(fixtureEvidence.assertions).every(Boolean)).toBe(true);
    expect(fixtureEvidence.cases).toEqual(expect.arrayContaining([
      expect.objectContaining({ case: 'missing-field', classification: 'missing_field' }),
      expect.objectContaining({ case: 'extra-field', classification: 'extra_field' }),
    ]));
    const serializedRealEvidence = JSON.stringify(realEvidence);
    expect(serializedRealEvidence).not.toContain('WRITESTORM_PROBE_OK');
    expect(serializedRealEvidence).not.toMatch(/[A-Z]:\\\\/);
    expect(serializedRealEvidence).not.toMatch(/"(?:prompt|responseBody|stdout|stderr|token|utilityPid)"\s*:/i);

    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    expect(authority).toContain('## Task 6A.6 minimal outputSchema result');
    expect(authority).toContain('pending recertification');
    expect(authority).not.toContain('Tasks 6A.6 and 6A.8a remain blocked');
  });

  it('recognizes the pinned local SDK schema-guard probe without inspecting error text', () => {
    expect(isPinnedSdkLocalOutputSchemaGuardProbe('invalid-schema', [], '0.144.6')).toBe(true);
    expect(isPinnedSdkLocalOutputSchemaGuardProbe('valid-minimal', [], '0.144.6')).toBe(false);
    expect(isPinnedSdkLocalOutputSchemaGuardProbe('invalid-schema', {}, '0.144.6')).toBe(false);
    expect(isPinnedSdkLocalOutputSchemaGuardProbe('invalid-schema', [], 'future-version')).toBe(false);

    const utilitySource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
      'utf8',
    );
    expect(utilitySource).not.toContain('outputSchema must be a plain JSON object');
  });

  it('keeps the utility CJS bundle module-resolution anchor valid', async () => {
    const outDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-block6a-cjs-anchor-'));
    try {
      await build({
        configFile: false,
        logLevel: 'silent',
        build: {
          target: 'node22',
          outDir,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          lib: {
            entry: path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
            formats: ['cjs'],
            fileName: () => 'utility-entry.cjs',
          },
          rollupOptions: {
            external: (id) => id === 'electron'
              || id === '@openai/codex-sdk'
              || id === '@openai/codex'
              || id.startsWith('node:'),
          },
        },
      });
      const bundled = readFileSync(path.join(outDir, 'utility-entry.cjs'), 'utf8');
      expect(bundled).not.toMatch(/createRequire\)\(\{\}\.url\)/);
      expect(bundled).toContain('resolveUtilityModuleAnchor');
      expect(bundled).not.toMatch(/\.resolve\(["']@openai\/codex-sdk["']\)/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('resolves the project-local pinned SDK version from both utility anchor forms', () => {
    const cjsFilename = path.join(rootDir, '.vite', 'utility-entry.cjs');
    expect(resolveUtilityModuleAnchor(cjsFilename, rootDir)).toBe(cjsFilename);
    expect(resolveUtilityModuleAnchor(null, rootDir)).toBe(
      path.join(rootDir, 'package.json'),
    );
    expect(resolvePackageManifestPath('@openai/codex-sdk', cjsFilename)).toBe(
      path.join(rootDir, 'node_modules', '@openai', 'codex-sdk', 'package.json'),
    );
    expect(resolvePackageManifestPath('../outside', cjsFilename)).toBeUndefined();
    expect(resolveInstalledCodexSdkVersion()).toBe('0.144.6');
  });

  it('admits only closed output-schema scenarios without prompt or schema injection', () => {
    const request = {
      version: 1,
      origin: 'main',
      requestId: 'output-schema-1',
      command: 'run-output-schema-probe',
      input: {
        scenario: 'valid-minimal',
        workingDirectory: 'C:\\probe\\explicit-git',
      },
    };

    expect(isCodexFeasibilityRequest(request)).toBe(true);
    expect(isCodexFeasibilityRequest({ ...request, prompt: 'rejected' })).toBe(false);
    expect(isCodexFeasibilityRequest({
      ...request,
      input: { ...request.input, outputSchema: { type: 'object' } },
    })).toBe(false);
    expect(isCodexFeasibilityResponse({
      version: 1,
      requestId: request.requestId,
      command: 'run-output-schema-probe',
      ok: true,
      utilityPid: 1,
      result: {
        scenario: 'valid-minimal',
        outcome: 'success',
        authClassification: 'authenticated',
        runtimeFailureOrigin: null,
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        invalidSchemaRejectedBySdk: false,
      },
    })).toBe(true);
  });

  it('maps success, missing field and extra field through the same strict local validator', () => {
    expect(validateMinimalStructuredOutput('{"status":"expected"}', 'expected')).toEqual({
      classification: 'accepted',
      accepted: true,
      expectedValueMatched: true,
    });
    expect(validateMinimalStructuredOutput('{}', 'expected')).toEqual({
      classification: 'missing_field',
      accepted: false,
      expectedValueMatched: false,
    });
    expect(validateMinimalStructuredOutput(
      '{"status":"expected","extra":"rejected"}',
      'expected',
    )).toEqual({
      classification: 'extra_field',
      accepted: false,
      expectedValueMatched: false,
    });
  });

  it('keeps the real probe prompt out of committed source and evidence', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/output-schema-probe-main.ts'),
      'utf8',
    );
    expect(source).not.toContain('WRITESTORM_PROBE_OK');
    expect(source).not.toMatch(/Return exactly|Thread\.run\(['"]/);
    expect(source).not.toContain('BrowserWindow');
  });
});
