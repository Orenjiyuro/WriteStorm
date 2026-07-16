import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations, type Migration } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';
import {
  WRITESTORM_SCHEMA_EPOCH,
  WRITESTORM_SQLITE_APPLICATION_ID,
} from '../../../src/main/db/schema-identity';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { ANALYSIS_MODULE_DEFINITIONS } from '../../../src/shared/domain';
import {
  assertSchemaSemanticWitnessRegistry,
  migrationSemanticWitnesses,
} from '../../../src/main/db/schema-semantic-witness';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

describe('empty-database migration replay contract', () => {
  it('replays the complete canonical registry without business-row fixtures', () => {
    const database = openSqliteDatabase(emptyDatabasePath());
    try {
      expect(userObjectNames(database)).toEqual([]);

      replayWithMigrationIdentity(database, APP_MIGRATIONS);

      expect(getCurrentSchemaVersion(database)).toBe(APP_MIGRATIONS.at(-1)?.id ?? 0);
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
      expect(database.pragma('application_id', { simple: true })).toBe(
        WRITESTORM_SQLITE_APPLICATION_ID,
      );
      expect(columnDefault(database, 'library', 'schema_epoch')).toBe(
        String(WRITESTORM_SCHEMA_EPOCH),
      );
      const rowCounts = businessRowCounts(database);
      expect(rowCounts).toEqual(
        rowCounts.map(({ table }) => ({ table, count: 0 })),
      );
      expect(database.prepare('SELECT COUNT(*) FROM analysis_modules').pluck().get())
        .toBe(ANALYSIS_MODULE_DEFINITIONS.length);
    } finally {
      database.close();
    }
  });

  it('reports the exact migration id and name when empty replay fails', () => {
    const database = openSqliteDatabase(emptyDatabasePath());
    const failingRegistry = [
      {
        id: 1,
        name: 'empty_replay_setup',
        up(db) {
          db.exec('CREATE TABLE empty_replay_proof (id INTEGER PRIMARY KEY)');
        },
      },
      {
        id: 2,
        name: 'empty_replay_failure',
        up() {
          throw new Error('synthetic failure');
        },
      },
    ] satisfies readonly Migration[];

    try {
      expect(() => replayWithMigrationIdentity(database, failingRegistry)).toThrow(
        /migration 2 \(empty_replay_failure\) failed/i,
      );
      expect(getCurrentSchemaVersion(database)).toBe(0);
    } finally {
      database.close();
    }
  });

  it('requires each canonical migration to own uniquely identified semantic witnesses', () => {
    expect(() => assertSchemaSemanticWitnessRegistry(APP_MIGRATIONS)).not.toThrow();
    for (const migration of APP_MIGRATIONS) {
      const semanticWitnesses = migration.semanticWitnesses ?? [];
      const semanticBoundaries = migration.semanticBoundaries ?? [];
      expect(semanticWitnesses.length, `migration ${migration.id} witness count`).toBeGreaterThan(0);
      expect(semanticWitnesses.every(({ migrationId }) => migrationId === migration.id)).toBe(true);
      expect(semanticBoundaries.length, `migration ${migration.id} boundary count`).toBeGreaterThan(0);
      expect(semanticBoundaries.every(({ migrationId }) => migrationId === migration.id)).toBe(true);
    }
    const [foundationBoundaries = [], structureBoundaries = [], moduleBoundaries = [],
      instanceBoundaries = [], assetBoundaries = []]
      = APP_MIGRATIONS.map((migration) => migration.semanticBoundaries ?? []);
    expect(foundationBoundaries).toHaveLength(12);
    expect(foundationBoundaries.every(({ kind }) => kind === 'check')).toBe(true);
    expect(structureBoundaries.filter(({ kind }) => kind === 'check')).toHaveLength(32);
    expect(structureBoundaries.filter(({ kind }) => kind === 'trigger')).toHaveLength(10);
    expect(structureBoundaries.filter(({ kind }) => kind === 'partial-index')).toHaveLength(1);
    expect(moduleBoundaries.filter(({ kind }) => kind === 'check')).toHaveLength(6);
    expect(moduleBoundaries.filter(({ kind }) => kind === 'trigger')).toHaveLength(0);
    expect(instanceBoundaries.filter(({ kind }) => kind === 'check')).toHaveLength(4);
    expect(instanceBoundaries.filter(({ kind }) => kind === 'trigger')).toHaveLength(5);
    expect(instanceBoundaries.filter(({ kind }) => kind === 'partial-index')).toHaveLength(4);
    expect(assetBoundaries.filter(({ kind }) => kind === 'check')).toHaveLength(1);
    const expanded = migrationSemanticWitnesses(APP_MIGRATIONS);
    for (const boundary of APP_MIGRATIONS.flatMap((migration) => migration.semanticBoundaries ?? [])) {
      expect(expanded.some(({ id }) => id === `${boundary.id}.accept`)).toBe(true);
      expect(expanded.some(({ id }) => id === `${boundary.id}.reject`)).toBe(true);
    }
    const validatorSource = readFileSync('src/main/db/runtime-schema-validator.ts', 'utf8');
    expect(validatorSource).not.toContain('normalizeSchemaSql');
    expect(validatorSource).not.toMatch(/expected\s*===\s*actual/);
  });

  it('records the replay contract and completed SQLite 3.53.2 compatibility gate', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    for (const document of [context, decisions]) {
      const normalized = document.toLowerCase();
      expect(normalized).toContain('empty-database migration replay');
      expect(normalized).toContain('schema compatibility gate');
      expect(normalized).toContain('task 19');
      expect(normalized).toContain('sqlite 3.53.2');
      expect(normalized).toContain('first and minimum supported');
      expect(normalized).not.toContain('cross-sqlite compatibility is not yet verified');
    }
  });
});

function replayWithMigrationIdentity(
  database: SqliteDatabase,
  migrations: readonly Migration[],
): void {
  runMigrations(database, migrations.map((migration) => ({
    ...migration,
    up(db) {
      try {
        migration.up(db);
      } catch (error) {
        throw new Error(
          `Migration ${migration.id} (${migration.name}) failed during empty-database replay.`,
          { cause: error },
        );
      }
    },
  })));
}

function emptyDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-empty-migration-'));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'empty.sqlite');
}

function userObjectNames(database: SqliteDatabase): string[] {
  return database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).pluck().all() as string[];
}

function businessRowCounts(database: SqliteDatabase): Array<{ table: string; count: number }> {
  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT IN ('schema_migrations', 'analysis_modules')
    ORDER BY name
  `).pluck().all() as string[];
  return tables.map((table) => ({
    table,
    count: database.prepare(`SELECT COUNT(*) FROM "${table.replaceAll('"', '""')}"`).pluck().get() as number,
  }));
}

function columnDefault(
  database: SqliteDatabase,
  table: string,
  column: string,
): string | null {
  const row = (database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
    name: string;
    dflt_value: string | null;
  }>).find(({ name }) => name === column);
  return row?.dflt_value ?? null;
}
