import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getCurrentSchemaVersion,
  runMigrations,
  type Migration,
} from '../../../src/main/db/migration-runner';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('SQLite migration runner', () => {
  it('opens better-sqlite3 databases with foreign key enforcement enabled', () => {
    const db = openSqliteDatabase(tempDatabasePath());

    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  });

  it('applies pending migrations in order and records schema_migrations rows', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    const migrations: Migration[] = [
      {
        id: 1,
        name: 'create_probe_table',
        up(database) {
          database.exec('CREATE TABLE native_gate_probe (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
        },
      },
      {
        id: 2,
        name: 'seed_probe_table',
        up(database) {
          database.prepare('INSERT INTO native_gate_probe (name) VALUES (?)').run('first');
        },
      },
    ];

    try {
      runMigrations(db, migrations);

      expect(getCurrentSchemaVersion(db)).toBe(2);
      expect(db.prepare('SELECT name FROM native_gate_probe').pluck().all()).toEqual(['first']);
      expect(db.prepare('SELECT id FROM schema_migrations ORDER BY id').pluck().all()).toEqual([1, 2]);

      runMigrations(db, migrations);

      expect(db.prepare('SELECT name FROM native_gate_probe').pluck().all()).toEqual(['first']);
    } finally {
      db.close();
    }
  });

  it('rolls back all pending migrations when one migration fails', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    const migrations: Migration[] = [
      {
        id: 1,
        name: 'create_probe_table',
        up(database) {
          database.exec('CREATE TABLE native_gate_probe (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
        },
      },
      {
        id: 2,
        name: 'fail_after_probe_table',
        up() {
          throw new Error('intentional migration failure');
        },
      },
    ];

    try {
      expect(() => runMigrations(db, migrations)).toThrow(/intentional migration failure/);
      expect(getCurrentSchemaVersion(db)).toBe(0);
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'native_gate_probe'")
          .pluck()
          .get(),
      ).toBeUndefined();
      expect(db.prepare('SELECT id FROM schema_migrations ORDER BY id').pluck().all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('rejects databases with applied migration ids unknown to the current registry', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    const migrations: Migration[] = [
      {
        id: 1,
        name: 'known_migration',
        up(database) {
          database.exec('CREATE TABLE known_probe (id INTEGER PRIMARY KEY)');
        },
      },
    ];

    try {
      runMigrations(db, migrations);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        2,
        'future_migration',
        '2026-07-09T00:00:00.000Z',
      );

      expect(() => runMigrations(db, migrations)).toThrow(/unknown applied migration/i);
    } finally {
      db.close();
    }
  });

  it('rejects databases whose applied migration name differs from the current registry', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    const originalMigrations: Migration[] = [
      {
        id: 1,
        name: 'original_name',
        up(database) {
          database.exec('CREATE TABLE renamed_probe (id INTEGER PRIMARY KEY)');
        },
      },
    ];
    const renamedMigrations: Migration[] = [
      {
        ...originalMigrations[0],
        name: 'renamed_migration',
      },
    ];

    try {
      runMigrations(db, originalMigrations);

      expect(() => runMigrations(db, renamedMigrations)).toThrow(/migration history mismatch/i);
    } finally {
      db.close();
    }
  });

  it('rejects databases whose applied migration history is not a contiguous registry prefix', () => {
    const db = openSqliteDatabase(tempDatabasePath());
    const migrations: Migration[] = [
      {
        id: 1,
        name: 'first_migration',
        up(database) {
          database.exec('CREATE TABLE prefix_probe (id INTEGER PRIMARY KEY)');
        },
      },
      {
        id: 2,
        name: 'second_migration',
        up() {
          // No-op migration for prefix validation.
        },
      },
    ];

    try {
      db.exec(`
        CREATE TABLE schema_migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        2,
        'second_migration',
        '2026-07-09T00:00:00.000Z',
      );

      expect(() => runMigrations(db, migrations)).toThrow(/contiguous/i);
    } finally {
      db.close();
    }
  });
});

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'writestorm-block6-'));
  tempDirs.push(tempDir);

  return path.join(tempDir, 'writestorm.sqlite');
}
