import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { PersistedSourceText } from './source-text-repository';
import { resolveLibraryRelativePath } from '../library/path-guard';

export type SourceHealthIssue =
  | {
      readonly kind: 'stale_staging';
      readonly relativePath: string;
      readonly autoRemovable: true;
    }
  | {
      readonly kind: 'orphan_source';
      readonly relativePath: string;
      readonly autoRemovable: false;
    }
  | {
      readonly kind: 'missing_source' | 'hash_mismatch';
      readonly sourceTextId: string;
      readonly relativePath: string;
      readonly autoRemovable: false;
    };

export async function inspectSourceHealth(input: {
  readonly libraryRootPath: string;
  readonly sourceTexts: readonly PersistedSourceText[];
  readonly staleStagingBefore: Date;
}): Promise<SourceHealthIssue[]> {
  const issues: SourceHealthIssue[] = [];
  const referencedPaths = new Set(input.sourceTexts.map((sourceText) => normalizeRelativePath(
    sourceText.relativePath,
  )));

  for (const sourceText of input.sourceTexts) {
    const relativePath = normalizeRelativePath(sourceText.relativePath);
    let sourcePath: string;
    try {
      sourcePath = resolveLibraryRelativePath(input.libraryRootPath, relativePath);
      if (!(await isRegularFile(sourcePath))) {
        issues.push(missingIssue(sourceText.id, relativePath));
        continue;
      }
    } catch {
      issues.push(missingIssue(sourceText.id, relativePath));
      continue;
    }

    if (await sha256File(sourcePath) !== sourceText.contentHash) {
      issues.push({
        kind: 'hash_mismatch',
        sourceTextId: sourceText.id,
        relativePath,
        autoRemovable: false,
      });
    }
  }

  const sourceRoot = path.join(input.libraryRootPath, 'source');
  for (const filePath of await listFiles(sourceRoot)) {
    const relativePath = normalizeRelativePath(path.relative(input.libraryRootPath, filePath));
    if (relativePath.startsWith('source/.staging/')) {
      const fileStats = await stat(filePath);
      if (fileStats.mtime < input.staleStagingBefore) {
        issues.push({ kind: 'stale_staging', relativePath, autoRemovable: true });
      }
      continue;
    }
    if (!referencedPaths.has(relativePath)) {
      issues.push({ kind: 'orphan_source', relativePath, autoRemovable: false });
    }
  }

  return issues.sort((left, right) => (
    left.kind.localeCompare(right.kind) || left.relativePath.localeCompare(right.relativePath)
  ));
}

export async function removeAutoRemovableSourceHealthIssues(
  libraryRootPath: string,
  issues: readonly SourceHealthIssue[],
): Promise<string[]> {
  const removed: string[] = [];
  const stagingRoot = path.resolve(resolveLibraryRelativePath(libraryRootPath, 'source/.staging'));
  for (const issue of issues) {
    if (issue.kind !== 'stale_staging' || !issue.autoRemovable) continue;
    const relativePath = normalizeRelativePath(issue.relativePath);
    if (!relativePath.startsWith('source/.staging/')) continue;
    const targetPath = path.resolve(resolveLibraryRelativePath(libraryRootPath, relativePath));
    if (!targetPath.startsWith(`${stagingRoot}${path.sep}`)) continue;
    await rm(targetPath, { force: true });
    removed.push(relativePath);
  }
  return removed.sort();
}

async function listFiles(rootPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(rootPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isSymbolicLink()) {
      files.push(entryPath);
    } else if (entry.isDirectory()) {
      const nestedFiles = await listFiles(entryPath);
      if (nestedFiles.length === 0 && entry.name !== '.staging') {
        files.push(entryPath);
      } else {
        files.push(...nestedFiles);
      }
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await lstat(filePath)).isFile();
  } catch {
    return false;
  }
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
  });
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/');
}

function missingIssue(sourceTextId: string, relativePath: string): SourceHealthIssue {
  return { kind: 'missing_source', sourceTextId, relativePath, autoRemovable: false };
}
