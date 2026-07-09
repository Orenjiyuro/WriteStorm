import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_MIGRATIONS,
  assertMigrationRegistry,
} from '../../src/main/db/migrations';

describe('static migration registry', () => {
  it('uses a statically bundled migration registry instead of runtime directory scanning', () => {
    const source = readFileSync(path.resolve('src/main/db/migrations/index.ts'), 'utf8');

    expect(source).not.toMatch(/readdir|glob|import\s*\(/);
    expect(() => assertMigrationRegistry(APP_MIGRATIONS)).not.toThrow();
  });

  it('rejects duplicate, non-positive, or out-of-order migration ids', () => {
    expect(() => assertMigrationRegistry([
      { id: 1, name: 'one', up: () => undefined },
      { id: 1, name: 'duplicate', up: () => undefined },
    ])).toThrow(/duplicate/i);
    expect(() => assertMigrationRegistry([
      { id: 2, name: 'two', up: () => undefined },
      { id: 1, name: 'one', up: () => undefined },
    ])).toThrow(/ascending/i);
    expect(() => assertMigrationRegistry([
      { id: 0, name: 'zero', up: () => undefined },
    ])).toThrow(/positive/i);
  });
});
