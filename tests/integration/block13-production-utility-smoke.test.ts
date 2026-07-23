import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
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
      networkGuardInstalled: true,
      networkAttemptCount: 0,
      networkAccessObserved: false,
      cleanupCompleted: true,
    });
  });

  it('blocks a real socket attempt and records only its sanitized kind', () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'writestorm-network-blocker-'));
    const observationPath = path.join(temporaryRoot, 'observation.json');
    const blockerPath = path.join(rootDir, 'tests/smoke/block13-network-blocker.cjs');
    try {
      const result = spawnSync(
        process.execPath,
        ['--require', blockerPath, '-e', "require('node:net').connect(9, '127.0.0.1')"],
        {
          cwd: rootDir,
          env: {
            ...process.env,
            WRITESTORM_BLOCK13_NETWORK_OBSERVATION: observationPath,
          },
          encoding: 'utf8',
          timeout: 10_000,
          windowsHide: true,
        },
      );
      expect(result.status).not.toBe(0);
      expect(JSON.parse(readFileSync(observationPath, 'utf8'))).toEqual({
        schemaVersion: 1,
        installed: true,
        attemptCount: 1,
        attemptedKinds: ['net.connect'],
      });
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
