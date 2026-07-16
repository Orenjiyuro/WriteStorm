import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import type { LibraryService } from '../../../src/main/library/library-service';
import {
  createLibraryUnitOfWork,
  type InternalLibrarySession,
} from '../../../src/main/library/library-unit-of-work';
import { AnalysisModuleInstanceEditionChangePort } from '../../../src/main/modules/analysis-module-instance-edition-change-port';
import {
  AnalysisModuleInstanceService,
  AnalysisModuleInstanceServiceError,
} from '../../../src/main/modules/analysis-module-instance-service';
import { createStructureEditionChange } from '../../../src/main/structure/structure-edition-change-port';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
  type AnalysisModuleInstanceId,
  type BreakdownBookId,
  type LibraryId,
  type StructureSetId,
} from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];
const bookId = 'book-module-service' as BreakdownBookId;
const frozenSetId = 'frozen-module-service' as StructureSetId;
const now = '2026-07-15T16:00:00.000Z';

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('AnalysisModuleInstanceService', () => {
  it('keeps module definitions separate from per-Book instances and excludes secondary pages', () => {
    const fixture = frozenModuleFixture();
    const definitionColumns = fixture.database
      .prepare("PRAGMA table_xinfo('analysis_modules')")
      .all() as Array<{ readonly name: string }>;
    const instanceColumns = fixture.database
      .prepare("PRAGMA table_xinfo('analysis_module_instances')")
      .all() as Array<{ readonly name: string }>;

    expect(definitionColumns.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(['book_id', 'scope_kind', 'status', 'body_markdown']),
    );
    expect(instanceColumns.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(['key', 'name', 'category', 'sort_order']),
    );
    expect(fixture.database.prepare(`
      SELECT id FROM analysis_modules ORDER BY sort_order
    `).pluck().all()).toEqual(ANALYSIS_MODULE_DEFINITIONS.map(({ id }) => id));
    expect(fixture.database.prepare(`
      SELECT module_id FROM analysis_module_instances WHERE book_id = ? ORDER BY module_id
    `).pluck().all(bookId)).toHaveLength(ANALYSIS_MODULE_DEFINITIONS.length);

    for (const page of ANALYSIS_SECONDARY_SYSTEM_PAGES) {
      expect(fixture.database.prepare(`
        SELECT COUNT(*) FROM analysis_modules WHERE id = ? OR key = ?
      `).pluck().get(page.key, page.key)).toBe(0);
      expect(fixture.database.prepare(`
        SELECT COUNT(*) FROM analysis_module_instances WHERE module_id = ?
      `).pluck().get(page.key)).toBe(0);
    }
  });

  it('returns the seven persisted book-scope summaries in authoritative module order', () => {
    const fixture = frozenModuleFixture();
    const service = new AnalysisModuleInstanceService({ libraryService: fixture.libraryService });

    const result = service.list(bookId);

    expect(result).toHaveLength(7);
    expect(result.map(({ moduleId }) => moduleId))
      .toEqual(ANALYSIS_MODULE_DEFINITIONS.map(({ id }) => id));
    expect(result.every((instance) =>
      instance.bookId === bookId &&
      instance.scope.kind === 'book' &&
      instance.scope.bookId === bookId &&
      instance.status === 'not_generated' &&
      instance.structureEdition === 1 &&
      instance.analysisRevision === 0 &&
      instance.updatedAt === now &&
      !('body' in instance) &&
      !('bodyMarkdown' in instance))).toBe(true);
  });

  it('fails closed when the persisted seven-instance book contract is incomplete', () => {
    const fixture = frozenModuleFixture();
    fixture.database.prepare(`
      DELETE FROM analysis_module_instances
      WHERE book_id = ? AND module_id = 'world_rules'
    `).run(bookId);
    const service = new AnalysisModuleInstanceService({ libraryService: fixture.libraryService });

    expect(() => service.list(bookId)).toThrowError(
      new AnalysisModuleInstanceServiceError('book_scope_instances_incomplete'),
    );
  });

  it('fails closed when the persisted module definition contract is damaged', () => {
    const fixture = frozenModuleFixture();
    fixture.database.prepare(`
      UPDATE analysis_modules SET name = 'damaged name' WHERE id = 'world_rules'
    `).run();
    const service = new AnalysisModuleInstanceService({ libraryService: fixture.libraryService });

    expect(() => service.list(bookId)).toThrowError(
      new AnalysisModuleInstanceServiceError('module_contract_unavailable'),
    );
  });

  it('returns stable prerequisite blockers without reading from another session', () => {
    const fixture = frozenModuleFixture();
    const service = new AnalysisModuleInstanceService({ libraryService: fixture.libraryService });
    expect(() => service.list('missing-book' as BreakdownBookId)).toThrowError(
      new AnalysisModuleInstanceServiceError('book_not_found'),
    );

    fixture.setCurrent(null);
    expect(() => service.list(bookId)).toThrowError(
      new AnalysisModuleInstanceServiceError('no_current_library'),
    );
  });
});

function frozenModuleFixture(): {
  readonly database: SqliteDatabase;
  readonly libraryService: LibraryService;
  readonly setCurrent: (session: InternalLibrarySession | null) => void;
} {
  const database = openSqliteDatabase(':memory:');
  databases.push(database);
  runMigrations(database, APP_MIGRATIONS);
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-module-service', 'Module Service', '0.1.0-test', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO books (id, title, current_source_text_id, created_at, updated_at, structure_edition)
    VALUES (?, 'Module Service Book', NULL, ?, ?, 1)
  `).run(bookId, now, now);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash,
      encoding, source_edition, relative_path, imported_at
    ) VALUES ('source-module-service', ?, 'source.md', 10, 'md',
      'sha256:module-service', 'utf-8', 1, 'source/source.md', ?)
  `).run(bookId, now);
  database.prepare(`
    UPDATE books SET current_source_text_id = 'source-module-service' WHERE id = ?
  `).run(bookId);
  database.prepare(`
    INSERT INTO structure_sets (
      id, book_id, source_text_id, source_text_edition, source_content_hash,
      decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
      draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at,
      origin_set_id
    ) VALUES (?, ?, 'source-module-service', 1, 'sha256:module-service', 10,
      'utf16_code_unit', 'frozen', NULL, 'included', NULL, 1, ?, 1, ?, ?, NULL)
  `).run(frozenSetId, bookId, now, now, now);
  let id = 0;
  new AnalysisModuleInstanceEditionChangePort({
    createInstanceId: () => `service-instance-${++id}` as AnalysisModuleInstanceId,
    now: () => now,
  }).apply(createStructureEditionChange({
    bookId,
    frozenSetId,
    previousStructureEdition: null,
    structureEdition: 1,
  }), { database });

  let current: InternalLibrarySession | null = {
    sessionId: 'session-module-service',
    library: {
      id: 'library-module-service' as LibraryId,
      name: 'Module Service',
      rootPath: 'C:\\Libraries\\ModuleService',
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
    rootPath: 'C:\\Libraries\\ModuleService',
    manifestPath: 'C:\\Libraries\\ModuleService\\library.json',
    databasePath: ':memory:',
    database,
  };
  const unitOfWork = createLibraryUnitOfWork(() => current);
  return {
    database,
    setCurrent: (session) => { current = session; },
    libraryService: {
      getCurrent: () => current ? { sessionId: current.sessionId, library: current.library } : null,
      getUnitOfWork: () => unitOfWork,
    } as unknown as LibraryService,
  };
}
