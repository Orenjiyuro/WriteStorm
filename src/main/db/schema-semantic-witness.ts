import type { SqliteDatabase } from './sqlite';

export const SQLITE_CONSTRAINT_CODES = [
  'SQLITE_CONSTRAINT_CHECK',
  'SQLITE_CONSTRAINT_FOREIGNKEY',
  'SQLITE_CONSTRAINT_NOTNULL',
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  'SQLITE_CONSTRAINT_TRIGGER',
  'SQLITE_CONSTRAINT_UNIQUE',
] as const;

export type SqliteConstraintCode = (typeof SQLITE_CONSTRAINT_CODES)[number];

export type SchemaSemanticWitness = {
  readonly id: string;
  readonly migrationId: number;
  readonly setupSql?: string;
  readonly sql: string;
  readonly expected:
    | { readonly outcome: 'accept' }
    | { readonly outcome: 'constraint'; readonly code: SqliteConstraintCode };
};

export type WitnessOwner = {
  readonly id: number;
  readonly name: string;
  readonly semanticWitnesses?: readonly SchemaSemanticWitness[];
};

export function assertSchemaSemanticWitnessRegistry(migrations: readonly WitnessOwner[]): void {
  const ids = new Set<string>();
  for (const migration of migrations) {
    for (const witness of migration.semanticWitnesses ?? []) {
      if (witness.id.trim().length === 0) {
        throw new Error(`Migration ${migration.id} (${migration.name}) has an empty semantic witness id.`);
      }
      if (ids.has(witness.id)) {
        throw new Error(`Duplicate schema semantic witness id: ${witness.id}`);
      }
      if (witness.migrationId !== migration.id) {
        throw new Error(
          `Schema semantic witness ${witness.id} belongs to migration ${witness.migrationId}, ` +
          `but is registered by migration ${migration.id} (${migration.name}).`,
        );
      }
      ids.add(witness.id);
    }
  }
}

export function executeSchemaSemanticWitness(
  database: SqliteDatabase,
  witness: SchemaSemanticWitness,
): string | null {
  const savepoint = `schema_witness_${witness.id.replaceAll(/[^a-zA-Z0-9_]/g, '_')}`;
  database.exec(`SAVEPOINT ${savepoint}`);
  try {
    if (witness.setupSql) database.exec(witness.setupSql);
    try {
      database.exec(witness.sql);
      return witness.expected.outcome === 'accept'
        ? null
        : `semantic witness ${witness.id} expected ${witness.expected.code}, but SQL succeeded`;
    } catch (error) {
      if (witness.expected.outcome === 'accept') {
        return `semantic witness ${witness.id} expected success, but received ${sqliteErrorCode(error)}`;
      }
      const actualCode = sqliteErrorCode(error);
      return actualCode === witness.expected.code
        ? null
        : `semantic witness ${witness.id} expected ${witness.expected.code}, but received ${actualCode}`;
    }
  } finally {
    database.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
  }
}

function sqliteErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'NON_SQLITE_ERROR';
}
