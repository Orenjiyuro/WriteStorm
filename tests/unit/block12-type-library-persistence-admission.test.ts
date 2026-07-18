import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-content-focus-options';
import { BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-main-type-options';

const admission = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-PERSISTENCE-ADMISSION.md',
  'utf8',
);
const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
const schemaInventory = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-SCHEMA-INVENTORY.md',
  'utf8',
);
const migrationRegistry = readFileSync('src/main/db/migrations/index.ts', 'utf8');
const repositorySource = readFileSync(
  'src/main/type-library/type-library-repository.ts',
  'utf8',
);
const serviceSource = readFileSync(
  'src/main/type-library/type-library-service.ts',
  'utf8',
);
const ipcSource = readFileSync('src/main/type-library/type-library-ipc.ts', 'utf8');
const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

describe('Block 12 TypeLibrary persistence admission design', () => {
  it('compares three executable options and recommends normalized SQLite ownership', () => {
    expect(admission).toContain('Status: Task 12.6 complete through D061');
    expect(admission).toContain('Option A: Normalized SQLite Registry And Book Binding');
    expect(admission).toContain('Option B: Source Registry Plus SQLite Book Binding');
    expect(admission).toContain('Option C: JSON Classification Snapshot');
    expect(admission).toContain('Recommendation: Option A');

    for (const tableName of [
      'type_definitions',
      'type_definition_versions',
      'type_library_versions',
      'type_library_version_entries',
      'book_type_bindings',
      'book_content_focus_bindings',
    ]) {
      expect(admission).toContain(`\`${tableName}\``);
    }
  });

  it('records Option A approval and the completed natural product path', () => {
    expect(admission).toContain('Option A approval: approved');
    expect(admission).toContain('CAS/archive approval: approved');
    expect(decisions).toContain('D050: Normalized TypeLibrary Persistence Ownership Selected');
    expect(context).toContain('Option A is approved as the persistence ownership model');
    expect(decisions).toContain('D053: TypeLibrary Book Binding CAS And Archive Lifecycle Approved');

    expect(decisions).toContain('D059: TypeLibrary IPC And Preload Boundary Completes Task 12.6D.3');
    expect(decisions).toContain('D060: TypeLibrary Natural Renderer Paths Complete Task 12.6D.4');
    expect(decisions).toContain('D061: TypeLibrary Electron Acceptance Completes Task 12.6D.5');
    expect(admission).toContain(
      'Source-import product integration, renderer selectors, and natural Electron entry are complete.',
    );
    expect(context).toContain('D061 completes Task 12.6D.5');
    expect(repositorySource).toContain('listReleaseOptions');
    expect(repositorySource).toContain('getBookBinding');
    expect(repositorySource).toContain('invalid_persisted_book_type_binding');
    expect(repositorySource).toContain('replaceBookBinding');
    expect(serviceSource).toContain('revision_conflict');
    expect(serviceSource).toContain('updateInTransaction');
    expect(serviceSource).not.toContain('ipcMain');
    expect(ipcSource).toContain('TYPE_LIBRARY_ERROR');
    expect(ipcSource).not.toContain('databasePath');
  });

  it('records K1 and V1 release approval before the exact SQLite reference seed', () => {
    expect(admission).toContain('K1 mapping approval: approved');
    expect(decisions).toContain('D051: Opaque Namespaced TypeLibrary Stable-Key Mapping Approved');
    expect(decisions).toContain('D052: TypeLibraryVersion 1 Typed Release Approved');
    expect(context).toContain('The K1 mapping is approved');

    for (const option of [...BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS, ...BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS]) {
      expect(option.stableKey).toMatch(/^builtin_(?:main|focus)_00[1-7]$/);
    }
    expect(admission).toContain('V1 release approval: approved');
  });

  it('publishes stable identities in the typed contract and freezes them in migration history', () => {
    for (const option of [...BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS, ...BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS]) {
      expect(option.stableKey).not.toBeNull();
      expect(admission).toContain(option.displayName);
    }
    expect(admission).toContain('Recommended key scheme: opaque namespaced ordinals');
    expect(admission).toContain('migration-local historical literals');
  });

  it('freezes no-row CAS, immutable history, and archive-only retirement semantics', () => {
    expect(admission).toContain('no binding row means `expectedRevision = 0`');
    expect(admission).toContain('first successful mutation creates revision 1');
    expect(admission).toContain('clearing all selections retains the binding row');
    expect(admission).toContain('never rewrites an existing AnalysisConfigurationSnapshot');
    expect(admission).toMatch(/hard delete is not admitted/i);
    expect(admission).toContain('invalid_persisted_book_type_binding');
    for (const document of [admission, context, decisions, schemaInventory]) {
      expect(document).toContain('Task 12.6R5');
      expect(document).toContain('one-way archive');
      expect(document).toContain('current selectors exclude archived definitions');
      expect(document).toContain('historical pinned Book bindings remain readable');
    }
    expect(status).toContain('Task 12.6R5 is complete');
    expect(status).not.toContain('TypeDefinition archive lifecycle remediation remains open');
    for (const document of [admission, context, decisions, status]) {
      expect(document).toContain('D071');
      expect(document).toContain('Book binding detail');
      expect(document).toContain('pinned display metadata');
    }
    expect(decisions).toContain('same release, role, and priority slot');
  });

  it('assigns migrations 006-007 only to admitted persistence facts', () => {
    expect(admission).toContain('Migration 006 is assigned to the approved reference registry and migration 007 to Book binding facts');
    expect(migrationRegistry).toContain('TYPE_LIBRARY_REGISTRY_MIGRATION');
    expect(migrationRegistry).toContain('TYPE_LIBRARY_BOOK_BINDINGS_MIGRATION');
    expect(existsSync('src/main/db/migrations/006_type_library_registry.ts')).toBe(true);
    expect(existsSync('src/main/db/migrations/007_type_library_book_bindings.ts')).toBe(true);
  });

  it('splits implementation into bounded RED/GREEN checkpoints', () => {
    for (const checkpoint of [
      '12.6D.1B Stable Identity And Release Contract',
      '12.6D.1C Migration And Semantic Witnesses',
      '12.6D.2 Repository And Service CAS',
      '12.6D.3 IPC And Preload Boundary',
      '12.6D.4 Natural Renderer Paths',
      '12.6D.5 Electron Acceptance',
    ]) {
      expect(admission).toContain(checkpoint);
    }
    expect(schemaInventory).toContain(
      'Migrations 006–007 and D057–D061 product path certified',
    );
    expect(schemaInventory).toContain(
      'Book summaries expose display-only classification fields',
    );
    expect(schemaInventory).toContain('Append a fifteenth V1 release entry');
    expect(schemaInventory).toContain('Directly delete binding while Book exists');
  });
});
