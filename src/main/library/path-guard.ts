import { existsSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

export type LibraryPathGuardErrorKind =
  | 'absolute_child_path'
  | 'path_outside_library_root'
  | 'symlink_escapes_library_root';

export class LibraryPathGuardError extends Error {
  readonly kind: LibraryPathGuardErrorKind;

  constructor(kind: LibraryPathGuardErrorKind, message: string) {
    super(message);
    this.name = 'LibraryPathGuardError';
    this.kind = kind;
  }
}

export function resolveLibraryRelativePath(rootPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new LibraryPathGuardError(
      'absolute_child_path',
      'Library child path must be relative to the library root.',
    );
  }

  return assertPathInsideLibraryRoot(rootPath, path.resolve(rootPath, relativePath));
}

export function assertPathInsideLibraryRoot(rootPath: string, candidatePath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);

  if (!isPathInsideOrEqual(resolvedRoot, resolvedCandidate)) {
    throw new LibraryPathGuardError(
      'path_outside_library_root',
      'Library path must stay inside library root.',
    );
  }

  assertExistingPathSegmentsDoNotEscapeRoot(resolvedRoot, resolvedCandidate);

  return resolvedCandidate;
}

function assertExistingPathSegmentsDoNotEscapeRoot(
  resolvedRoot: string,
  resolvedCandidate: string,
): void {
  const realRoot = safeRealpath(resolvedRoot) ?? resolvedRoot;
  const relativeCandidate = path.relative(resolvedRoot, resolvedCandidate);

  if (!relativeCandidate) {
    return;
  }

  let currentPath = resolvedRoot;

  for (const segment of relativeCandidate.split(path.sep)) {
    if (!segment) {
      continue;
    }

    currentPath = path.join(currentPath, segment);

    if (!existsSync(currentPath)) {
      break;
    }

    const stats = lstatSync(currentPath);

    if (!stats.isSymbolicLink()) {
      continue;
    }

    const realCurrentPath = realpathSync(currentPath);

    if (!isPathInsideOrEqual(realRoot, realCurrentPath)) {
      throw new LibraryPathGuardError(
        'symlink_escapes_library_root',
        'Library path symlink escapes library root.',
      );
    }
  }
}

function safeRealpath(targetPath: string): string | undefined {
  if (!existsSync(targetPath)) {
    return undefined;
  }

  return realpathSync(targetPath);
}

function isPathInsideOrEqual(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);

  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}
