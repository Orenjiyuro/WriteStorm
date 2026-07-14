import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { validateRuntimeSchema } from '../../../src/main/db/runtime-schema-validator';

const fixturePath = path.resolve('tests/fixtures/db/v1-runtime-baseline-sqlite-3.53.2.sqlite');
const metadataPath = `${fixturePath}.json`;
const tempDirs: string[] = [];
afterEach(() => tempDirs.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe('SQLite 3.53.2 schema compatibility gate', () => {
  it('validates a real baseline fixture with recorded runtime provenance', () => {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { sqliteVersion: string; sha256: string };
    const database = new Database(fixturePath, { readonly: true, fileMustExist: true });
    try {
      expect(database.prepare('SELECT sqlite_version()').pluck().get()).toBe('3.53.2');
      expect(metadata.sqliteVersion).toBe('3.53.2');
      expect(hash(fixturePath)).toBe(metadata.sha256);
      expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true });
    } finally { database.close(); }
  });

  it('does not modify the source library or create sidecars while running witnesses', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-schema-gate-'));
    tempDirs.push(directory);
    const sourcePath = path.join(directory, 'library.sqlite');
    copyFileSync(fixturePath, sourcePath);
    const beforeHash = hash(sourcePath);
    const beforeEntries = readdirSync(directory).sort();
    const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
    try { expect(validateRuntimeSchema(database, APP_MIGRATIONS)).toEqual({ ok: true }); }
    finally { database.close(); }
    expect(hash(sourcePath)).toBe(beforeHash);
    expect(readdirSync(directory).sort()).toEqual(beforeEntries);
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
});

function hash(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}
