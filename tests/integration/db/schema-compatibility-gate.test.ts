import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { getCurrentSchemaVersion, runMigrations } from '../../../src/main/db/migration-runner';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';

const fixturePath = path.resolve('tests/fixtures/db/v1-runtime-baseline-sqlite-3.53.2.sqlite');
const metadataPath = `${fixturePath}.json`;
const SQLITE_3532_BASELINE_MIGRATIONS = APP_MIGRATIONS.slice(0, 2);
const ANALYSIS_MODULE_DEFINITION_MIGRATIONS = APP_MIGRATIONS.slice(0, 3);
const tempDirs: string[] = [];
afterEach(() => tempDirs.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe('SQLite 3.53.2 schema compatibility gate', () => {
  it('validates a real baseline fixture with recorded runtime provenance', () => {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { sqliteVersion: string; sqliteLibraryVersionNumber: number; sha256: string };
    const database = new Database(fixturePath, { readonly: true, fileMustExist: true });
    try {
      expect(database.prepare('SELECT sqlite_version()').pluck().get()).toBe('3.53.2');
      expect(metadata.sqliteVersion).toBe('3.53.2');
      expect(metadata.sqliteLibraryVersionNumber).toBe(3_053_002);
      expect(readFileSync(fixturePath).readUInt32BE(96)).toBe(3_053_002);
      expect(hash(fixturePath)).toBe(metadata.sha256);
      expect(validateRuntimeSchema(database, SQLITE_3532_BASELINE_MIGRATIONS)).toEqual({ ok: true });
    } finally { database.close(); }
  });

  it('does not modify the source library or create sidecars while running witnesses', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-schema-gate-'));
    tempDirs.push(directory);
    const sourcePath = path.join(directory, 'library.sqlite');
    copyFileSync(fixturePath, sourcePath);
    const beforeHash = hash(sourcePath);
    const beforeEntries = directorySnapshot(directory);
    const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
    try { expect(validateRuntimeSchema(database, SQLITE_3532_BASELINE_MIGRATIONS)).toEqual({ ok: true }); }
    finally { database.close(); }
    expect(hash(sourcePath)).toBe(beforeHash);
    expect(directorySnapshot(directory)).toEqual(beforeEntries);
  });

  it('does not modify a rejected source library or any directory member', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-schema-gate-rejected-'));
    tempDirs.push(directory);
    const sourcePath = path.join(directory, 'library.sqlite');
    copyFileSync(fixturePath, sourcePath);
    const writable = new Database(sourcePath);
    try { writable.exec('DROP INDEX idx_jobs_book_id_state'); } finally { writable.close(); }
    const beforeEntries = directorySnapshot(directory);
    const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
    try { expect(validateRuntimeSchema(database, SQLITE_3532_BASELINE_MIGRATIONS).ok).toBe(false); }
    finally { database.close(); }
    expect(directorySnapshot(directory)).toEqual(beforeEntries);
  });

  it('admits the canonical partial index and no expression indexes', () => {
    const database = new Database(fixturePath, { readonly: true, fileMustExist: true });
    try {
      const indexRows = database.prepare(`SELECT name FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL ORDER BY name`).pluck().all() as string[];
      const partialRows = database.prepare(`PRAGMA index_list('structure_sets')`).all() as Array<{ name: string; partial: number }>;
      expect(partialRows.filter(({ partial }) => partial === 1).map(({ name }) => name)).toEqual(['idx_structure_sets_current_stage']);
      for (const name of indexRows) {
        const columns = database.prepare(`PRAGMA index_xinfo("${name}")`).all() as Array<{ cid: number }>;
        expect(columns.some(({ cid }) => cid === -2), `${name} must not be an expression index`).toBe(false);
      }
    } finally { database.close(); }
  });

  it('upgrades a retained SQLite 3.53.2 schema-v2 fixture through migration 003', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-schema-gate-003-upgrade-'));
    tempDirs.push(directory);
    const upgradedPath = path.join(directory, 'library.sqlite');
    copyFileSync(fixturePath, upgradedPath);
    const database = new Database(upgradedPath);
    try {
      runMigrations(database, ANALYSIS_MODULE_DEFINITION_MIGRATIONS);
      expect(getCurrentSchemaVersion(database)).toBe(3);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_modules').pluck().get()).toBe(7);
      expect(validateRuntimeSchema(database, ANALYSIS_MODULE_DEFINITION_MIGRATIONS)).toEqual({ ok: true });
    } finally { database.close(); }
  });

  it('upgrades a retained SQLite 3.53.2 schema-v2 fixture through migration 005', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-schema-gate-004-upgrade-'));
    tempDirs.push(directory);
    const upgradedPath = path.join(directory, 'library.sqlite');
    copyFileSync(fixturePath, upgradedPath);
    const database = new Database(upgradedPath);
    try {
      runMigrations(database, APP_MIGRATIONS);
      expect(getCurrentSchemaVersion(database)).toBe(5);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_modules').pluck().get()).toBe(7);
      expect(database.prepare('SELECT COUNT(*) FROM analysis_module_instances').pluck().get()).toBe(0);
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
    } finally { database.close(); }
  });
});

function hash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function directorySnapshot(directory: string) {
  return readdirSync(directory).sort().map((name) => {
    const filePath = path.join(directory, name);
    const stats = statSync(filePath);
    return { name, size: stats.size, sha256: stats.isFile() ? hash(filePath) : null };
  });
}
