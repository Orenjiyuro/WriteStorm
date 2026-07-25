import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateCodexProductPackagedProbeGate,
  prepareCodexProductProbeResultPath,
  runOptionalCodexProductPackagedProbe,
} from '../../src/main/ai/providers/codex/codex-product-packaged-probe';

const rootDir = path.resolve(__dirname, '../..');
const runId = '123e4567-e89b-42d3-a456-426614174000';

describe('Block 13.11 product packaged probe gate', () => {
  it('keeps normal startup disabled without the one exact trigger', () => {
    expect(evaluateCodexProductPackagedProbeGate({
      trigger: undefined,
      runId: undefined,
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      temporaryDirectory: 'C:\\Temp',
    })).toEqual({ accepted: false, reason: 'disabled' });
  });

  it('does not fork, write or exit during ordinary product startup', async () => {
    const fork = vi.fn(() => {
      throw new Error('must remain offline');
    });
    const exitApp = vi.fn();

    await expect(runOptionalCodexProductPackagedProbe({
      env: {},
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      temporaryDirectory: 'C:\\Temp',
      mainBundleDirectory: 'C:\\Product\\resources\\app.asar\\.vite\\build',
      resourcesPath: 'C:\\Product\\resources',
      executablePath: 'C:\\Product\\writestorm.exe',
      fork,
      electronVersion: '43.0.0',
      nodeRuntimeVersion: '24.17.0',
      exitApp,
    })).resolves.toBe(false);
    expect(fork).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('requires packaged Windows x64 and a UUID before preparing output', () => {
    expect(evaluateCodexProductPackagedProbeGate({
      trigger: '1',
      runId,
      isPackaged: true,
      platform: 'win32',
      architecture: 'x64',
      temporaryDirectory: 'C:\\Temp',
    })).toEqual({
      accepted: true,
      reason: 'accepted',
      runId,
    });

    for (const candidate of [
      { isPackaged: false, platform: 'win32', architecture: 'x64' },
      { isPackaged: true, platform: 'darwin', architecture: 'arm64' },
      { isPackaged: true, platform: 'win32', architecture: 'arm64' },
    ] as const) {
      expect(evaluateCodexProductPackagedProbeGate({
        trigger: '1',
        runId,
        temporaryDirectory: 'C:\\Temp',
        ...candidate,
      }).accepted).toBe(false);
    }
  });

  it('rejects a pre-created junction or symlink before writing probe output', () => {
    expect(typeof prepareCodexProductProbeResultPath).toBe('function');
    const root = mkdtempSync(path.join(os.tmpdir(), 'writestorm-probe-output-'));
    const outside = mkdtempSync(path.join(os.tmpdir(), 'writestorm-probe-outside-'));
    const base = path.join(root, 'writestorm-task13-11-product');
    const runRoot = path.join(base, runId);
    mkdirSync(base);
    symlinkSync(outside, runRoot, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      expect(() => prepareCodexProductProbeResultPath({
        temporaryDirectory: root,
        runId,
      })).toThrow();
      expect(existsSync(path.join(outside, 'result.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('rejects arbitrary paths, inputs and malformed run identifiers by construction', () => {
    for (const malformed of ['../escape', 'not-a-uuid', '', '123e4567-e89b-12d3-a456-426614174000']) {
      expect(evaluateCodexProductPackagedProbeGate({
        trigger: '1',
        runId: malformed,
        isPackaged: true,
        platform: 'win32',
        architecture: 'x64',
        temporaryDirectory: 'C:\\Temp',
      }).accepted).toBe(false);
    }
    const source = readFileSync(
      path.join(rootDir, 'src/main/ai/providers/codex/codex-product-packaged-probe.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/RESULT_PATH|SYNTHETIC_INPUT|SYNTHETIC_EXPECTED|LIBRARY|SQLITE/i);
  });

  it('runs before product IPC and window creation without changing normal startup behavior', () => {
    const main = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const probeIndex = main.indexOf('runOptionalCodexProductPackagedProbe');
    const ipcIndex = main.indexOf('registerProductIpc(ipcMain');
    const windowIndex = main.indexOf('await createWindow()');

    expect(probeIndex).toBeGreaterThan(-1);
    expect(probeIndex).toBeLessThan(ipcIndex);
    expect(probeIndex).toBeLessThan(windowIndex);
    expect(main).toContain('if (productProbeHandled) return;');
  });
});
