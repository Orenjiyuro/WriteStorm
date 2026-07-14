import { describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { runMigrations, type Migration } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';

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
        name: 'validator_check_requires_positive_value',
        sql: 'INSERT INTO validator_check (value) VALUES (0)',
        outcome: 'reject',
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
      expect(validateRuntimeSchema(database, APP_MIGRATIONS).ok).toBe(false);
    });
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
