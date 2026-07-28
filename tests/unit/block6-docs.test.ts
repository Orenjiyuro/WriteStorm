import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const contextPath = path.resolve('docs/engineering/CONTEXT.md');
const decisionsPath = path.resolve('docs/engineering/DECISIONS.md');
const technicalDesignPath = path.resolve('docs/engineering/TECHNICAL_DESIGN.md');
const historicalStatusPath = path.resolve('docs/engineering/V1-BLOCK-6-STATUS.md');
const migrationRegistryPath = path.resolve('src/main/db/migrations/index.ts');

describe('Block 6 documentation authority', () => {
  it('derives current migration facts from the production registry instead of the old checkpoint', () => {
    const context = readFileSync(contextPath, 'utf8');
    const activeContext = context.split('## Supplemental Evidence And Accepted Direction')[0];
    const decisions = readFileSync(decisionsPath, 'utf8');
    const technicalDesign = readFileSync(technicalDesignPath, 'utf8');
    const migrationRegistry = readFileSync(migrationRegistryPath, 'utf8');

    expect(decisions).toContain('SQLite is the only transactional main fact source');
    expect(activeContext).toContain('production migration registry contains migrations 001–007');
    expect(activeContext).toContain('Migration 001 is');
    expect(activeContext).toContain('`v1_runtime_baseline`');
    expect(activeContext).toContain('migrations 003–007');
    expect(activeContext).not.toContain('001_foundation_schema');
    expect(technicalDesign).toContain('Admitted tables through migration 007');

    const expectedMigrations = [
      'V1_RUNTIME_BASELINE_MIGRATION',
      'STRUCTURE_WORKSPACE_MIGRATION',
      'ANALYSIS_MODULE_DEFINITIONS_MIGRATION',
      'ANALYSIS_MODULE_INSTANCES_MIGRATION',
      'ANALYSIS_MODULE_ASSET_PLACEHOLDERS_MIGRATION',
      'TYPE_LIBRARY_REGISTRY_MIGRATION',
      'TYPE_LIBRARY_BOOK_BINDINGS_MIGRATION',
    ];
    const registryMatch = migrationRegistry.match(
      /export const APP_MIGRATIONS = \[([\s\S]*?)] as const satisfies readonly Migration\[\];/,
    );
    expect(registryMatch).not.toBeNull();
    expect(
      registryMatch?.[1].split(',').map((entry) => entry.trim()).filter(Boolean),
    ).toEqual(expectedMigrations);

    expect(migrationRegistry).not.toMatch(/glob|readdir|readDir|dynamic import/i);
  });

  it('keeps Block 6 evidence as a dated historical record without presenting schema 2 as current', () => {
    expect(existsSync(historicalStatusPath)).toBe(true);
    const status = readFileSync(historicalStatusPath, 'utf8');

    expect(status).toContain('HISTORICAL CHECKPOINT / SUPERSEDED');
    expect(status).toContain('current production registry contains migrations 001–007');
    expect(status).toContain('current registry version is 7, not 2');
    expect(status).toContain('The pre-reset path `src/main/db/migrations/001_foundation_schema.ts` no longer exists');
    expect(status).not.toContain(
      'Task 6.4 Foundation Schema: implemented in production migration `src/main/db/migrations/001_foundation_schema.ts`',
    );
    expect(status).not.toContain(
      'schema version 2 is now the current app schema version after running `APP_MIGRATIONS`',
    );

    for (const datedEvidence of [
      'Packaged native SQLite smoke: passed',
      'npm run make',
      'macOS packaged SQLite smoke',
      'Task 6.11 LibraryService',
      'Task 6.12 desktop entry skeleton',
      'Task 6.13 SQLite/migration performance baseline',
    ]) {
      expect(status).toContain(datedEvidence);
    }
  });
});
