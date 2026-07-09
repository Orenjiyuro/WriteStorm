import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getCurrentSchemaVersion,
  runMigrations,
  type Migration,
} from './migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from './sqlite';

export const WRITESTORM_NATIVE_SQLITE_PROBE_ENV = 'WRITESTORM_NATIVE_SQLITE_PROBE';
export const WRITESTORM_NATIVE_SQLITE_PROBE_RESULT_ENV = 'WRITESTORM_NATIVE_SQLITE_PROBE_RESULT';

export async function runOptionalNativeSqliteProbe(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env[WRITESTORM_NATIVE_SQLITE_PROBE_ENV] !== '1') {
    return;
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-native-sqlite-probe-'));
  const databasePath = path.join(tempDir, 'probe.sqlite');
  let database: SqliteDatabase | undefined;

  try {
    await import('better-sqlite3');

    database = openSqliteDatabase(databasePath);
    runMigrations(database, NATIVE_SQLITE_PROBE_MIGRATIONS);
    const sqliteVersion = database.prepare('SELECT sqlite_version()').pluck().get();
    const storedValue = database.prepare('SELECT value FROM native_sqlite_probe').pluck().get();
    const migrationSchemaVersion = getCurrentSchemaVersion(database);

    if (storedValue !== 'ok') {
      throw new Error('Native SQLite probe did not read back the inserted row.');
    }

    database.close();
    database = undefined;

    database = openSqliteDatabase(databasePath);
    const reopenedSchemaVersion = getCurrentSchemaVersion(database);

    writeNativeSqliteProbeResult(
      env,
      String(sqliteVersion),
      migrationSchemaVersion,
      reopenedSchemaVersion,
    );
    console.error(`WRITESTORM_NATIVE_SQLITE_PROBE ok sqlite=${String(sqliteVersion)}`);
  } finally {
    database?.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const NATIVE_SQLITE_PROBE_MIGRATIONS = [
  {
    id: 1,
    name: 'native_sqlite_probe',
    up(database) {
      database.exec('CREATE TABLE native_sqlite_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      database.prepare('INSERT INTO native_sqlite_probe (value) VALUES (?)').run('ok');
    },
  },
] as const satisfies readonly Migration[];

function writeNativeSqliteProbeResult(
  env: NodeJS.ProcessEnv,
  sqliteVersion: string,
  migrationSchemaVersion: number,
  reopenedSchemaVersion: number,
): void {
  const resultPath = env[WRITESTORM_NATIVE_SQLITE_PROBE_RESULT_ENV];

  if (!resultPath) {
    return;
  }

  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(
    resultPath,
    JSON.stringify({
      ok: true,
      sqliteVersion,
      migrationSchemaVersion,
      reopenedSchemaVersion,
    }),
    'utf8',
  );
}
