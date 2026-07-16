import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase, type SqliteDatabase } from '../../../src/main/db/sqlite';
import {
  ExportStatusService,
  ExportStatusServiceError,
} from '../../../src/main/exports/export-status-service';
import type { LibraryService } from '../../../src/main/library/library-service';
import {
  createLibraryUnitOfWork,
  type InternalLibrarySession,
} from '../../../src/main/library/library-unit-of-work';
import { AnalysisModuleInstanceEditionChangePort } from '../../../src/main/modules/analysis-module-instance-edition-change-port';
import { createStructureEditionChange } from '../../../src/main/structure/structure-edition-change-port';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  type AnalysisModuleInstanceId,
  type BreakdownBookId,
  type LibraryId,
  type StructureSetId,
} from '../../../src/shared/domain';

const databases: SqliteDatabase[] = [];
const tempDirectories: string[] = [];
const bookId = 'book-export-service' as BreakdownBookId;
const frozenSetId = 'frozen-export-service' as StructureSetId;
const now = '2026-07-16T10:00:00.000Z';

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('ExportStatusService', () => {
  it('returns a successful blocked status before structure freeze without writing SQLite', () => {
    const fixture = exportFixture({ frozen: false });
    const service = new ExportStatusService({ libraryService: fixture.libraryService });
    const beforeChanges = totalChanges(fixture.database);

    const result = service.getStatus(bookId);

    expect(result.targets[0]).toMatchObject({
      kind: 'markdown_package',
      availability: 'blocked',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
    });
    expect(result.targets[1]).toMatchObject({
      kind: 'machine_package',
      availability: 'unavailable',
      blockers: [
        'export_execution_not_admitted',
        'structure_not_frozen',
        ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
      ],
    });
    expect(totalChanges(fixture.database)).toBe(beforeChanges);
  });

  it('uses the authoritative module gate and reads exactly seven book-scope status/body facts', () => {
    const fixture = exportFixture({ frozen: true });
    fixture.database.prepare(`
      UPDATE analysis_module_instances
      SET status = CASE module_id
        WHEN 'structure_and_segments' THEN 'confirmed'
        WHEN 'plot_causality' THEN 'generated_pending_review'
        WHEN 'narrative_pacing' THEN 'stale'
        WHEN 'character_relations' THEN 'needs_rebuild'
        ELSE 'not_generated'
      END,
      body_markdown = CASE
        WHEN module_id = 'structure_and_segments' THEN '# Structure'
        ELSE ''
      END
      WHERE book_id = ?
    `).run(bookId);
    const service = new ExportStatusService({ libraryService: fixture.libraryService });
    const beforeChanges = totalChanges(fixture.database);

    const result = service.getStatus(bookId);

    expect(result.targets[0].preview.moduleInstances).toEqual({
      expectedCount: 7,
      actualCount: 7,
      nonEmptyBodyCount: 1,
      statusCounts: {
        not_generated: 3,
        generated_pending_review: 1,
        confirmed: 1,
        stale: 1,
        needs_rebuild: 1,
      },
    });
    expect(result.targets[0].blockers).toEqual([
      'export_execution_not_admitted',
      'analysis_module_not_generated',
      'analysis_module_pending_review',
      'analysis_module_stale',
      'analysis_module_needs_rebuild',
      'analysis_module_body_missing',
      ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
    ]);
    expect(result.owners.map(({ ownerKind, availability }) => [ownerKind, availability])).toEqual([
      ['book', 'available'],
      ['structure', 'available'],
      ['analysis_modules', 'available'],
      ['review_assets', 'unavailable'],
      ['evidence_anchors', 'unavailable'],
      ['technique_assets', 'unavailable'],
      ['perspective_views', 'unavailable'],
      ['completion_gate', 'unavailable'],
    ]);
    expect(totalChanges(fixture.database)).toBe(beforeChanges);
  });

  it('fails closed for missing sessions, missing Books, damaged definitions, and incomplete shells', () => {
    const fixture = exportFixture({ frozen: true });
    const service = new ExportStatusService({ libraryService: fixture.libraryService });

    expect(() => service.getStatus('missing-book' as BreakdownBookId)).toThrowError(
      new ExportStatusServiceError('book_not_found'),
    );

    fixture.database.prepare(`
      UPDATE analysis_modules SET name = 'Damaged module' WHERE id = 'world_rules'
    `).run();
    expect(() => service.getStatus(bookId)).toThrowError(
      new ExportStatusServiceError('module_contract_unavailable'),
    );

    fixture.database.prepare(`
      UPDATE analysis_modules SET name = ? WHERE id = 'world_rules'
    `).run(ANALYSIS_MODULE_DEFINITIONS.find(({ id }) => id === 'world_rules')!.name);
    fixture.database.prepare(`
      DELETE FROM analysis_module_instances
      WHERE book_id = ? AND module_id = 'world_rules'
    `).run(bookId);
    expect(() => service.getStatus(bookId)).toThrowError(
      new ExportStatusServiceError('book_scope_instances_incomplete'),
    );

    fixture.setCurrent(null);
    expect(() => service.getStatus(bookId)).toThrowError(
      new ExportStatusServiceError('no_current_library'),
    );
  });

  it('maps a frozen Book/current-structure mismatch to persisted-contract failure', () => {
    const fixture = exportFixture({ frozen: true });
    fixture.database.prepare(`
      UPDATE books SET structure_edition = 2 WHERE id = ?
    `).run(bookId);
    const service = new ExportStatusService({ libraryService: fixture.libraryService });

    expect(() => service.getStatus(bookId)).toThrowError(
      new ExportStatusServiceError('structure_snapshot_mismatch'),
    );
  });

  it('certifies no-write status across business tables, export Jobs, and Library files', () => {
    const rootPath = tempDirectory();
    mkdirSync(path.join(rootPath, 'source'), { recursive: true });
    mkdirSync(path.join(rootPath, 'exports', 'existing'), { recursive: true });
    mkdirSync(path.join(rootPath, 'mirrors', 'existing'), { recursive: true });
    writeFileSync(path.join(rootPath, 'manifest.json'), JSON.stringify({
      manifestVersion: 1,
      libraryId: 'library-export-service',
      name: 'Export Service',
    }, null, 2));
    writeFileSync(path.join(rootPath, 'source', 'source.md'), '# Source sentinel\n');
    writeFileSync(path.join(rootPath, 'exports', 'existing', 'package.md'), '# Existing export\n');
    writeFileSync(
      path.join(rootPath, 'exports', 'existing', 'package.json'),
      JSON.stringify({ existing: true }),
    );
    writeFileSync(path.join(rootPath, 'mirrors', 'existing', 'mirror.md'), '# Existing mirror\n');
    writeFileSync(
      path.join(rootPath, 'mirrors', 'existing', 'mirror.json'),
      JSON.stringify({ existing: true }),
    );
    const fixture = exportFixture({ frozen: true, rootPath });
    const service = new ExportStatusService({ libraryService: fixture.libraryService });
    const beforeTables = snapshotBusinessTables(fixture.database);
    const beforeChanges = totalChanges(fixture.database);
    const beforeExportTree = snapshotDirectoryTree(path.join(rootPath, 'exports'));
    const beforeMirrorTree = snapshotDirectoryTree(path.join(rootPath, 'mirrors'));
    const beforeMarkdownAndJson = snapshotMarkdownAndJson(rootPath);
    const beforeExportJobs = exportJobCount(fixture.database);

    const result = service.getStatus(bookId);

    expect(result.targets.map(({ availability }) => availability)).toEqual([
      'blocked',
      'unavailable',
    ]);
    expect(totalChanges(fixture.database)).toBe(beforeChanges);
    expect(snapshotBusinessTables(fixture.database)).toEqual(beforeTables);
    expect(exportJobCount(fixture.database)).toBe(0);
    expect(exportJobCount(fixture.database)).toBe(beforeExportJobs);
    expect(snapshotDirectoryTree(path.join(rootPath, 'exports'))).toEqual(beforeExportTree);
    expect(snapshotDirectoryTree(path.join(rootPath, 'mirrors'))).toEqual(beforeMirrorTree);
    expect(snapshotMarkdownAndJson(rootPath)).toEqual(beforeMarkdownAndJson);
  });
});

function exportFixture(input: {
  readonly frozen: boolean;
  readonly rootPath?: string;
}): {
  readonly database: SqliteDatabase;
  readonly libraryService: LibraryService;
  readonly setCurrent: (session: InternalLibrarySession | null) => void;
} {
  const rootPath = input.rootPath ?? 'C:\\Libraries\\ExportService';
  const databasePath = input.rootPath
    ? path.join(input.rootPath, 'writestorm.sqlite')
    : ':memory:';
  const database = openSqliteDatabase(databasePath);
  databases.push(database);
  runMigrations(database, APP_MIGRATIONS);
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, 'library-export-service', 'Export Service', '0.1.0-test', ?, ?)
  `).run(now, now);
  database.prepare(`
    INSERT INTO books (id, title, current_source_text_id, created_at, updated_at)
    VALUES (?, 'Export Service Book', NULL, ?, ?)
  `).run(bookId, now, now);
  database.prepare(`
    INSERT INTO source_texts (
      id, book_id, original_file_name, size_bytes, format, content_hash,
      encoding, source_edition, relative_path, imported_at
    ) VALUES ('source-export-service', ?, 'source.md', 10, 'md',
      'sha256:export-service', 'utf-8', 1, 'source/source.md', ?)
  `).run(bookId, now);
  database.prepare(`
    UPDATE books SET current_source_text_id = 'source-export-service' WHERE id = ?
  `).run(bookId);

  if (input.frozen) {
    database.prepare(`
      UPDATE books SET structure_edition = 1 WHERE id = ?
    `).run(bookId);
    database.prepare(`
      INSERT INTO structure_sets (
        id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, stage, detection_run_id, story_range_mode,
        draft_revision, structure_edition, frozen_at, is_current, created_at, updated_at,
        origin_set_id
      ) VALUES (?, ?, 'source-export-service', 1, 'sha256:export-service', 10,
        'utf16_code_unit', 'frozen', NULL, 'included', NULL, 1, ?, 1, ?, ?, NULL)
    `).run(frozenSetId, bookId, now, now, now);
    let id = 0;
    new AnalysisModuleInstanceEditionChangePort({
      createInstanceId: () => `export-instance-${++id}` as AnalysisModuleInstanceId,
      now: () => now,
    }).apply(createStructureEditionChange({
      bookId,
      frozenSetId,
      previousStructureEdition: null,
      structureEdition: 1,
    }), { database });
  }

  let current: InternalLibrarySession | null = {
    sessionId: 'session-export-service',
    library: {
      id: 'library-export-service' as LibraryId,
      name: 'Export Service',
      rootPath,
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
    rootPath,
    manifestPath: path.join(rootPath, 'manifest.json'),
    databasePath,
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

function totalChanges(database: SqliteDatabase): number {
  return (database.prepare(`
    SELECT total_changes() AS totalChanges
  `).get() as { readonly totalChanges: number }).totalChanges;
}

function exportJobCount(database: SqliteDatabase): number {
  return (database.prepare(`
    SELECT COUNT(*) AS count
    FROM jobs
    WHERE kind = 'export'
  `).get() as { readonly count: number }).count;
}

function snapshotBusinessTables(
  database: SqliteDatabase,
): Readonly<Record<string, readonly unknown[]>> {
  const tables = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ readonly name: string }>;

  return Object.fromEntries(tables.map(({ name }) => {
    const quotedName = name.replaceAll('"', '""');
    return [name, database.prepare(`SELECT * FROM "${quotedName}" ORDER BY rowid`).all()];
  }));
}

function snapshotDirectoryTree(rootPath: string): readonly string[] {
  const entries: string[] = [];
  visitDirectory(rootPath, rootPath, entries, false);
  return entries.sort();
}

function snapshotMarkdownAndJson(rootPath: string): Readonly<Record<string, string>> {
  const entries: string[] = [];
  visitDirectory(rootPath, rootPath, entries, true);
  return Object.fromEntries(entries.sort().map((relativePath) => [
    relativePath,
    createHash('sha256')
      .update(readFileSync(path.join(rootPath, ...relativePath.split('/'))))
      .digest('hex'),
  ]));
}

function visitDirectory(
  rootPath: string,
  currentPath: string,
  entries: string[],
  markdownAndJsonOnly: boolean,
): void {
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (!markdownAndJsonOnly) entries.push(`directory:${relativePath}`);
      visitDirectory(rootPath, absolutePath, entries, markdownAndJsonOnly);
    } else if (!markdownAndJsonOnly) {
      entries.push(
        `file:${relativePath}:${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}`,
      );
    } else if (/\.(?:md|json)$/i.test(entry.name)) {
      entries.push(relativePath);
    }
  }
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-export-boundary-'));
  tempDirectories.push(directory);
  return directory;
}
