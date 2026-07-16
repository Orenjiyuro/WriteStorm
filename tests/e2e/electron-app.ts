import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {
  TEST_DISPLAY_DIAGNOSTIC_PREFIX,
  TEST_DISPLAY_TARGET_ENV,
  type TestDisplayTarget,
} from '../../src/main/windows/test-display-placement';

type PackagedAppPathOptions = {
  cwd?: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
};

type PackagedAppEnvironmentOptions = {
  testDisplayTarget?: TestDisplayTarget;
};

type SpawnPackagedAppOptions = PackagedAppEnvironmentOptions & {
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
};

export type PackagedAppExit = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
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

export function createPackagedAppEnvironment(
  inheritedEnvironment: NodeJS.ProcessEnv = process.env,
  options: PackagedAppEnvironmentOptions = {},
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...inheritedEnvironment,
    WRITESTORM_DISABLE_HARDWARE_ACCELERATION: '1',
  };
  const inheritedTarget = environment[TEST_DISPLAY_TARGET_ENV];
  delete environment[TEST_DISPLAY_TARGET_ENV];

  const target = options.testDisplayTarget ?? inheritedTarget;
  if (target !== undefined) {
    environment[TEST_DISPLAY_TARGET_ENV] = target;
  }

  return environment;
}

export function spawnPackagedApp(options: SpawnPackagedAppOptions = {}): ChildProcess {
  return spawn(resolvePackagedAppPath(), [...(options.args ?? [])], {
    env: createPackagedAppEnvironment(
      {
        ...process.env,
        ...options.env,
      },
      { testDisplayTarget: options.testDisplayTarget },
    ),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

export function spawnPackagedAppOnSecondary(
  options: Omit<SpawnPackagedAppOptions, 'testDisplayTarget'> = {},
): ChildProcess {
  return spawnPackagedApp({ ...options, testDisplayTarget: 'secondary' });
}

export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address?.port
          ? resolve(address.port)
          : reject(new Error('Unable to allocate a local debugging port.')),
      );
    });
    server.once('error', reject);
  });
}

export async function connectToPackagedElectron(
  port: number,
  getAppExit?: () => PackagedAppExit | undefined,
) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const appExit = getAppExit?.();
    if (appExit) {
      throw new Error(
        `Electron exited before CDP connection (code: ${appExit.code ?? 'null'}, signal: ${appExit.signal ?? 'null'}).`,
      );
    }

    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not connect to ${endpoint}`);
}

export function stopPackagedApp(appProcess: ChildProcess): void {
  if (!appProcess.killed) appProcess.kill();
}

export function createElectronStderrBuffer(maxLines = 80): {
  push: (chunk: Buffer | string) => void;
  summary: () => string;
} {
  const lines: string[] = [];
  let partialLine = '';

  return {
    push(chunk: Buffer | string): void {
      const chunks = `${partialLine}${chunk.toString()}`.split(/\r?\n/);
      partialLine = chunks.pop() ?? '';
      for (const line of chunks) {
        if (line.length > 0) lines.push(line);
      }

      if (lines.length > maxLines) {
        lines.splice(0, lines.length - maxLines);
      }
    },
    summary(): string {
      return [...lines, ...(partialLine ? [partialLine] : [])].join('\n');
    },
  };
}

export function formatErrorWithElectronStderr(error: unknown, stderrSummary: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = stderrSummary.length > 0 ? stderrSummary : '(no Electron stderr captured)';

  return new Error(`${message}\n\nElectron stderr (last captured lines):\n${stderr}`);
}

export function parseTestDisplayDiagnostics(stderr: string): Array<Record<string, unknown>> {
  return stderr
    .split(/\r?\n/)
    .filter((line) => line.startsWith(TEST_DISPLAY_DIAGNOSTIC_PREFIX))
    .map((line) => {
      const payload = line.slice(TEST_DISPLAY_DIAGNOSTIC_PREFIX.length);
      const parsed: unknown = JSON.parse(payload);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Invalid test display diagnostic: ${payload}`);
      }

      return parsed as Record<string, unknown>;
    });
}
