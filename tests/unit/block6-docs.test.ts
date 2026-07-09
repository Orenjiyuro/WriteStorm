import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Block 6 native-gate documentation', () => {
  it('records the manifest and SQLite authority boundary in engineering decisions and context', () => {
    const decisions = readFileSync(path.resolve('docs/engineering/DECISIONS.md'), 'utf8');
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const technicalDesign = readFileSync(
      path.resolve('docs/engineering/TECHNICAL_DESIGN.md'),
      'utf8',
    );

    expect(decisions).toContain('schemaVersionHint');
    expect(decisions).toContain('schema_migrations');
    expect(decisions).toContain('SQLite `library` row is the authoritative library identity source');
    expect(technicalDesign).toContain('schemaVersionHint');
    expect(technicalDesign).toContain(
      'SQLite `schema_migrations` is the authoritative schema-version source.',
    );
    expect(technicalDesign).toContain('SQLite `library` row owns library identity');
    expect(technicalDesign).toContain('applied migrations must be a contiguous prefix');
    expect(technicalDesign).toContain('`books.source_text_id` references `source_texts.id`');
    expect(technicalDesign).toContain('`relation_links`');
    expect(technicalDesign).toContain('`work_technique_observations`');
    expect(technicalDesign).toContain('`reusable_technique_candidates`');
    expect(technicalDesign).toContain('`technique_entries`');
    expect(technicalDesign).toContain('`source_snapshots`');
    expect(technicalDesign).toContain('`perspective_views`');
    expect(technicalDesign).not.toContain(
      '`manifest.json` stores library identity, schema version, app version and database filename.',
    );
    expect(context).toContain('Block 6 native gate');
    expect(context).toContain('manifestVersion');
    expect(context).toContain('schemaVersionHint');
    expect(context).toContain('Task 6.10 path guard is implemented in the main/library layer.');
    expect(context).toContain('symlink/junction segments that realpath outside the root are rejected');
    expect(context).toContain('Task 6.11 LibraryService create/open/current is implemented');
    expect(context).toContain('LibraryService.open refuses a manifest-only library');
    expect(context).toContain('LibraryService create requires an absent or empty root');
    expect(context).toContain('Migration runner rejects unknown applied migration ids');
    expect(context).toContain('Migration runner rejects non-contiguous applied migration histories');
    expect(context).toContain('LibraryService reads `LibrarySummary` identity from SQLite `library`');
    expect(context).toContain('LibraryService.open validates source/exports/logs/cache/mirrors');
    expect(context).toContain('SQLite open failures map to `LIBRARY_ERROR` with `database_open_failed`');
    expect(context).toContain('`books.source_text_id` is constrained by FK to `source_texts.id`');
    expect(context).toContain('Task 6.4 Foundation Schema is implemented');
    expect(context).toContain('Task 6.5 Content Model Schema shell is implemented');
    expect(context).toContain('TechniqueEntry and ReusableTechniqueCandidate remain separate tables');
    expect(context).toContain('Perspective views are stored in `perspective_views`, not `analysis_module_instances`');
    expect(context).toContain('LibraryService failures are mapped to `LIBRARY_ERROR`');
    expect(context).toContain('renderer requests remain empty and cannot submit arbitrary paths');
    expect(context).toContain('Task 6.11 authorizes only the LibraryService service/IPC minimum loop.');
    expect(context).toContain('Task 6.12 desktop entry skeleton is implemented.');
    expect(context).toContain('The renderer exposes only Create library and Open library entry buttons');
    expect(context).toContain('WRITESTORM_E2E_LIBRARY_DIALOG_STUB');
    expect(context).toContain('Task 6.13 SQLite/migration performance baseline is implemented.');
    expect(context).toContain('small fixture uses 25 probe rows');
    expect(context).toContain('medium fixture uses 1,000 probe rows');
    expect(context).not.toContain(
      'The native gate does not authorize `LibraryService` create/open/current IPC completion',
    );
    expect(context).not.toContain(
      'SQLite, real LibraryService/BookService, import implementation, AI, and full product UI have not started.',
    );
    expect(context).not.toContain('Implement library create/open. Not started.');
    expect(context).toContain(
      'Windows native gate passed; release maker strategy and macOS packaged SQLite smoke remain blocked/not applicable.',
    );
    expect(context).not.toContain(
      'Block 6 native gate partially implemented and blocked on Windows native rebuild environment.',
    );
  });

  it('records native rebuild, package, make, and macOS smoke status for the approved gate', () => {
    const statusPath = path.resolve('docs/engineering/V1-BLOCK-6-STATUS.md');

    expect(existsSync(statusPath)).toBe(true);

    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('better-sqlite3');
    expect(status).toContain('npm run make');
    expect(status).toContain('makers: []');
    expect(status).toContain('macOS packaged SQLite smoke');
    expect(status).toContain('Visual Studio Build Tools 2026');
    expect(status).toContain('@electron/node-gyp');
    expect(status).toContain('2019/2022 support set');
    expect(status).toContain('Status: Windows native gate verified');
    expect(status).toContain('Packaged native SQLite smoke: passed');
    expect(status).toContain('runs a test-only migration');
    expect(status).toContain('reopened schema version');
    expect(status).toContain('npm run check`: passed');
    expect(status).toContain('macOS packaged SQLite smoke: blocked-by-platform');
    expect(status).toContain('use scheme A');
    expect(status).toContain('Do not override or upgrade `@electron/rebuild` or node-gyp');
    expect(status).toContain('Visual Studio Build Tools 2022 version');
    expect(status).toContain('Task 6.4 Foundation Schema');
    expect(status).toContain('Task 6.5 Content Model Schema shell');
    expect(status).toContain('tests/integration/db/app-schema.test.ts');
    expect(status).toContain('schema version 2');
    expect(status).toContain('books.source_text_id` FK');
    expect(status).toContain('Task 6.11 LibraryService');
    expect(status).toContain('Opening an existing library requires `writestorm.sqlite`');
    expect(status).toContain('Creating a library requires an absent or empty root');
    expect(status).toContain('Migration runner validates applied migration history');
    expect(status).toContain('Unknown future migrations and id/name mismatches reject open');
    expect(status).toContain('non-contiguous applied migration histories reject open');
    expect(status).toContain('Library summaries are read from SQLite `library`, not manifest identity fields');
    expect(status).toContain('folder contract directories are checked on open');
    expect(status).toContain('database_open_failed');
    expect(status).toContain('Expected LibraryService failures map to `LIBRARY_ERROR`');
    expect(status).toContain('tests/integration/library/library-service.test.ts');
    expect(status).toContain('Task 6.12 desktop entry skeleton');
    expect(status).toContain('WRITESTORM_E2E_LIBRARY_DIALOG_STUB');
    expect(status).toContain('tests/e2e/library-entry.spec.ts');
    expect(status).toContain('production schema version 2');
    expect(status).toContain('renderer still cannot submit arbitrary filesystem paths');
    expect(status).toContain('Task 6.13 SQLite/migration performance baseline');
    expect(status).toContain('tests/integration/library/library-performance-baseline.test.ts');
    expect(status).toContain('small fixture: create 25.23 ms');
    expect(status).toContain('medium fixture: create 25.11 ms');
    expect(status).toContain('Non-regression limits');
    expect(status).toContain('release/maker strategy blocked-or-not-applicable');
    expect(status).not.toContain(
      'Out of scope: source import, book services, foundation schema, content model shell schema',
    );
  });
});
