import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations, type Migration } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import {
  createPreMigrationBackup,
  pruneMigrationBackups,
} from '../../../src/main/library/migration-backup';
import { probeLibraryDatabase } from '../../../src/main/library/library-database-probe';
import { LibraryService } from '../../../src/main/library/library-service';
import type { LibraryId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const now = '2026-07-12T01:02:03.000Z';
const libraryId = 'migration-backup-library' as LibraryId;
const pendingMigration: Migration = {
  id: 2,
  name: 'migration_backup_test',
  up(database) {
    database.exec('CREATE TABLE migration_backup_proof (id INTEGER PRIMARY KEY)');
  },
};
const pendingRegistry = [...APP_MIGRATIONS, pendingMigration] as const;

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('migration backup and safe Library open', () => {
  it('orders probe, backup, migration, post-validation, then session publication', async () => {
    const rootPath = await baselineLibrary();
    const calls: string[] = [];
    let probeCount = 0;
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      migrations: pendingRegistry,
      probeDatabase: (databasePath, migrations) => {
        calls.push(probeCount++ === 0 ? 'probe' : 'validate');
        return probeLibraryDatabase(databasePath, migrations);
      },
      openDatabase: (databasePath) => {
        calls.push('writable-open');
        return openSqliteDatabase(databasePath);
      },
      backupDatabase: async (databasePath, targetPath) => {
        calls.push('backup');
        await createPreMigrationBackup(databasePath, targetPath);
      },
      migrateDatabase: (database, migrations) => {
        calls.push('migrate');
        runMigrations(database, migrations);
      },
      validateSchema: (database, migrations) => {
        calls.push('validate-schema');
        return validateRuntimeSchema(database, migrations);
      },
      createLibrarySessionId: () => {
        calls.push('publish-session');
        return 'migration-backup-session';
      },
    });

    try {
      await service.open({ rootPath });
      expect(calls).toEqual([
        'probe',
        'backup',
        'writable-open',
        'migrate',
        'validate',
        'validate-schema',
        'publish-session',
      ]);
      expect(service.getCurrent()?.library.schemaVersion).toBe(2);
      expect(readdirSync(path.join(rootPath, 'backups'))).toHaveLength(1);
    } finally {
      service.closeCurrent();
    }
  });

  it('does not migrate or replace the current session when backup fails', async () => {
    const currentRoot = path.join(tempDirectory(), 'current');
    const pendingRoot = await baselineLibrary('pending');
    const calls: string[] = [];
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      migrations: pendingRegistry,
      backupDatabase: async () => {
        calls.push('backup');
        throw new Error('intentional backup failure');
      },
      openDatabase: (databasePath) => {
        calls.push('writable-open');
        return openSqliteDatabase(databasePath);
      },
      migrateDatabase: (database, migrations) => {
        calls.push('migrate');
        runMigrations(database, migrations);
      },
    });
    const backupsPath = path.join(pendingRoot, 'backups');
    for (let index = 1; index <= 4; index += 1) {
      writeFileSync(
        path.join(backupsPath, `pre-migration-1-2-20260712T01020${index}Z.sqlite`),
        `backup-${index}`,
      );
    }
    const backupsBeforeFailure = readdirSync(backupsPath).sort();

    try {
      service.create({ rootPath: currentRoot, name: 'current' });
      const current = service.getCurrent();
      calls.length = 0;
      await expect(service.open({ rootPath: pendingRoot })).rejects.toMatchObject({
        reason: 'migration_backup_failed',
        recoverable: false,
      });
      expect(calls).toEqual(['backup']);
      expect(readdirSync(backupsPath).sort()).toEqual(backupsBeforeFailure);
      expect(service.getCurrent()).toEqual(current);
    } finally {
      service.closeCurrent();
    }
  });

  it('creates valid online snapshots and retains only the newest three', async () => {
    const rootPath = await baselineLibrary();
    const databasePath = path.join(rootPath, 'writestorm.sqlite');
    const backupsPath = path.join(rootPath, 'backups');
    for (let index = 1; index <= 4; index += 1) {
      const targetPath = path.join(backupsPath, `pre-migration-1-2-20260712T01020${index}Z.sqlite`);
      await createPreMigrationBackup(databasePath, targetPath);
    }
    pruneMigrationBackups(backupsPath, 3);

    const backups = readdirSync(backupsPath).sort();
    expect(backups).toEqual([
      'pre-migration-1-2-20260712T010202Z.sqlite',
      'pre-migration-1-2-20260712T010203Z.sqlite',
      'pre-migration-1-2-20260712T010204Z.sqlite',
    ]);
    for (const backup of backups) {
      const snapshot = openSqliteDatabase(path.join(backupsPath, backup));
      try {
        expect(snapshot.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(snapshot.prepare('SELECT MAX(id) FROM schema_migrations').pluck().get()).toBe(1);
      } finally {
        snapshot.close();
      }
    }
  });

  it('retains newest timestamps across different migration version pairs', () => {
    const backupsPath = tempDirectory();
    const backupNames = [
      'pre-migration-9-10-20260712T010201Z.sqlite',
      'pre-migration-10-11-20260712T010204Z.sqlite',
      'pre-migration-2-20-20260712T010203Z.sqlite',
      'pre-migration-20-21-20260712T010202Z.sqlite',
    ];
    for (const backupName of backupNames) {
      writeFileSync(path.join(backupsPath, backupName), backupName);
    }
    writeFileSync(path.join(backupsPath, 'notes.txt'), 'preserve');

    pruneMigrationBackups(backupsPath, 3);

    expect(readdirSync(backupsPath).sort()).toEqual([
      'notes.txt',
      'pre-migration-10-11-20260712T010204Z.sqlite',
      'pre-migration-2-20-20260712T010203Z.sqlite',
      'pre-migration-20-21-20260712T010202Z.sqlite',
    ]);
  });

  it('uses the filename as a stable tie-break for equal timestamps', () => {
    const backupsPath = tempDirectory();
    for (const version of ['1-2', '2-3', '3-4', '4-5']) {
      const name = `pre-migration-${version}-20260712T010204Z.sqlite`;
      writeFileSync(path.join(backupsPath, name), name);
    }

    pruneMigrationBackups(backupsPath, 3);

    expect(readdirSync(backupsPath).sort()).toEqual([
      'pre-migration-2-3-20260712T010204Z.sqlite',
      'pre-migration-3-4-20260712T010204Z.sqlite',
      'pre-migration-4-5-20260712T010204Z.sqlite',
    ]);
  });

  it('rejects a migrated database whose resulting schema differs from its migration registry', async () => {
    const rootPath = await baselineLibrary();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      migrations: pendingRegistry,
      migrateDatabase: (database, migrations) => {
        runMigrations(database, migrations);
        database.exec('DROP TABLE migration_backup_proof');
      },
    });

    try {
      await expect(service.open({ rootPath })).rejects.toMatchObject({
        reason: 'library_schema_incompatible',
      });
      expect(service.getCurrent()).toBeNull();
    } finally {
      service.closeCurrent();
    }
  });

  it('keeps the snapshot and rolls back the database when migration fails', async () => {
    const rootPath = await baselineLibrary();
    const failingRegistry = [
      ...APP_MIGRATIONS,
      {
        id: 2,
        name: 'failing_migration',
        up(database) {
          database.exec('CREATE TABLE must_roll_back (id INTEGER PRIMARY KEY)');
          throw new Error('intentional migration failure');
        },
      },
    ] satisfies readonly Migration[];
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      migrations: failingRegistry,
    });

    await expect(service.open({ rootPath })).rejects.toMatchObject({
      reason: 'migration_failed',
      recoverable: false,
    });
    expect(service.getCurrent()).toBeNull();
    expect(readdirSync(path.join(rootPath, 'backups'))).toHaveLength(1);

    const database = openSqliteDatabase(path.join(rootPath, 'writestorm.sqlite'));
    try {
      expect(database.prepare('SELECT MAX(id) FROM schema_migrations').pluck().get()).toBe(1);
      expect(database.prepare(`
        SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'must_roll_back'
      `).pluck().get()).toBe(0);
    } finally {
      database.close();
    }

    const baselineService = new LibraryService({ appVersion: '0.1.0-test' });
    try {
      await expect(baselineService.open({ rootPath })).resolves.toMatchObject({
        library: { schemaVersion: 1 },
      });
    } finally {
      baselineService.closeCurrent();
    }
  });
});

async function baselineLibrary(suffix = 'library'): Promise<string> {
  const rootPath = path.join(tempDirectory(), suffix);
  const service = new LibraryService({
    appVersion: '0.1.0-test',
    now: () => now,
    createLibraryId: () => libraryId,
  });
  try {
    service.create({ rootPath, name: suffix });
  } finally {
    service.closeCurrent();
  }
  expect(existsSync(path.join(rootPath, 'backups'))).toBe(true);
  return rootPath;
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-migration-backup-'));
  tempDirs.push(directory);
  return directory;
}
