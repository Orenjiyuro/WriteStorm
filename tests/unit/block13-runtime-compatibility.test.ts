import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  readAiRuntimeCompatibility,
} from '../../src/main/ai/ai-runtime-compatibility';

describe('Block 13.12 runtime compatibility admission', () => {
  it('admits only packaged Windows x64 with a valid fresh build fingerprint', () => {
    const fresh = {
      state: 'fresh' as const,
      fingerprint: 'a'.repeat(64),
    };
    expect(readAiRuntimeCompatibility({
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      buildAssessment: fresh,
      artifactAssessment: {
        state: 'verified',
        compatibilityFingerprint: fresh.fingerprint,
      },
    })).toEqual(fresh);
    for (const input of [
      { isPackaged: false, platform: 'win32' as const, architecture: 'x64' },
      { isPackaged: true, platform: 'darwin' as const, architecture: 'arm64' },
      { isPackaged: true, platform: 'win32' as const, architecture: 'arm64' },
    ]) {
      expect(readAiRuntimeCompatibility({
        ...input,
        buildAssessment: fresh,
        artifactAssessment: {
          state: 'verified',
          compatibilityFingerprint: fresh.fingerprint,
        },
      })).toEqual({ state: 'blocked' });
    }
  });

  it('preserves stale build assessment and fails malformed freshness closed', () => {
    expect(readAiRuntimeCompatibility({
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      buildAssessment: { state: 'stale' },
      artifactAssessment: { state: 'unverified' },
    })).toEqual({ state: 'stale' });
    expect(readAiRuntimeCompatibility({
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      buildAssessment: { state: 'fresh', fingerprint: 'invalid' },
      artifactAssessment: {
        state: 'verified',
        compatibilityFingerprint: 'invalid',
      },
    })).toEqual({ state: 'blocked' });
  });

  it('never promotes source freshness without the exact certified artifact', () => {
    const fresh = {
      state: 'fresh' as const,
      fingerprint: 'a'.repeat(64),
    };
    for (const artifactAssessment of [
      { state: 'unverified' as const },
      {
        state: 'verified' as const,
        compatibilityFingerprint: 'b'.repeat(64),
      },
    ]) {
      expect(readAiRuntimeCompatibility({
        isPackaged: true,
        platform: 'win32',
        architecture: 'x64',
        buildAssessment: fresh,
        artifactAssessment,
      })).toEqual({ state: 'stale' });
    }
  });

  it('keeps ordinary Forge builds stale until an explicit certification package', () => {
    const source = readFileSync('vite.main.config.ts', 'utf8');
    expect(source).toContain("WRITESTORM_TASK13_CERTIFICATION_BUILD === '1'");
    expect(source).toMatch(/const buildCompatibilityAssessment = certificationBuild\s*\?/);
    expect(source).toContain("state: 'stale' as const");
  });
});
