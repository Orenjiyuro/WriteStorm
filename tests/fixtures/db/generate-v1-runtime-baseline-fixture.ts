import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { WRITESTORM_SCHEMA_EPOCH, WRITESTORM_SQLITE_APPLICATION_ID } from '../../../src/main/db/schema-identity';

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(directory, 'v1-runtime-baseline-sqlite-3.53.2.sqlite');
const metadataPath = `${fixturePath}.json`;
mkdirSync(directory, { recursive: true });
rmSync(fixturePath, { force: true });
const database = new Database(fixturePath);
database.pragma('foreign_keys = ON');
try {
  const sqliteVersion = database.prepare('SELECT sqlite_version()').pluck().get() as string;
  if (sqliteVersion !== '3.53.2') throw new Error(`Fixture requires SQLite 3.53.2, found ${sqliteVersion}`);
  runMigrations(database, APP_MIGRATIONS);
} finally {
  database.close();
}
const bytes = readFileSync(fixturePath);
writeFileSync(metadataPath, `${JSON.stringify({
  sqliteVersion: '3.53.2',
  sqliteLibraryVersionNumber: 3_053_002,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  applicationId: WRITESTORM_SQLITE_APPLICATION_ID,
  schemaEpoch: WRITESTORM_SCHEMA_EPOCH,
  migrations: APP_MIGRATIONS.map(({ id, name }) => ({ id, name })),
}, null, 2)}\n`);
