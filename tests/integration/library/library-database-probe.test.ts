import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { WRITESTORM_SQLITE_APPLICATION_ID } from '../../../src/main/db/schema-identity';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import {
  probeLibraryDatabase,
  type LibraryDatabaseProbeResult,
} from '../../../src/main/library/library-database-probe';
import { LibraryService } from '../../../src/main/library/library-service';
import { createDomainError } from '../../../src/shared/errors';
import type { LibraryId } from '../../../src/shared/domain';

const tempDirs: string[] = [];
const now = '2026-07-12T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('Library database read-only probe', () => {
  it('accepts the current baseline without changing bytes or directory contents', () => {
    const databasePath = validBaselineDatabase();
    const result = probeWithoutMutation(databasePath);

    expect(result).toEqual({
      ok: true,
      identity: {
        id: 'library-probe',
        name: 'Probe Library',
        appVersion: '0.1.0-test',
        schemaEpoch: 2,
      },
    });
  });

  it('rejects epoch 1 without mutation', () => {
    const databasePath = customProbeDatabase({ schemaEpoch: 1 });
    expect(probeWithoutMutation(databasePath)).toMatchObject({
      ok: false,
      error: { code: 'DEV_SCHEMA_RESET_REQUIRED' },
    });
  });

  it('rejects a foreign application id without mutation', () => {
    const databasePath = customProbeDatabase({ applicationId: 1234 });
    expect(probeWithoutMutation(databasePath)).toMatchObject({
      ok: false,
      error: { code: 'LIBRARY_DATABASE_NOT_WRITESTORM' },
    });
  });

  it.each([
    ['unknown migration', [{ id: 2, name: 'future' }]],
    ['renamed migration', [{ id: 1, name: 'renamed_baseline' }]],
    ['non-contiguous migration', [{ id: 2, name: 'v1_runtime_baseline' }]],
  ])('rejects %s history without mutation', (_label, migrations) => {
    const databasePath = customProbeDatabase({ migrations });
    expect(probeWithoutMutation(databasePath)).toMatchObject({
      ok: false,
      error: { code: 'LIBRARY_SCHEMA_INCOMPATIBLE' },
    });
  });

  it('does not create a missing database', () => {
    const directory = tempDirectory();
    const databasePath = path.join(directory, 'missing.sqlite');
    const before = readdirSync(directory);

    expect(probeLibraryDatabase(databasePath, APP_MIGRATIONS)).toMatchObject({
      ok: false,
      error: { code: 'LIBRARY_SCHEMA_INCOMPATIBLE' },
    });
    expect(existsSync(databasePath)).toBe(false);
    expect(readdirSync(directory)).toEqual(before);
  });

  it('returns a stable error for corrupt input without leaking SQLite details', () => {
    const directory = tempDirectory();
    const databasePath = path.join(directory, 'corrupt.sqlite');
    writeFileSync(databasePath, 'not a sqlite database');
    const result = probeWithoutMutation(databasePath);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'LIBRARY_SCHEMA_INCOMPATIBLE',
        message: 'Library database could not be validated.',
        recoverable: false,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/database disk image|SQLITE_/i);
  });

  it('probes before writable open/migration, preserves the current session, and bypasses create', () => {
    const calls: string[] = [];
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => 'current-library' as LibraryId,
      probeDatabase: () => {
        calls.push('probe');
        return rejectedEpoch();
      },
      openDatabase: (databasePath) => {
        calls.push('open');
        return openSqliteDatabase(databasePath);
      },
      migrateDatabase: (database, migrations) => {
        calls.push('migrate');
        runMigrations(database, migrations);
      },
    });
    const currentRoot = path.join(tempDirectory(), 'current');
    const rejectedRoot = path.join(tempDirectory(), 'rejected');
    const other = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => 'rejected-library' as LibraryId,
    });

    try {
      const current = service.create({ rootPath: currentRoot, name: 'Current' });
      expect(calls).toEqual(['open', 'migrate']);
      calls.length = 0;
      other.create({ rootPath: rejectedRoot, name: 'Rejected' });
      other.closeCurrent();

      expect(() => service.open({ rootPath: rejectedRoot })).toThrow(/obsolete schema epoch/i);
      expect(calls).toEqual(['probe']);
      expect(service.getCurrent()).toEqual(current);
    } finally {
      service.closeCurrent();
      other.closeCurrent();
    }
  });
});

function probeWithoutMutation(databasePath: string): LibraryDatabaseProbeResult {
  const directory = path.dirname(databasePath);
  const beforeHash = fileHash(databasePath);
  const beforeEntries = readdirSync(directory).sort();
  const result = probeLibraryDatabase(databasePath, APP_MIGRATIONS);

  expect(fileHash(databasePath)).toBe(beforeHash);
  expect(readdirSync(directory).sort()).toEqual(beforeEntries);
  expect(readdirSync(directory)).not.toEqual(expect.arrayContaining([
    expect.stringMatching(/-(wal|shm|journal)$/),
  ]));

  return result;
}

function validBaselineDatabase(): string {
  const databasePath = path.join(tempDirectory(), 'valid.sqlite');
  const database = openSqliteDatabase(databasePath);
  try {
    runMigrations(database, APP_MIGRATIONS);
    database.prepare(`
      INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
      VALUES (1, 'library-probe', 'Probe Library', '0.1.0-test', ?, ?)
    `).run(now, now);
  } finally {
    database.close();
  }
  return databasePath;
}

function customProbeDatabase(options: {
  applicationId?: number;
  schemaEpoch?: number;
  migrations?: Array<{ id: number; name: string }>;
}): string {
  const databasePath = path.join(tempDirectory(), 'fixture.sqlite');
  const database = new Database(databasePath);
  try {
    database.pragma(`application_id = ${options.applicationId ?? WRITESTORM_SQLITE_APPLICATION_ID}`);
    database.exec(`
      CREATE TABLE library (
        singleton_key INTEGER PRIMARY KEY,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        app_version TEXT NOT NULL,
        schema_epoch INTEGER NOT NULL
      );
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    database.prepare(`
      INSERT INTO library (singleton_key, id, name, app_version, schema_epoch)
      VALUES (1, 'library-probe', 'Probe Library', '0.1.0-test', ?)
    `).run(options.schemaEpoch ?? 2);
    const insertMigration = database.prepare(
      'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
    );
    for (const migration of options.migrations ?? [{ id: 1, name: 'v1_runtime_baseline' }]) {
      insertMigration.run(migration.id, migration.name, now);
    }
  } finally {
    database.close();
  }
  return databasePath;
}

function rejectedEpoch(): LibraryDatabaseProbeResult {
  return {
    ok: false,
    error: createDomainError({
      code: 'DEV_SCHEMA_RESET_REQUIRED',
      message: 'This development library uses an obsolete schema epoch and must be recreated.',
      recoverable: false,
    }),
  };
}

function fileHash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-library-probe-'));
  tempDirs.push(directory);
  return directory;
}
