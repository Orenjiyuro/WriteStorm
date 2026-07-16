import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createPackagedAppEnvironment,
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  parseTestDisplayDiagnostics,
  resolvePackagedAppPath,
} from '../e2e/electron-app';
import { TEST_DISPLAY_TARGET_ENV } from '../../src/main/windows/test-display-placement';

describe('Electron e2e support', () => {
  it('resolves the packaged app executable for Windows', () => {
    expect(resolvePackagedAppPath({ cwd: 'C:\\repo', platform: 'win32', arch: 'x64' })).toBe(
      path.join('C:\\repo', 'out', 'writestorm-win32-x64', 'writestorm.exe'),
    );
  });

  it('resolves the packaged app executable for macOS', () => {
    expect(resolvePackagedAppPath({ cwd: '/repo', platform: 'darwin', arch: 'arm64' })).toContain(
      path.join('out', 'writestorm-darwin-arm64', 'writestorm.app', 'Contents', 'MacOS', 'writestorm'),
    );
  });

  it('keeps a bounded stderr summary for failed Electron launches', () => {
    const stderr = createElectronStderrBuffer(2);

    stderr.push('first\nsecond\n');
    stderr.push('third\n');

    expect(stderr.summary()).toBe('second\nthird');
  });

  it('attaches Electron stderr to thrown test errors', () => {
    const error = formatErrorWithElectronStderr(new Error('connect failed'), 'GPU process failed');

    expect(error.message).toContain('connect failed');
    expect(error.message).toContain('Electron stderr');
    expect(error.message).toContain('GPU process failed');
  });

  it('enables secondary placement only when the packaged launcher explicitly requests it', () => {
    const normal = createPackagedAppEnvironment({
      INHERITED: 'yes',
      [TEST_DISPLAY_TARGET_ENV]: 'secondary',
    });
    const screenshot = createPackagedAppEnvironment(
      { INHERITED: 'yes' },
      { testDisplayTarget: 'secondary' },
    );

    expect(normal).toMatchObject({
      INHERITED: 'yes',
      WRITESTORM_DISABLE_HARDWARE_ACCELERATION: '1',
    });
    expect(normal[TEST_DISPLAY_TARGET_ENV]).toBeUndefined();
    expect(screenshot[TEST_DISPLAY_TARGET_ENV]).toBe('secondary');
  });

  it('parses structured main-process display evidence from stderr', () => {
    const stderr = [
      'ordinary Electron diagnostic',
      'WRITESTORM_E2E_DISPLAY {"event":"window-placement","centerDisplayId":2}',
    ].join('\n');

    expect(parseTestDisplayDiagnostics(stderr)).toEqual([
      { event: 'window-placement', centerDisplayId: 2 },
    ]);
  });
});
