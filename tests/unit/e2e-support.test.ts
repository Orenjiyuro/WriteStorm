import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  resolvePackagedAppPath,
} from '../e2e/electron-app';

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
});
