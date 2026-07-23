import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.4 production Codex utility smoke', () => {
  it('builds and launches the real production entry offline and fails closed', () => {
    const output = execFileSync(
      process.execPath,
      [path.join(rootDir, 'scripts/smoke-block13-production-utility.mjs')],
      {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 60_000,
        windowsHide: true,
      },
    );
    expect(JSON.parse(output)).toEqual({
      schemaVersion: 1,
      classification: 'production_utility_offline_smoke_passed',
      exactBundleResolved: true,
      sdkExportImported: true,
      unsupportedMessageExitCode: 28,
      credentialEnvironmentExcluded: true,
      proxyEnvironmentExcluded: true,
      networkRequestStarted: false,
      cleanupCompleted: true,
    });
  });
});
