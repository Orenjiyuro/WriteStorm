import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.8a packaged Codex SDK probe boundary', () => {
  it('uses an explicit no-window packaged-only startup gate', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const probeSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/packaged-probe.ts'),
      'utf8',
    );

    expect(mainSource).toContain('runOptionalPackagedCodexProbe');
    expect(probeSource).toContain("app.isPackaged");
    expect(probeSource).toContain('runOutputSchemaProbe');
    expect(probeSource).not.toContain('BrowserWindow');
    expect(probeSource).not.toMatch(/spawn\([^)]*codex|execFile\([^)]*codex|codex exec|app-server/i);
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

  it('records packaged completion without prematurely issuing the 6A.8b verdict', () => {
    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );

    expect(authority).toContain('Task 6A.8a completed the Windows x64 packaged SDK gate');
    expect(authority).toContain('does not itself issue the Task 6A.8b Windows Go/conditional Go/No-Go decision');
    expect(authority).toContain('macOS packaged runtime remains `deferred-by-user`');
    expect(authority).not.toContain('No packaged SDK probe');
  });
});
