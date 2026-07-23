import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CodexScratchWorkspace = {
  readonly directory: string;
  readonly threadOptions: {
    readonly workingDirectory: string;
    readonly skipGitRepoCheck: true;
  };
  cleanup(): void;
};

export class CodexScratchWorkspaceManager {
  private readonly scratchRoot: string;
  private readonly removeOwnedDirectory: (directory: string) => void;

  constructor(
    temporaryRoot: string = os.tmpdir(),
    options: {
      readonly removeOwnedDirectory?: (directory: string) => void;
    } = {},
  ) {
    if (!path.isAbsolute(temporaryRoot)) {
      throw new Error('AI scratch root must be absolute.');
    }
    const trustedTemporaryRoot = realpathSync(os.tmpdir());
    const requestedTemporaryRoot = realpathSync(temporaryRoot);
    if (!isPathInsideOrEqual(trustedTemporaryRoot, requestedTemporaryRoot)) {
      throw new Error(
        'AI scratch root must be inside the operating-system temporary directory.',
      );
    }
    this.scratchRoot = path.join(requestedTemporaryRoot, 'writestorm-ai-scratch');
    this.removeOwnedDirectory = options.removeOwnedDirectory ?? ((directory) => {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    });
  }

  create(): CodexScratchWorkspace {
    mkdirSync(this.scratchRoot, { recursive: true });
    const directory = mkdtempSync(path.join(this.scratchRoot, 'attempt-'));
    let cleaned = false;
    return {
      directory,
      threadOptions: {
        workingDirectory: directory,
        skipGitRepoCheck: true,
      },
      cleanup: () => {
        if (cleaned) return;
        this.removeOwnedDirectory(directory);
        cleaned = true;
      },
    };
  }
}

function isPathInsideOrEqual(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
