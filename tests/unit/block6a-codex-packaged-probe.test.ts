import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.8a packaged Codex SDK probe boundary', () => {
  it('behaviorally rejects development, wrong-target, arbitrary-result, and unapproved synthetic input', async () => {
    const probeModule = await import('../../src/main/codex-feasibility/packaged-probe') as Record<string, unknown>;
    expect(probeModule.evaluatePackagedProbeGate).toBeTypeOf('function');
    const evaluate = probeModule.evaluatePackagedProbeGate as (input: unknown) => { accepted: boolean };
    const base = {
      trigger: '1',
      runId: '123e4567-e89b-42d3-a456-426614174000',
      syntheticInput: 'unapproved arbitrary text',
      syntheticExpected: 'unapproved',
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      temporaryDirectory: 'C:\\Temp',
    };

    expect(evaluate({ ...base, isPackaged: false }).accepted).toBe(false);
    expect(evaluate({ ...base, platform: 'darwin' }).accepted).toBe(false);
    expect(evaluate({ ...base, architecture: 'arm64' }).accepted).toBe(false);
    expect(evaluate(base).accepted).toBe(false);
    expect(JSON.stringify(base)).not.toContain('resultPath');
  });

  it('uses an explicit no-window packaged-only startup gate', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const probeSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/packaged-probe.ts'),
      'utf8',
    );

    expect(mainSource).toContain('runOptionalPackagedCodexProbe');
    expect(probeSource).toContain('evaluatePackagedProbeGate');
    expect(probeSource).toContain('runOutputSchemaProbe');
    expect(probeSource).not.toContain('BrowserWindow');
    expect(probeSource).not.toMatch(/spawn\([^)]*codex|execFile\([^)]*codex|codex exec|app-server/i);
  });

  it('publishes fixed safe reproduction commands and includes package guards in check', () => {
    const packageManifest = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const runnerSource = readFileSync(
      path.join(rootDir, 'scripts/run-block6a-probes.mjs'),
      'utf8',
    );

    expect(packageManifest.scripts['probe:codex:dev']).toBeTruthy();
    expect(packageManifest.scripts['probe:codex:lifecycle']).toBeTruthy();
    expect(packageManifest.scripts['probe:codex:packaged']).toBeTruthy();
    expect(packageManifest.scripts['test:verification']).toContain('tests/verification');
    expect(packageManifest.scripts.check).toContain('test:verification');
    for (const command of Object.values(packageManifest.scripts).filter((value) => value.includes('codex'))) {
      expect(command).not.toMatch(/WRITESTORM_PROBE_OK|OPENAI_API_KEY|CODEX_ACCESS_TOKEN|stdout|stderr/i);
    }
    expect(runnerSource).toContain('evaluateBlock6aProbeResults(mode, results)');
    expect(runnerSource).toContain(
      'if (!evaluation.recertificationAdmitted) process.exitCode = 1;',
    );
    expect(runnerSource).not.toMatch(/failed\|rejected\|infrastructure/);
  });

  it('keeps prompt, schema, credentials and raw process data outside the packaged result contract', () => {
    const probeSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/packaged-probe.ts'),
      'utf8',
    );

    expect(probeSource).not.toContain('WRITESTORM_PROBE_OK');
    expect(probeSource).not.toMatch(/prompt\s*:/i);
    expect(probeSource).not.toMatch(/stdout|stderr|credentialValue|accessToken|utilityPid\s*:/i);
  });

  it('commits separate packaged-runtime and static package-boundary evidence', () => {
    const runtimePath = path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a8a-windows-packaged-sdk.json',
    );
    const packagePath = path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a8a-windows-package-boundary.json',
    );
    const runtimeText = readFileSync(runtimePath, 'utf8');
    const packageText = readFileSync(packagePath, 'utf8');
    const runtime = JSON.parse(runtimeText) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
    };
    const packageBoundary = JSON.parse(packageText) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
    };

    expect(runtime.source).toBe('packaged_sdk');
    expect(runtime.classification).toBe('packaged_sdk_probe_completed');
    expect(Object.values(runtime.assertions).every(Boolean)).toBe(true);
    expect(packageBoundary.source).toBe('static_manifest');
    expect(packageBoundary.classification).toBe('windows_package_boundary_passed');
    expect(Object.values(packageBoundary.assertions).every(Boolean)).toBe(true);
    for (const text of [runtimeText, packageText]) {
      expect(text).not.toMatch(/"(?:prompt|stdout|stderr|pid|path|environmentValue|credential)"\s*:/i);
    }
  });

  it('preserves historical packaged completion while current recertification remains pending', () => {
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );

    expect(authority).toContain('## Task 6A.8a Windows packaged SDK result');
    expect(authority).toContain(
      'The committed runtime record is `docs/engineering/evidence/block6a-task6a8a-windows-packaged-sdk.json`, with `source: packaged_sdk`.',
    );
    expect(authority).toContain('does not itself issue the Task 6A.8b Windows Go/conditional Go/No-Go decision');
    expect(authority).toContain('## Historical Task 6A.8b decision');
    expect(authority).toContain('The current implementation is not Windows-feasibility verified');
    expect(authority).toContain(
      'Verdict: `pending recertification — fresh Windows development evidence was not admitted; historical Windows-only conditional Go remains expired; macOS deferred-by-user`',
    );
    expect(authority).toContain(
      'Windows lifecycle and packaged probes must not be used to bypass this development blocker.',
    );
    expect(authority).toContain('macOS packaged runtime remains `deferred-by-user`');
    expect(authority).not.toContain('No packaged SDK probe');
  });
});
