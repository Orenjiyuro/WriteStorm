import { describe, expect, it } from 'vitest';
import {
  AnalysisModuleRepository,
  AnalysisModuleRepositoryError,
} from '../../../src/main/modules/analysis-module-repository';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import { ANALYSIS_MODULE_DEFINITIONS } from '../../../src/shared/domain';

const ANALYSIS_MODULE_DEFINITION_MIGRATIONS = APP_MIGRATIONS.slice(0, 3);

describe('analysis module definitions migration 003', () => {
  it('registers migration 003 and seeds exactly the seven shared module definitions', () => {
    withDatabase((database) => {
      expect(ANALYSIS_MODULE_DEFINITION_MIGRATIONS.map(({ id, name }) => ({ id, name }))).toEqual([
        { id: 1, name: 'v1_runtime_baseline' },
        { id: 2, name: 'structure_workspace' },
        { id: 3, name: 'analysis_module_definitions' },
      ]);
      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(tableColumns(database, 'analysis_modules')).toEqual([
        'id',
        'key',
        'name',
        'category',
        'creates_module_instance',
        'sort_order',
      ]);
      expect(new AnalysisModuleRepository().list(database)).toEqual(ANALYSIS_MODULE_DEFINITIONS);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_modules').pluck().get()).toBe(7);
      expect(database.prepare(
        "SELECT COUNT(*) FROM analysis_modules WHERE key = 'ai_constraint_summary'",
      ).pluck().get()).toBe(0);
    });
  });

  it('upgrades an existing schema-v2 Book without replacing business data', () => {
    const database = openSqliteDatabase(':memory:');
    try {
      runMigrations(database, ANALYSIS_MODULE_DEFINITION_MIGRATIONS.slice(0, 2));
      database.prepare(`
        INSERT INTO books (id, title, current_source_text_id, created_at, updated_at)
        VALUES ('book-before-003', 'Existing Book', NULL, 'now', 'now')
      `).run();

      runMigrations(database, ANALYSIS_MODULE_DEFINITION_MIGRATIONS);

      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(database.prepare("SELECT title FROM books WHERE id = 'book-before-003'").pluck().get())
        .toBe('Existing Book');
      expect(new AnalysisModuleRepository().list(database)).toEqual(ANALYSIS_MODULE_DEFINITIONS);
    } finally {
      database.close();
    }
  });

  it('enforces the stable key, identity, name, category, instance, and order boundaries', () => {
    withDatabase((database) => {
      expect(() => database.prepare(`
        INSERT INTO analysis_modules
          (id, key, name, category, creates_module_instance, sort_order)
        VALUES ('eighth', 'eighth', 'Eighth', 'analysis', 1, 7)
      `).run()).toThrow(/CHECK constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_modules SET id = 'different-id'
        WHERE key = 'plot_causality'
      `).run()).toThrow(/CHECK constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_modules SET name = ' '
        WHERE key = 'plot_causality'
      `).run()).toThrow(/CHECK constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_modules SET category = 'secondary_system_page'
        WHERE key = 'plot_causality'
      `).run()).toThrow(/CHECK constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_modules SET creates_module_instance = 0
        WHERE key = 'plot_causality'
      `).run()).toThrow(/CHECK constraint failed/i);
      expect(() => database.prepare(`
        UPDATE analysis_modules SET sort_order = 7
        WHERE key = 'plot_causality'
      `).run()).toThrow(/CHECK constraint failed/i);
    });
  });

  it('rejects a persisted definition that no longer matches the shared contract snapshot', () => {
    withDatabase((database) => {
      database.prepare(`
        UPDATE analysis_modules SET name = 'Renamed outside the contract'
        WHERE key = 'plot_causality'
      `).run();

      expect(() => new AnalysisModuleRepository().list(database)).toThrowError(
        new AnalysisModuleRepositoryError('module_contract_unavailable'),
      );
    });
  });
});

function withDatabase(assertions: (database: SqliteDatabase) => void): void {
  const database = openSqliteDatabase(':memory:');
  try {
    runMigrations(database, ANALYSIS_MODULE_DEFINITION_MIGRATIONS);
    assertions(database);
  } finally {
    database.close();
  }
}

function tableColumns(database: SqliteDatabase, table: string): string[] {
  return (database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>)
    .map(({ name }) => name);
}
