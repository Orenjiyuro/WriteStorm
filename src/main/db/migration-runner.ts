import type { SqliteDatabase } from './sqlite';
import type { SchemaSemanticBoundary, SchemaSemanticWitness } from './schema-semantic-witness';

export type Migration = {
  readonly id: number;
  readonly name: string;
  readonly up: (database: SqliteDatabase) => void;
  readonly semanticWitnesses?: readonly SchemaSemanticWitness[];
  readonly semanticBoundaries?: readonly SchemaSemanticBoundary[];
};

export function runMigrations(database: SqliteDatabase, migrations: readonly Migration[]): void {
  assertMigrationRegistry(migrations);
  ensureSchemaMigrationsTable(database);
  assertAppliedMigrationHistory(database, migrations);

  const appliedIds = getAppliedMigrationIds(database);
  const pendingMigrations = migrations.filter((migration) => !appliedIds.has(migration.id));

  if (pendingMigrations.length === 0) {
    return;
  }

  const insertAppliedMigration = database.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
  );
  const applyPendingMigrations = database.transaction(() => {
    for (const migration of pendingMigrations) {
      migration.up(database);
      insertAppliedMigration.run(migration.id, migration.name, new Date().toISOString());
    }
  });

  applyPendingMigrations();
}

export function getCurrentSchemaVersion(database: SqliteDatabase): number {
  ensureSchemaMigrationsTable(database);

  const version = database.prepare('SELECT MAX(id) FROM schema_migrations').pluck().get();

  return typeof version === 'number' ? version : 0;
}

export function assertMigrationRegistry(migrations: readonly Migration[]): void {
  const seenIds = new Set<number>();
  let previousId = 0;

  for (const migration of migrations) {
    if (!Number.isInteger(migration.id) || migration.id <= 0) {
      throw new Error(`Migration id must be a positive integer: ${migration.id}`);
    }

    if (seenIds.has(migration.id)) {
      throw new Error(`Migration registry contains duplicate id: ${migration.id}`);
    }

    if (migration.id <= previousId) {
      throw new Error(`Migration ids must be in ascending order: ${migration.id} after ${previousId}`);
    }

    if (migration.name.trim().length === 0) {
      throw new Error(`Migration ${migration.id} must have a non-empty name.`);
    }

    seenIds.add(migration.id);
    previousId = migration.id;
  }
}

function ensureSchemaMigrationsTable(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function getAppliedMigrationIds(database: SqliteDatabase): Set<number> {
  return new Set(
    database
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .pluck()
      .all()
      .filter((id): id is number => typeof id === 'number'),
  );
}

function assertAppliedMigrationHistory(
  database: SqliteDatabase,
  migrations: readonly Migration[],
): void {
  const migrationsById = new Map(migrations.map((migration) => [migration.id, migration]));
  const appliedMigrations = database
    .prepare('SELECT id, name FROM schema_migrations ORDER BY id')
    .all() as Array<{ id: unknown; name: unknown }>;

  for (let appliedMigrationIndex = 0; appliedMigrationIndex < appliedMigrations.length; appliedMigrationIndex += 1) {
    const appliedMigration = appliedMigrations[appliedMigrationIndex];

    if (typeof appliedMigration.id !== 'number' || typeof appliedMigration.name !== 'string') {
      throw new Error('Applied migration history contains invalid rows.');
    }

    const registryMigration = migrationsById.get(appliedMigration.id);

    if (!registryMigration) {
      throw new Error(`Unknown applied migration id: ${appliedMigration.id}`);
    }

    const expectedRegistryMigration = migrations[appliedMigrationIndex];

    if (!expectedRegistryMigration || expectedRegistryMigration.id !== appliedMigration.id) {
      throw new Error(
        'Applied migration history must be a contiguous registry prefix: ' +
          `expected id ${expectedRegistryMigration?.id ?? 'none'}, found ${appliedMigration.id}.`,
      );
    }

    if (registryMigration.name !== appliedMigration.name) {
      throw new Error(
        `Migration history mismatch for id ${appliedMigration.id}: ` +
          `database has ${appliedMigration.name}, registry has ${registryMigration.name}.`,
      );
    }
  }
}
