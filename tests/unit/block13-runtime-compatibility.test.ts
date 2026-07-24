import { describe, expect, it } from 'vitest';
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
    })).toEqual(fresh);
    for (const input of [
      { isPackaged: false, platform: 'win32' as const, architecture: 'x64' },
      { isPackaged: true, platform: 'darwin' as const, architecture: 'arm64' },
      { isPackaged: true, platform: 'win32' as const, architecture: 'arm64' },
    ]) {
      expect(readAiRuntimeCompatibility({
        ...input,
        buildAssessment: fresh,
      })).toEqual({ state: 'blocked' });
    }
  });

  it('preserves stale build assessment and fails malformed freshness closed', () => {
    expect(readAiRuntimeCompatibility({
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      buildAssessment: { state: 'stale' },
    })).toEqual({ state: 'stale' });
    expect(readAiRuntimeCompatibility({
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      buildAssessment: { state: 'fresh', fingerprint: 'invalid' },
    })).toEqual({ state: 'blocked' });
  });
});
