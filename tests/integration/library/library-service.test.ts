import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryService } from '../../../src/main/library/library-service';
import {
  LIBRARY_DATABASE_FILE_NAME,
  LIBRARY_DIRECTORY_NAMES,
  LIBRARY_MANIFEST_FILE_NAME,
  libraryManifestSchema,
} from '../../../src/main/library/folder-contract';
import type { Migration } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import type { LibraryId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const appVersion = '0.1.0-test';
const now = '2026-07-09T00:00:00.000Z';
const libraryId = 'library-service-test' as LibraryId;
const currentAppSchemaVersion = APP_MIGRATIONS.at(-1)?.id ?? 0;

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('LibraryService create/open/current', () => {
  it('creates a library folder, runs migrations, sets current context, and returns a summary', () => {
    const rootPath = libraryRootPath();
    const service = testLibraryService();

    try {
      const summary = service.create({ rootPath, name: 'Local Library' });

      expect(summary).toEqual({
        id: libraryId,
        name: 'Local Library',
        rootPath,
        schemaVersion: currentAppSchemaVersion,
        appVersion,
      });
      expect(service.getCurrent()).toEqual(summary);
      expect(existsSync(path.join(rootPath, LIBRARY_MANIFEST_FILE_NAME))).toBe(true);
      expect(existsSync(path.join(rootPath, LIBRARY_DATABASE_FILE_NAME))).toBe(true);

      for (const directoryName of LIBRARY_DIRECTORY_NAMES) {
        expect(existsSync(path.join(rootPath, directoryName))).toBe(true);
      }

      const manifest = libraryManifestSchema.parse(
        JSON.parse(readFileSync(path.join(rootPath, LIBRARY_MANIFEST_FILE_NAME), 'utf8')),
      );
      expect(manifest).toMatchObject({
        manifestVersion: 1,
        libraryId,
        name: 'Local Library',
        databaseFileName: LIBRARY_DATABASE_FILE_NAME,
        appVersion,
      });
      expect('schemaVersion' in manifest).toBe(false);
      expect(readLibraryIdentityRow(rootPath)).toEqual({
        id: libraryId,
        name: 'Local Library',
        app_version: appVersion,
      });
    } finally {
      service.closeCurrent();
    }
  });

  it('opens an existing library, runs migrations, and uses SQLite identity and schema authority', async () => {
    const rootPath = libraryRootPath();
    const creator = testLibraryService();
    creator.create({ rootPath, name: 'Open Me' });
    creator.closeCurrent();

    const manifestPath = path.join(rootPath, LIBRARY_MANIFEST_FILE_NAME);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(
      manifestPath,
      JSON.stringify({
        ...manifest,
        libraryId: 'tampered-id',
        name: 'Tampered Manifest Name',
        appVersion: 'tampered-version',
        schemaVersionHint: 999,
      }, null, 2),
    );

    const opener = testLibraryService();

    try {
      const summary = await opener.open({ rootPath });

      expect(summary).toEqual({
        id: libraryId,
        name: 'Open Me',
        rootPath,
        schemaVersion: currentAppSchemaVersion,
        appVersion,
      });
      expect(opener.getCurrent()).toEqual(summary);
    } finally {
      opener.closeCurrent();
    }
  });

  it('rejects opening a library with missing contract directories', async () => {
    const rootPath = libraryRootPath();
    const creator = testLibraryService();
    creator.create({ rootPath, name: 'Missing Directory' });
    creator.closeCurrent();
    rmSync(path.join(rootPath, 'cache'), { recursive: true, force: true });

    const opener = testLibraryService();

    try {
      await expect(opener.open({ rootPath })).rejects.toThrow(/library folder is incomplete/i);
      expect(opener.getCurrent()).toBeNull();
    } finally {
      opener.closeCurrent();
    }
  });

  it('maps read-only probe failures to stable library service errors', async () => {
    const rootPath = libraryRootPath();
    const creator = testLibraryService();
    creator.create({ rootPath, name: 'Broken Database' });
    creator.closeCurrent();
    const databasePath = path.join(rootPath, LIBRARY_DATABASE_FILE_NAME);
    rmSync(databasePath, { force: true });
    mkdirSync(databasePath);

    const opener = testLibraryService();

    try {
      await expect(opener.open({ rootPath })).rejects.toThrow(/Library database could not be validated/i);
      expect(opener.getCurrent()).toBeNull();
    } finally {
      opener.closeCurrent();
    }
  });

  it('rejects opening a manifest-only folder without creating a replacement SQLite database', async () => {
    const rootPath = libraryRootPath();
    const creator = testLibraryService();
    creator.create({ rootPath, name: 'Broken Library' });
    creator.closeCurrent();
    const databasePath = path.join(rootPath, LIBRARY_DATABASE_FILE_NAME);
    rmSync(databasePath, { force: true });

    const opener = testLibraryService();

    try {
      await expect(opener.open({ rootPath })).rejects.toThrow(/SQLite database is missing/i);
      expect(existsSync(databasePath)).toBe(false);
      expect(opener.getCurrent()).toBeNull();
    } finally {
      opener.closeCurrent();
    }
  });

  it('refuses to create over existing database or non-empty library roots', () => {
    const rootPath = libraryRootPath();
    mkdirRootOnly(rootPath);
    writeFileSync(path.join(rootPath, LIBRARY_DATABASE_FILE_NAME), '');
    const service = testLibraryService();

    try {
      expect(() => service.create({ rootPath, name: 'Unsafe Adopt' })).toThrow(/not empty/i);
      expect(existsSync(path.join(rootPath, LIBRARY_MANIFEST_FILE_NAME))).toBe(false);
      expect(existsSync(path.join(rootPath, LIBRARY_DATABASE_FILE_NAME))).toBe(true);
      expect(service.getCurrent()).toBeNull();
    } finally {
      service.closeCurrent();
    }
  });

  it('cleans partial create artifacts when migrations fail', () => {
    const rootPath = libraryRootPath();
    const service = new LibraryService({
      appVersion,
      now: () => now,
      createLibraryId: () => libraryId,
      migrations: [
        {
          id: 1,
          name: 'fail_create',
          up() {
            throw new Error('intentional create failure');
          },
        },
      ] satisfies Migration[],
    });

    try {
      expect(() => service.create({ rootPath, name: 'Partial Library' })).toThrow(
        /Library migration failed/,
      );
      expect(existsSync(rootPath)).toBe(false);
      expect(service.getCurrent()).toBeNull();
    } finally {
      service.closeCurrent();
    }
  });

  it('rejects unsafe existing library child paths before writing facts', () => {
    const rootPath = libraryRootPath();
    const outsidePath = tempDirectory('writestorm-library-service-outside-');
    mkdirRootOnly(rootPath);
    symlinkDirectory(outsidePath, path.join(rootPath, 'source'));
    const service = testLibraryService();

    try {
      expect(() => service.create({ rootPath, name: 'Unsafe Library' })).toThrow(
        /symlink escapes library root/i,
      );
      expect(service.getCurrent()).toBeNull();
      expect(existsSync(path.join(rootPath, LIBRARY_MANIFEST_FILE_NAME))).toBe(false);
    } finally {
      service.closeCurrent();
    }
  });
});

function testLibraryService(): LibraryService {
  return new LibraryService({
    appVersion,
    now: () => now,
    createLibraryId: () => libraryId,
  });
}

function libraryRootPath(): string {
  return path.join(tempDirectory('writestorm-library-service-parent-'), 'library');
}

function tempDirectory(prefix: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

function mkdirRootOnly(rootPath: string): void {
  const parent = path.dirname(rootPath);
  if (!existsSync(parent)) {
    throw new Error(`Missing temp parent: ${parent}`);
  }

  rmSync(rootPath, { recursive: true, force: true });
  mkdirSync(rootPath);
}

function symlinkDirectory(target: string, linkPath: string): void {
  symlinkSync(target, linkPath, 'junction');
}

function readLibraryIdentityRow(rootPath: string): {
  id: string;
  name: string;
  app_version: string;
} {
  const database = openSqliteDatabase(path.join(rootPath, LIBRARY_DATABASE_FILE_NAME));

  try {
    return database
      .prepare('SELECT id, name, app_version FROM library WHERE singleton_key = 1')
      .get() as {
        id: string;
        name: string;
        app_version: string;
      };
  } finally {
    database.close();
  }
}
