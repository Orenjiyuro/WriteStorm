import * as path from 'node:path';

export type CodexUtilityProcessHandle = {
  readonly pid: number | undefined;
  on(event: 'spawn', listener: () => void): unknown;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  removeListener(event: 'spawn', listener: () => void): unknown;
  removeListener(event: 'message', listener: (message: unknown) => void): unknown;
  removeListener(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: unknown): void;
  kill(): boolean;
};

export type ForkCodexUtilityProcess = (
  modulePath: string,
  args: readonly [],
  options: {
    readonly serviceName: 'WriteStorm AI Utility';
    readonly stdio: 'pipe';
  },
) => CodexUtilityProcessHandle;

export type CodexUtilityLauncherOptions = {
  readonly mainBundleDirectory: string;
  readonly fork: ForkCodexUtilityProcess;
};

export class CodexUtilityLauncher {
  private readonly modulePath: string;
  private readonly fork: ForkCodexUtilityProcess;

  constructor(options: CodexUtilityLauncherOptions) {
    this.modulePath = resolveCodexUtilityModulePath(options.mainBundleDirectory);
    this.fork = options.fork;
  }

  launch(): CodexUtilityProcessHandle {
    return this.fork(this.modulePath, [], {
      serviceName: 'WriteStorm AI Utility',
      stdio: 'pipe',
    });
  }
}

export function resolveCodexUtilityModulePath(mainBundleDirectory: string): string {
  if (!path.isAbsolute(mainBundleDirectory)) {
    throw new Error('AI utility bundle directory must be absolute.');
  }
  return path.join(mainBundleDirectory, 'codex-utility-entry.js');
}
