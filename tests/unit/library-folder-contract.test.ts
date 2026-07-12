import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLibraryFolderPaths,
  createLibraryManifest,
  LIBRARY_DATABASE_FILE_NAME,
  LIBRARY_DIRECTORY_NAMES,
  LIBRARY_MANIFEST_FILE_NAME,
  libraryManifestSchema,
} from '../../src/main/library/folder-contract';

const isoTimestamp = '2026-07-09T00:00:00.000Z';

describe('library folder contract', () => {
  it('defines the V1 library root layout without making manifest authoritative', () => {
    expect(LIBRARY_MANIFEST_FILE_NAME).toBe('manifest.json');
    expect(LIBRARY_DATABASE_FILE_NAME).toBe('writestorm.sqlite');
    expect(LIBRARY_DIRECTORY_NAMES).toEqual(['source', 'exports', 'logs', 'cache', 'mirrors', 'backups']);

    const rootPath = path.resolve('tmp', 'block6-library');
    const paths = buildLibraryFolderPaths(rootPath);

    expect(paths.rootPath).toBe(rootPath);
    expect(paths.manifestPath).toBe(path.join(rootPath, 'manifest.json'));
    expect(paths.databasePath).toBe(path.join(rootPath, 'writestorm.sqlite'));
    expect(paths.directories).toEqual({
      source: path.join(rootPath, 'source'),
      exports: path.join(rootPath, 'exports'),
      logs: path.join(rootPath, 'logs'),
      cache: path.join(rootPath, 'cache'),
      mirrors: path.join(rootPath, 'mirrors'),
      backups: path.join(rootPath, 'backups'),
    });
  });

  it('uses manifestVersion and optional schemaVersionHint instead of authoritative schemaVersion', () => {
    const manifest = createLibraryManifest({
      libraryId: 'library-1',
      name: 'Local Library',
      appVersion: '0.1.0',
      now: isoTimestamp,
      schemaVersionHint: 0,
    });

    expect(libraryManifestSchema.parse(manifest)).toEqual({
      manifestVersion: 1,
      libraryId: 'library-1',
      name: 'Local Library',
      databaseFileName: 'writestorm.sqlite',
      appVersion: '0.1.0',
      createdAt: isoTimestamp,
      updatedAt: isoTimestamp,
      schemaVersionHint: 0,
    });
    expect(libraryManifestSchema.safeParse({ ...manifest, schemaVersion: 1 }).success).toBe(false);
  });

  it('rejects business facts in the manifest so SQLite remains the fact source', () => {
    const manifest = createLibraryManifest({
      libraryId: 'library-1',
      name: 'Local Library',
      appVersion: '0.1.0',
      now: isoTimestamp,
    });

    for (const factField of ['books', 'sourceTexts', 'analysisModuleInstances', 'techniqueEntries', 'perspectiveViews']) {
      expect(libraryManifestSchema.safeParse({ ...manifest, [factField]: [] }).success).toBe(false);
    }
  });
});
