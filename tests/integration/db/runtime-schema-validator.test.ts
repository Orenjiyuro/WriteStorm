import { describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations, type Migration } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  assertSchemaSemanticWitnessRegistry,
  executeSchemaSemanticWitness,
} from '../../../src/main/db/schema-semantic-witness';

describe('canonical runtime schema validator', () => {
  it('accepts a fresh database built from the canonical migrations', () => {
    withCanonicalDatabase((database) => {
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
    });
  });

  it('rejects removed columns and explicit indexes', () => {
    withCanonicalDatabase((database) => {
      database.exec('ALTER TABLE jobs DROP COLUMN error_code');
      expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
    });
    withCanonicalDatabase((database) => {
      database.exec('DROP INDEX idx_jobs_book_id_state');
      expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
    });
  });

  it('rejects changed CHECK constraints and unadmitted production objects', () => {
    const checkRegistry = [...APP_MIGRATIONS, {
      id: 3,
      name: 'validator_check_fixture',
      up(database) {
        database.exec('CREATE TABLE validator_check (value INTEGER CHECK (value > 0))');
      },
      semanticWitnesses: [{
        id: 'validator_check_requires_positive_value',
        migrationId: 3,
        sql: 'INSERT INTO validator_check (value) VALUES (0)',
        expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
      }],
    }] satisfies readonly Migration[];
    withCanonicalDatabase((database) => {
      database.exec(`
        ALTER TABLE validator_check RENAME TO validator_check_old;
        CREATE TABLE validator_check (value INTEGER CHECK (value >= 0));
        DROP TABLE validator_check_old;
      `);
      expect(validateRuntimeSchema(database, checkRegistry).ok).toBe(false);
    }, checkRegistry);
    withCanonicalDatabase((database) => {
      database.exec('CREATE TABLE unadmitted_product_fact (id TEXT PRIMARY KEY)');
      expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
    });
  });

  it('accepts equivalent DDL formatting because sqlite_schema.sql text is not authoritative', () => {
    const formattingRegistry = [...APP_MIGRATIONS, {
      id: 3,
      name: 'validator_formatting_fixture',
      up(database) {
        database.exec('CREATE TABLE validator_formatting (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      },
      semanticWitnesses: [],
    }] satisfies readonly Migration[];
    withCanonicalDatabase((database) => {
      database.exec(`
        ALTER TABLE validator_formatting RENAME TO validator_formatting_old;
        CREATE TABLE validator_formatting(
          id integer primary key,
          value text not null
        );
        DROP TABLE validator_formatting_old;
      `);
      expect(validateRuntimeSchema(database, formattingRegistry)).toEqual({ ok: true });
    }, formattingRegistry);
  });

  it('rejects partial or expression indexes that are not represented safely', () => {
    withCanonicalDatabase((database) => {
      database.exec('CREATE INDEX unexpected_partial ON jobs(state) WHERE state = \'queued\'');
      expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
    });
    withCanonicalDatabase((database) => {
      database.exec('CREATE INDEX unexpected_expression ON jobs(lower(state))');
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toMatchObject({
        ok: false,
        expected: 'no expression indexes in the production schema',
        actual: 'unexpected_expression',
      });
    });
  });

  it('rejects NOT NULL, default, and primary-key mutations structurally', () => {
    const registry = fixtureRegistry(`CREATE TABLE shape_fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL DEFAULT 'x')`);
    for (const mutatedSql of [
      `CREATE TABLE shape_fixture (id INTEGER PRIMARY KEY, value TEXT DEFAULT 'x')`,
      `CREATE TABLE shape_fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL DEFAULT 'y')`,
      `CREATE TABLE shape_fixture (id INTEGER, value TEXT NOT NULL DEFAULT 'x')`,
    ]) {
      withCanonicalDatabase((database) => {
        database.exec(`DROP TABLE shape_fixture; ${mutatedSql}`);
        expect(validateRuntimeSchema(database, registry).ok).toBe(false);
      }, registry);
    }
  });

  it('rejects foreign-key target, action, and column-order mutations', () => {
    const registry = fixtureRegistry(`
      CREATE TABLE parent_fixture (a TEXT, b TEXT, UNIQUE (a, b));
      CREATE TABLE child_fixture (x TEXT, y TEXT, FOREIGN KEY (x, y) REFERENCES parent_fixture(a, b) ON DELETE CASCADE)
    `);
    for (const foreignKey of [
      `FOREIGN KEY (x, y) REFERENCES parent_fixture(b, a) ON DELETE CASCADE`,
      `FOREIGN KEY (x, y) REFERENCES parent_fixture(a, b) ON DELETE SET NULL`,
      `FOREIGN KEY (y, x) REFERENCES parent_fixture(a, b) ON DELETE CASCADE`,
    ]) {
      withCanonicalDatabase((database) => {
        database.exec(`DROP TABLE child_fixture; CREATE TABLE child_fixture (x TEXT, y TEXT, ${foreignKey})`);
        expect(validateRuntimeSchema(database, registry).ok).toBe(false);
      }, registry);
    }
  });

  it('rejects UNIQUE order plus view and trigger admission mutations', () => {
    const registry = fixtureRegistry(`
      CREATE TABLE admission_fixture (a TEXT, b TEXT, UNIQUE (a, b));
      CREATE VIEW admitted_view AS SELECT a FROM admission_fixture;
      CREATE TRIGGER admitted_trigger AFTER INSERT ON admission_fixture BEGIN SELECT 1; END
    `);
    withCanonicalDatabase((database) => {
      database.exec(`DROP VIEW admitted_view`);
      expect(validateRuntimeSchema(database, registry).ok).toBe(false);
    }, registry);
    withCanonicalDatabase((database) => {
      database.exec(`DROP TRIGGER admitted_trigger`);
      expect(validateRuntimeSchema(database, registry).ok).toBe(false);
    }, registry);
    const uniqueRegistry = fixtureRegistry(`CREATE TABLE unique_fixture (a TEXT, b TEXT, UNIQUE (a, b))`);
    withCanonicalDatabase((database) => {
      database.exec(`ALTER TABLE unique_fixture RENAME TO old_unique; CREATE TABLE unique_fixture (a TEXT, b TEXT, UNIQUE (b, a)); DROP TABLE old_unique`);
      expect(validateRuntimeSchema(database, uniqueRegistry).ok).toBe(false);
    }, uniqueRegistry);
  });

  it('rejects partial-index deletion, relaxation, and tightening', () => {
    for (const replacement of [
      '',
      `CREATE UNIQUE INDEX idx_structure_sets_current_stage ON structure_sets(book_id, stage) WHERE is_current IN (0, 1)`,
      `CREATE UNIQUE INDEX idx_structure_sets_current_stage ON structure_sets(book_id, stage) WHERE is_current = 1 AND stage = 'frozen'`,
    ]) {
      withCanonicalDatabase((database) => {
        database.exec(`DROP INDEX idx_structure_sets_current_stage; ${replacement}`);
        expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
      });
    }
  });

  it('rejects CHECK deletion, relaxation, and tightening through both witness directions', () => {
    const registry = [...APP_MIGRATIONS, {
      id: 3,
      name: 'check_boundary_mutation_fixture',
      up(database: SqliteDatabase) {
        database.exec('CREATE TABLE check_boundary_fixture (value INTEGER CHECK (value > 0))');
      },
      semanticWitnesses: [],
      semanticBoundaries: [{
        id: '003.check_boundary.value_positive', migrationId: 3, kind: 'check' as const,
        accept: { sql: 'INSERT INTO check_boundary_fixture VALUES (1)' },
        reject: {
          sql: 'INSERT INTO check_boundary_fixture VALUES (0)',
          code: 'SQLITE_CONSTRAINT_CHECK' as const,
        },
      }],
    }] satisfies readonly Migration[];
    for (const replacement of [
      'CREATE TABLE check_boundary_fixture (value INTEGER)',
      'CREATE TABLE check_boundary_fixture (value INTEGER CHECK (value >= 0))',
      'CREATE TABLE check_boundary_fixture (value INTEGER CHECK (value > 1))',
    ]) {
      withCanonicalDatabase((database) => {
        database.exec(`DROP TABLE check_boundary_fixture; ${replacement}`);
        expect(validateRuntimeSchema(database, registry).ok).toBe(false);
      }, registry);
    }
  });

  it('rejects trigger deletion, relaxation, and tightening through both witness directions', () => {
    const registry = [...APP_MIGRATIONS, {
      id: 3,
      name: 'trigger_boundary_mutation_fixture',
      up(database: SqliteDatabase) {
        database.exec(`
          CREATE TABLE trigger_boundary_fixture (value INTEGER);
          CREATE TRIGGER trigger_boundary_guard BEFORE INSERT ON trigger_boundary_fixture
          WHEN NEW.value <= 0 BEGIN SELECT RAISE(ABORT, 'positive required'); END;
        `);
      },
      semanticWitnesses: [],
      semanticBoundaries: [{
        id: '003.trigger_boundary.positive', migrationId: 3, kind: 'trigger' as const,
        accept: { sql: 'INSERT INTO trigger_boundary_fixture VALUES (1)' },
        reject: {
          sql: 'INSERT INTO trigger_boundary_fixture VALUES (0)',
          code: 'SQLITE_CONSTRAINT_TRIGGER' as const,
        },
      }],
    }] satisfies readonly Migration[];
    for (const replacementWhen of [null, 'NEW.value < 0', 'NEW.value <= 1']) {
      withCanonicalDatabase((database) => {
        database.exec('DROP TRIGGER trigger_boundary_guard');
        if (replacementWhen !== null) {
          database.exec(`CREATE TRIGGER trigger_boundary_guard BEFORE INSERT ON trigger_boundary_fixture WHEN ${replacementWhen} BEGIN SELECT RAISE(ABORT, 'positive required'); END`);
        }
        expect(validateRuntimeSchema(database, registry).ok).toBe(false);
      }, registry);
    }
  });

  it('requires unique witness ids and exact migration ownership', () => {
    const witness = {
      id: 'duplicate', migrationId: 1, sql: 'SELECT 1', expected: { outcome: 'accept' as const },
    };
    expect(() => assertSchemaSemanticWitnessRegistry([
      { id: 1, name: 'one', semanticWitnesses: [witness] },
      { id: 2, name: 'two', semanticWitnesses: [{ ...witness, migrationId: 2 }] },
    ])).toThrow('Duplicate schema semantic witness id');
    expect(() => assertSchemaSemanticWitnessRegistry([
      { id: 2, name: 'two', semanticWitnesses: [witness] },
    ])).toThrow('belongs to migration 1');
  });

  it('does not mistake syntax or the wrong constraint class for an expected rejection', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      database.exec('CREATE TABLE witness_error (value INTEGER NOT NULL CHECK (value > 0))');
      expect(executeSchemaSemanticWitness(database, {
        id: 'syntax', migrationId: 1, sql: 'INSER broken',
        expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
      })).toContain('SQLITE_ERROR');
      expect(executeSchemaSemanticWitness(database, {
        id: 'wrong-class', migrationId: 1, sql: 'INSERT INTO witness_error VALUES (NULL)',
        expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_CHECK' },
      })).toContain('SQLITE_CONSTRAINT_NOTNULL');
    } finally { database.close(); }
  });
});

function withCanonicalDatabase(
  assertions: (database: SqliteDatabase) => void,
  migrations: readonly Migration[] = APP_MIGRATIONS,
): void {
  const database = openSqliteDatabase(':memory:');
  try {
    runMigrations(database, migrations);
    assertions(database);
  } finally {
    database.close();
  }
}

function fixtureRegistry(sql: string): readonly Migration[] {
  return [...APP_MIGRATIONS, {
    id: 3,
    name: 'schema_mutation_fixture',
    up(database: SqliteDatabase) { database.exec(sql); },
    semanticWitnesses: [],
  }];
}
