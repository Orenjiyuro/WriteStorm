import path from 'node:path';
import { z } from 'zod';

export const LIBRARY_MANIFEST_FILE_NAME = 'manifest.json';
export const LIBRARY_DATABASE_FILE_NAME = 'writestorm.sqlite';
export const LIBRARY_DIRECTORY_NAMES = ['source', 'exports', 'logs', 'cache', 'mirrors', 'backups'] as const;
export const LIBRARY_MANIFEST_VERSION = 1;

export type LibraryDirectoryName = (typeof LIBRARY_DIRECTORY_NAMES)[number];

export type LibraryFolderPaths = {
  readonly rootPath: string;
  readonly manifestPath: string;
  readonly databasePath: string;
  readonly directories: Record<LibraryDirectoryName, string>;
};

export type LibraryManifest = {
  readonly manifestVersion: typeof LIBRARY_MANIFEST_VERSION;
  readonly libraryId: string;
  readonly name: string;
  readonly databaseFileName: typeof LIBRARY_DATABASE_FILE_NAME;
  readonly appVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly schemaVersionHint?: number;
};

export type CreateLibraryManifestInput = {
  readonly libraryId: string;
  readonly name: string;
  readonly appVersion: string;
  readonly now: string;
  readonly schemaVersionHint?: number;
};

export const libraryManifestSchema = z.object({
  manifestVersion: z.literal(LIBRARY_MANIFEST_VERSION),
  libraryId: z.string().min(1),
  name: z.string().min(1),
  databaseFileName: z.literal(LIBRARY_DATABASE_FILE_NAME),
  appVersion: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  schemaVersionHint: z.number().int().nonnegative().optional(),
}).strict() as z.ZodType<LibraryManifest>;

export function buildLibraryFolderPaths(rootPath: string): LibraryFolderPaths {
  const resolvedRoot = path.resolve(rootPath);

  return {
    rootPath: resolvedRoot,
    manifestPath: path.join(resolvedRoot, LIBRARY_MANIFEST_FILE_NAME),
    databasePath: path.join(resolvedRoot, LIBRARY_DATABASE_FILE_NAME),
    directories: {
      source: path.join(resolvedRoot, 'source'),
      exports: path.join(resolvedRoot, 'exports'),
      logs: path.join(resolvedRoot, 'logs'),
      cache: path.join(resolvedRoot, 'cache'),
      mirrors: path.join(resolvedRoot, 'mirrors'),
      backups: path.join(resolvedRoot, 'backups'),
    },
  };
}

export function createLibraryManifest(input: CreateLibraryManifestInput): LibraryManifest {
  return libraryManifestSchema.parse({
    manifestVersion: LIBRARY_MANIFEST_VERSION,
    libraryId: input.libraryId,
    name: input.name,
    databaseFileName: LIBRARY_DATABASE_FILE_NAME,
    appVersion: input.appVersion,
    createdAt: input.now,
    updatedAt: input.now,
    ...(input.schemaVersionHint === undefined ? {} : { schemaVersionHint: input.schemaVersionHint }),
  });
}
