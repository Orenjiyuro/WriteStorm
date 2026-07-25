import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createTask135CompatibilityFingerprint,
  loadTask135CompatibilityBoundary,
} from '../../scripts/task13-5-compatibility-boundary.mjs';
import {
  compactTask1311CompatibilityFingerprint,
} from '../../scripts/task13-11-product-artifact.mjs';

const rootDir = path.resolve(__dirname, '../..');
const evidence = JSON.parse(readFileSync(
  path.join(
    rootDir,
    'docs/engineering/evidence/block13-task13-11-windows-product-packaged-001.json',
  ),
  'utf8',
));

describe('Block 13.11 Windows product packaged evidence', () => {
  it('binds the current production boundary without compatibility drift', () => {
    const current = compactTask1311CompatibilityFingerprint(
      createTask135CompatibilityFingerprint(
        rootDir,
        loadTask135CompatibilityBoundary(rootDir),
        evidence.compatibilityFingerprint.gitHead,
      ),
    );
    expect(current).toEqual(evidence.compatibilityFingerprint);
    expect(evidence.compatibilityFingerprint.gitHead).toBe(
      'f4e6adc2d106946de39563da1da4ed986c4caed8',
    );
    expect(JSON.stringify(evidence.compatibilityFingerprint)).not.toMatch(
      /relativePath|src\/|scripts\/|config\//,
    );
  });

  it('records isolated success, cancel and timeout sessions with complete cleanup', () => {
    expect(evidence.assertions.map((entry: { scenario: string }) => entry.scenario))
      .toEqual(['success', 'cancel', 'timeout']);
    expect(evidence.assertions[0]).toMatchObject({
      outcome: 'success',
      assertions: {
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        cleanupAcknowledged: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      },
    });
    for (const entry of evidence.assertions.slice(1)) {
      expect(entry).toMatchObject({
        outcome: 'aborted',
        assertions: {
          abortRequested: true,
          abortObserved: true,
          cleanupAcknowledged: true,
          utilityExitClean: true,
          ownershipObserved: true,
          residualScanCompleted: true,
          utilityResidualAbsent: true,
          cliResidualAbsent: true,
          scratchCleanupCompleted: true,
        },
      });
    }
  });

  it('retains the Windows development-machine and macOS-deferred limitations', () => {
    expect(evidence.verdict).toBe(
      'windows_product_packaged_runtime_verified_macos_deferred',
    );
    expect(evidence.versions).toEqual({
      electron: '43.0.0',
      nodeRuntime: '24.17.0',
      codexSdk: '0.144.6',
      codexCli: '0.144.6',
      platformPackage: '0.144.6-win32-x64',
    });
    expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.artifact.sha256).toBe(
      'cdb6047852d7c1f10564b07d4aef32e109031bf992ffaf4e65baf036fa35af6d',
    );
    expect(JSON.stringify(evidence)).not.toMatch(
      /prompt|response|rawError|stack|cause|workingDirectory|pathValue|credential|providerId|pid/i,
    );
  });
});
