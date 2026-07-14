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

export type SchemaSemanticBoundary = {
  readonly id: string;
  readonly migrationId: number;
  readonly kind: 'check' | 'trigger' | 'partial-index';
  readonly accept: { readonly setupSql?: string; readonly sql: string };
  readonly reject: {
    readonly setupSql?: string;
    readonly sql: string;
    readonly code: SqliteConstraintCode;
  };
};

export type WitnessOwner = {
  readonly id: number;
  readonly name: string;
  readonly semanticWitnesses?: readonly SchemaSemanticWitness[];
  readonly semanticBoundaries?: readonly SchemaSemanticBoundary[];
};

export function assertSchemaSemanticWitnessRegistry(migrations: readonly WitnessOwner[]): void {
  const ids = new Set<string>();
  const boundaryIds = new Set<string>();
  for (const migration of migrations) {
    for (const boundary of migration.semanticBoundaries ?? []) {
      if (boundaryIds.has(boundary.id)) throw new Error(`Duplicate schema semantic boundary id: ${boundary.id}`);
      if (boundary.migrationId !== migration.id) {
        throw new Error(`Schema semantic boundary ${boundary.id} belongs to migration ${boundary.migrationId}, but is registered by migration ${migration.id} (${migration.name}).`);
      }
      boundaryIds.add(boundary.id);
    }
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

export function migrationSemanticWitnesses(migrations: readonly WitnessOwner[]): SchemaSemanticWitness[] {
  return migrations.flatMap((migration) => [
    ...(migration.semanticWitnesses ?? []),
    ...(migration.semanticBoundaries ?? []).flatMap((boundary): SchemaSemanticWitness[] => [
      {
        id: `${boundary.id}.accept`, migrationId: boundary.migrationId,
        setupSql: boundary.accept.setupSql, sql: boundary.accept.sql,
        expected: { outcome: 'accept' },
      },
      {
        id: `${boundary.id}.reject`, migrationId: boundary.migrationId,
        setupSql: boundary.reject.setupSql, sql: boundary.reject.sql,
        expected: { outcome: 'constraint', code: boundary.reject.code },
      },
    ]),
  ]);
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
