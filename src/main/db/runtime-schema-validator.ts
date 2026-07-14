import type { SqliteDatabase } from './sqlite';
import { openSqliteDatabase } from './sqlite';
import { runMigrations, type Migration } from './migration-runner';
import {
  assertSchemaSemanticWitnessRegistry,
  executeSchemaSemanticWitness,
} from './schema-semantic-witness';

export type RuntimeSchemaValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly expected: string; readonly actual: string };

export function validateRuntimeSchema(
  database: SqliteDatabase,
  migrations: readonly Migration[],
): RuntimeSchemaValidationResult {
  const canonical = openSqliteDatabase(':memory:');
  try {
    assertSchemaSemanticWitnessRegistry(migrations);
    runMigrations(canonical, migrations);
    const canonicalExpressionIndex = findExpressionIndex(canonical);
    const actualExpressionIndex = findExpressionIndex(database);
    if (canonicalExpressionIndex !== null || actualExpressionIndex !== null) {
      return {
        ok: false,
        expected: 'no expression indexes in the production schema',
        actual: actualExpressionIndex ?? `canonical registry contains ${canonicalExpressionIndex}`,
      };
    }
    const expectedDescriptor = describeRuntimeSchema(canonical);
    const actualDescriptor = describeRuntimeSchema(database);
    const expected = JSON.stringify(expectedDescriptor);
    const actual = JSON.stringify(actualDescriptor);
    if (expected !== actual) {
      return { ok: false, expected, actual };
    }

    const witnessFailure = validateSemanticWitnesses(database, migrations);
    return witnessFailure === null
      ? { ok: true }
      : { ok: false, expected: 'all migration-owned semantic witnesses pass', actual: witnessFailure };
  } finally {
    canonical.close();
  }
}

type SchemaObjectRow = {
  readonly type: 'table' | 'index' | 'view' | 'trigger';
  readonly name: string;
  readonly tableName: string;
  readonly sql: string | null;
};

function describeRuntimeSchema(database: SqliteDatabase) {
  const objects = schemaObjects(database);
  const admittedObjects = objects.map(({ type, name, tableName }) => ({ type, name, tableName }));
  const tables = objects
    .filter((object) => object.type === 'table')
    .map((object) => ({
      name: object.name,
      columns: database.prepare(`PRAGMA table_xinfo(${quoteIdentifier(object.name)})`).all(),
      foreignKeys: database.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(object.name)})`).all(),
      indexes: tableIndexes(database, object.name),
    }));
  return { admittedObjects, tables };
}

function tableIndexes(database: SqliteDatabase, tableName: string) {
  type IndexListRow = { readonly name: string; readonly unique: number; readonly origin: string; readonly partial: number };
  return (database.prepare(`PRAGMA index_list(${quoteIdentifier(tableName)})`).all() as IndexListRow[])
    .map((index) => ({
      name: index.name,
      unique: index.unique,
      origin: index.origin,
      partial: index.partial,
      columns: database.prepare(`PRAGMA index_xinfo(${quoteIdentifier(index.name)})`).all(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function findExpressionIndex(database: SqliteDatabase): string | null {
  const indexNames = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'index' AND sql IS NOT NULL
    ORDER BY name
  `).pluck().all() as string[];
  for (const indexName of indexNames) {
    const columns = database.prepare(`PRAGMA index_xinfo(${quoteIdentifier(indexName)})`).all() as Array<{ cid: number }>;
    if (columns.some(({ cid }) => cid === -2)) return indexName;
  }
  return null;
}

function validateSemanticWitnesses(
  source: SqliteDatabase,
  migrations: readonly Migration[],
): string | null {
  const witnesses = migrations.flatMap((migration) => migration.semanticWitnesses ?? []);
  if (witnesses.length === 0) {
    return null;
  }
  const isolated = openSqliteDatabase(':memory:');
  try {
    reproduceSchema(source, isolated);
    for (const witness of witnesses) {
      const failure = executeSchemaSemanticWitness(isolated, witness);
      if (failure !== null) {
        return failure;
      }
    }
    return null;
  } catch {
    return 'actual schema could not be reproduced for isolated semantic witnesses';
  } finally {
    isolated.close();
  }
}

function reproduceSchema(source: SqliteDatabase, target: SqliteDatabase): void {
  const objects = schemaObjects(source);
  for (const type of ['table', 'index', 'view', 'trigger'] as const) {
    for (const object of objects) {
      if (object.type === type && object.sql !== null) {
        target.exec(object.sql);
      }
    }
  }
}

function schemaObjects(database: SqliteDatabase): SchemaObjectRow[] {
  return database.prepare(`
    SELECT type, name, tbl_name AS tableName, sql
    FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all() as SchemaObjectRow[];
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
