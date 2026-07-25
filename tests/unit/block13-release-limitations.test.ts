import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const matrixPath = path.join(rootDir, 'config/block13-release-limitations-v1.json');

describe('Block 13.10 release limitation matrix', () => {
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as Record<string, unknown>;

  it('is a versioned exact platform and environment authority', () => {
    expect(matrix).toEqual({
      schemaVersion: 1,
      authority: 'block13-task13-10-release-limitations-v1',
      gateAuthority: 'config/block13-ai-gate-v1.json',
      platforms: {
        windows: {
          feasibility: 'verified',
          productPackagedRuntime: 'historical_verified_current_recertification_required',
          cleanMachine: 'unverified',
          signing: 'unverified',
          defender: 'unverified',
        },
        macos: {
          productPackagedRuntime: 'deferred_by_user',
          signing: 'unverified',
          notarization: 'unverified',
        },
      },
      environments: {
        proxy: 'unverified',
        enterpriseCertificates: 'unverified',
        firewall: 'unverified',
        offline: 'unverified',
      },
      telemetry: {
        applicationRemoteUpload: 'disabled_by_default',
        sdkTelemetry: 'unverified',
      },
      distribution: {
        sdkCliLicensesAndNotices: 'unverified',
        artifactReceiptProvenance: 'workflow_only_not_cryptographically_verified',
      },
    });
  });

  it('does not promote conditional evidence to full or release readiness', () => {
    const raw = JSON.stringify(matrix);
    expect(raw).not.toMatch(/\bFull Go\b|\bCross-platform Go\b|\bAI ready\b|\brelease ready\b/);
  });
});
