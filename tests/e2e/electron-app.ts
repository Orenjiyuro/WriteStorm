import path from 'node:path';

type PackagedAppPathOptions = {
  cwd?: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
};

export function isSupportedPackagedPlatform(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'win32' || platform === 'darwin';
}

export function resolvePackagedAppPath(options: PackagedAppPathOptions = {}): string {
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;

  if (platform === 'win32') {
    return path.join(cwd, 'out', `writestorm-win32-${arch}`, 'writestorm.exe');
  }

  if (platform === 'darwin') {
    return path.join(
      cwd,
      'out',
      `writestorm-darwin-${arch}`,
      'writestorm.app',
      'Contents',
      'MacOS',
      'writestorm',
    );
  }

  throw new Error(`Unsupported packaged Electron smoke platform: ${platform}`);
}

export function createElectronStderrBuffer(maxLines = 80): {
  push: (chunk: Buffer | string) => void;
  summary: () => string;
} {
  const lines: string[] = [];

  return {
    push(chunk: Buffer | string): void {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.length > 0) {
          lines.push(line);
        }
      }

      if (lines.length > maxLines) {
        lines.splice(0, lines.length - maxLines);
      }
    },
    summary(): string {
      return lines.join('\n');
    },
  };
}

export function formatErrorWithElectronStderr(error: unknown, stderrSummary: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = stderrSummary.length > 0 ? stderrSummary : '(no Electron stderr captured)';

  return new Error(`${message}\n\nElectron stderr (last captured lines):\n${stderr}`);
}
