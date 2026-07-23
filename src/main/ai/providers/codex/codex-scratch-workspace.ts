import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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

  constructor(temporaryRoot: string) {
    if (!path.isAbsolute(temporaryRoot)) {
      throw new Error('AI scratch root must be absolute.');
    }
    this.scratchRoot = path.join(path.normalize(temporaryRoot), 'writestorm-ai-scratch');
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
        cleaned = true;
        rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      },
    };
  }
}
