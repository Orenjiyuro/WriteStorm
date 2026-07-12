import type { SqliteDatabase } from './sqlite';
import { openSqliteDatabase } from './sqlite';
import { runMigrations, type Migration } from './migration-runner';

export type RuntimeSchemaValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly expected: string; readonly actual: string };

export function validateRuntimeSchema(
  database: SqliteDatabase,
  migrations: readonly Migration[],
): RuntimeSchemaValidationResult {
  const canonical = openSqliteDatabase(':memory:');
  try {
    runMigrations(canonical, migrations);
    const expected = JSON.stringify(describeRuntimeSchema(canonical));
    const actual = JSON.stringify(describeRuntimeSchema(database));
    return expected === actual ? { ok: true } : { ok: false, expected, actual };
  } finally {
    canonical.close();
  }
}

type SchemaObjectRow = {
  readonly type: string;
  readonly name: string;
  readonly tableName: string;
  readonly sql: string | null;
};

function describeRuntimeSchema(database: SqliteDatabase) {
  const objects = database.prepare(`
    SELECT type, name, tbl_name AS tableName, sql
    FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all() as SchemaObjectRow[];

  return objects.map((object) => ({
    ...object,
    sql: normalizeSchemaSql(object.sql),
    columns: object.type === 'table' ? tableColumns(database, object.name) : undefined,
    foreignKeys: object.type === 'table' ? tableForeignKeys(database, object.name) : undefined,
  }));
}

function tableColumns(database: SqliteDatabase, tableName: string) {
  return database.prepare(`PRAGMA table_xinfo(${quoteIdentifier(tableName)})`).all();
}

function tableForeignKeys(database: SqliteDatabase, tableName: string) {
  return database.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`).all();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function normalizeSchemaSql(sql: string | null): string | null {
  return sql?.trim() ?? null;
}
