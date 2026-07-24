import { lstatSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
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
  private readonly temporaryRoot: string;
  private readonly trustedTemporaryRoot: string;
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
    this.temporaryRoot = requestedTemporaryRoot;
    this.trustedTemporaryRoot = trustedTemporaryRoot;
    this.removeOwnedDirectory = options.removeOwnedDirectory ?? ((directory) => {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    });
  }

  create(): CodexScratchWorkspace {
    const lexicalDirectory = mkdtempSync(path.join(
      this.temporaryRoot,
      'writestorm-ai-scratch-',
    ));
    const directory = this.assertOwnedDirectory(lexicalDirectory);
    let cleaned = false;
    return {
      directory,
      threadOptions: {
        workingDirectory: directory,
        skipGitRepoCheck: true,
      },
      cleanup: () => {
        if (cleaned) return;
        this.assertOwnedDirectory(directory);
        this.removeOwnedDirectory(directory);
        cleaned = true;
      },
    };
  }

  private assertOwnedDirectory(directory: string): string {
    const metadata = lstatSync(directory);
    const resolved = realpathSync(directory);
    if (metadata.isSymbolicLink()
      || !metadata.isDirectory()
      || !isPathInsideOrEqual(this.trustedTemporaryRoot, resolved)
      || !isPathInsideOrEqual(this.temporaryRoot, resolved)
      || path.resolve(resolved) !== path.resolve(directory)) {
      throw new Error('AI scratch directory failed its temporary boundary check.');
    }
    return resolved;
  }
}

function isPathInsideOrEqual(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
