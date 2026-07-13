import { performance } from 'node:perf_hooks';
import path from 'node:path';
import {
  getCurrentSchemaVersion,
  runMigrations,
  type Migration,
} from '../db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../db/sqlite';
import type { LibraryId } from '../../shared/domain';
import { LibraryService } from './library-service';

export type LibraryPerformanceFixtureName = 'small' | 'medium';

export type LibraryPerformanceFixture = {
  readonly name: LibraryPerformanceFixtureName;
  readonly itemCount: number;
  readonly expectedSchemaVersion: number;
};

export type LibraryPerformanceOperationTimingsMs = {
  readonly create: number;
  readonly open: number;
  readonly migration: number;
  readonly summaryQuery: number;
};

export type LibraryPerformanceResult = {
  readonly fixture: LibraryPerformanceFixture;
  readonly timingsMs: LibraryPerformanceOperationTimingsMs;
  readonly summary: {
    readonly itemCount: number;
    readonly schemaVersion: number;
  };
};

export type LibraryPerformanceBaselineOptions = {
  readonly rootParentPath: string;
  readonly appVersion: string;
  readonly now?: () => string;
};

export const LIBRARY_PERFORMANCE_FIXTURES = [
  {
    name: 'small',
    itemCount: 25,
    expectedSchemaVersion: 2,
  },
  {
    name: 'medium',
    itemCount: 1_000,
    expectedSchemaVersion: 2,
  },
] as const satisfies readonly LibraryPerformanceFixture[];

export const LIBRARY_PERFORMANCE_BASELINE_LIMITS_MS = {
  small: {
    create: 750,
    open: 250,
    migration: 500,
    summaryQuery: 50,
  },
  medium: {
    create: 2_000,
    open: 500,
    migration: 1_500,
    summaryQuery: 100,
  },
} as const satisfies Record<LibraryPerformanceFixtureName, LibraryPerformanceOperationTimingsMs>;

export async function runLibraryPerformanceBaseline(
  options: LibraryPerformanceBaselineOptions,
): Promise<LibraryPerformanceResult[]> {
  const results: LibraryPerformanceResult[] = [];
  for (const fixture of LIBRARY_PERFORMANCE_FIXTURES) {
    const migrations = createPerformanceFixtureMigrations(fixture);
    const migrationDatabasePath = path.join(
      options.rootParentPath,
      `${fixture.name}-migration.sqlite`,
    );
    const migrationDatabase = openSqliteDatabase(migrationDatabasePath);
    const migration = measureDuration(() => runMigrations(migrationDatabase, migrations));
    migrationDatabase.close();

    const libraryRootPath = path.join(options.rootParentPath, `${fixture.name}-library`);
    const service = new LibraryService({
      appVersion: options.appVersion,
      now: options.now,
      createLibraryId: () => `performance-${fixture.name}` as LibraryId,
    });
    const create = measureDuration(() => service.create({ rootPath: libraryRootPath, name: `${fixture.name} library` }));
    service.closeCurrent();

    const opener = new LibraryService({
      appVersion: options.appVersion,
      now: options.now,
    });
    const open = await measureDurationAsync(() => opener.open({ rootPath: libraryRootPath }));
    opener.closeCurrent();

    const libraryDatabase = openSqliteDatabase(path.join(libraryRootPath, 'writestorm.sqlite'));
    const benchmarkDatabase = openSqliteDatabase(migrationDatabasePath);
    const summary = measureValue(() => readPerformanceFixtureSummary(
      benchmarkDatabase,
      libraryDatabase,
    ));
    benchmarkDatabase.close();
    libraryDatabase.close();

    results.push({
      fixture,
      timingsMs: {
        create,
        open,
        migration,
        summaryQuery: summary.durationMs,
      },
      summary: summary.value,
    });
  }
  return results;
}

function measureDuration(operation: () => unknown): number {
  const start = performance.now();
  operation();

  return Math.max(0, performance.now() - start);
}

function measureValue<T>(operation: () => T): { durationMs: number; value: T } {
  const start = performance.now();
  const value = operation();

  return {
    durationMs: Math.max(0, performance.now() - start),
    value,
  };
}

function createPerformanceFixtureMigrations(fixture: LibraryPerformanceFixture): Migration[] {
  const migrations: Migration[] = [
    {
      id: 1,
      name: 'create_block6_performance_items',
      up(database) {
        database.exec(`
          CREATE TABLE library (
            singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
            id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            app_version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE block6_performance_items (
            id INTEGER PRIMARY KEY,
            category TEXT NOT NULL,
            payload TEXT NOT NULL
          )
        `);
      },
    },
    {
      id: 2,
      name: 'seed_block6_performance_items',
      up(database) {
        const insertItem = database.prepare(
          'INSERT INTO block6_performance_items (category, payload) VALUES (?, ?)',
        );

        for (let index = 0; index < fixture.itemCount; index += 1) {
          insertItem.run(`category-${index % 8}`, `payload-${fixture.name}-${index}`);
        }
      },
    },
  ];

  if (fixture.name === 'medium') {
    migrations.push({
      id: 3,
      name: 'index_block6_performance_items',
      up(database) {
        database.exec('CREATE INDEX block6_performance_items_category_idx ON block6_performance_items (category)');
      },
    });
  }

  return migrations;
}

function readPerformanceFixtureSummary(
  benchmarkDatabase: SqliteDatabase,
  libraryDatabase: SqliteDatabase,
): {
  itemCount: number;
  schemaVersion: number;
} {
  const itemCount = benchmarkDatabase
    .prepare('SELECT COUNT(*) FROM block6_performance_items')
    .pluck()
    .get();

  return {
    itemCount: typeof itemCount === 'number' ? itemCount : 0,
    schemaVersion: getCurrentSchemaVersion(libraryDatabase),
  };
}

async function measureDurationAsync(operation: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await operation();
  return Math.max(0, performance.now() - start);
}
