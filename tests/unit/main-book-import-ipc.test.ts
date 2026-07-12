import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createBookImportIpcDependencies } from '../../src/main/books/book-import-ipc';
import { registerProductIpc } from '../../src/main/ipc';
import { LibraryService } from '../../src/main/library/library-service';
import type { ProductIpcChannel } from '../../src/shared/contracts';
import type {
  BreakdownBookId,
  JobId,
  LibraryId,
  SourceTextId,
} from '../../src/shared/domain';

type MockIpcListener = (event: MockIpcEvent, payload: unknown) => unknown;

type MockIpcEvent = {
  senderFrame?: {
    url?: string;
  };
};

class MockIpcMain {
  readonly handlers = new Map<string, MockIpcListener>();

  handle(channel: string, listener: MockIpcListener): void {
    this.handlers.set(channel, listener);
  }

  invoke(channel: ProductIpcChannel, payload: unknown, senderUrl = 'writestorm://app/index.html'): Promise<unknown> {
    const listener = this.handlers.get(channel);

    if (!listener) {
      throw new Error(`Missing handler for ${channel}`);
    }

    return Promise.resolve(listener({ senderFrame: { url: senderUrl } }, payload));
  }
}

const tempDirs: string[] = [];
const libraryId = 'library-import-ipc-test' as LibraryId;
const bookId = 'book-import-1' as BreakdownBookId;
const sourceTextId = 'source-import-1' as SourceTextId;
const jobId = 'job-import-1' as JobId;
const now = '2026-07-09T00:00:00.000Z';

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('main book import IPC handlers', () => {
  it('delegates persisted book listing to BookService', () => {
    const source = readFileSync(path.resolve('src/main/books/book-import-ipc.ts'), 'utf8');
    expect(source).not.toMatch(/SELECT[\s\S]*FROM books/i);
    expect(source).toContain('BookService');
  });

  it('imports a txt/md source through a main-side dialog selection and writes SQLite plus copied source', async () => {
    const rootPath = libraryRootPath();
    const sourcePath = fixtureSourceFile('Fixture Source.md', '# Chapter 1\nImported text.\n');
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
    });

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'IPC Import Library' }),
          selectOpenRoot: () => rootPath,
        },
        books: createBookImportIpcDependencies({
          service,
          showOpenDialog: async () => ({
            canceled: false,
            filePaths: [sourcePath],
          }),
          now: () => now,
          createBookId: () => bookId,
          createSourceTextId: () => sourceTextId,
          createJobId: () => jobId,
        }),
      });

      await expect(ipcMain.invoke('library:create', {})).resolves.toMatchObject({
        ok: true,
        data: {
          sessionId: expect.any(String),
          library: {
            id: libraryId,
            rootPath,
          },
        },
      });

      await expect(ipcMain.invoke('books:import-source', {})).resolves.toEqual({
        ok: true,
        data: {
          book: {
            id: bookId,
            libraryId,
            title: 'Fixture Source',
            sourceTextId,
            sourceTextEdition: 1,
            structureEdition: null,
            updatedAt: now,
          },
          sourceText: {
            id: sourceTextId,
            bookId,
            fileName: 'Fixture Source.md',
            format: 'md',
            sizeBytes: Buffer.byteLength('# Chapter 1\nImported text.\n'),
            encoding: 'utf-8',
            contentHash: expect.stringMatching(/^sha256:/),
            sourceTextEdition: 1,
            importedAt: now,
          },
          job: {
            id: jobId,
            bookId,
            state: 'completed',
            title: 'Import source',
            completedUnits: 1,
            totalUnits: 1,
            checkpointSummary: 'Source imported.',
            failureReason: null,
            updatedAt: now,
          },
        },
      });
      expect(readFileSync(path.join(rootPath, 'source', sourceTextId, 'Fixture Source.md'), 'utf8')).toBe(
        '# Chapter 1\nImported text.\n',
      );
      expect(readImportRows(rootPath)).toEqual({
        books: [{
          id: bookId,
          title: 'Fixture Source',
          current_source_text_id: sourceTextId,
        }],
        sourceTexts: [{
          id: sourceTextId,
          book_id: bookId,
          original_file_name: 'Fixture Source.md',
          relative_path: 'source/source-import-1/Fixture Source.md',
        }],
      });

      await expect(ipcMain.invoke('books:list', {})).resolves.toEqual({
        ok: true,
        data: [{
          id: bookId,
          libraryId,
          title: 'Fixture Source',
          sourceTextId,
          sourceTextEdition: 1,
          structureEdition: null,
          updatedAt: now,
        }],
      });
    } finally {
      service.closeCurrent();
    }
  });

  it('imports the Unicode and newline corpus while preserving copied source bytes', async () => {
    const rootPath = libraryRootPath();
    const corpus = [
      {
        fileName: 'Utf8 Bom Japanese.md',
        bytes: Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          Buffer.from('日本語１２３\r\nEnglish line\n', 'utf8'),
        ]),
        bookId: 'book-corpus-1' as BreakdownBookId,
        sourceTextId: 'source-corpus-1' as SourceTextId,
        jobId: 'job-corpus-1' as JobId,
      },
      {
        fileName: 'Mixed Newlines.txt',
        bytes: Buffer.from('English line\r\n日本語１２３\nsecond LF\n', 'utf8'),
        bookId: 'book-corpus-2' as BreakdownBookId,
        sourceTextId: 'source-corpus-2' as SourceTextId,
        jobId: 'job-corpus-2' as JobId,
      },
      {
        fileName: 'Long Line.md',
        bytes: Buffer.from(`${'A'.repeat(32768)}\r\n日本語 English １２３\n`, 'utf8'),
        bookId: 'book-corpus-3' as BreakdownBookId,
        sourceTextId: 'source-corpus-3' as SourceTextId,
        jobId: 'job-corpus-3' as JobId,
      },
    ];
    let selectedPath = '';
    const bookIds = corpus.map((fixture) => fixture.bookId);
    const sourceTextIds = corpus.map((fixture) => fixture.sourceTextId);
    const jobIds = corpus.map((fixture) => fixture.jobId);
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
    });

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'Unicode Corpus Library' }),
          selectOpenRoot: () => rootPath,
        },
        books: createBookImportIpcDependencies({
          service,
          showOpenDialog: async () => ({
            canceled: false,
            filePaths: [selectedPath],
          }),
          now: () => now,
          createBookId: () => bookIds.shift() ?? ('unexpected-book' as BreakdownBookId),
          createSourceTextId: () => sourceTextIds.shift() ?? ('unexpected-source' as SourceTextId),
          createJobId: () => jobIds.shift() ?? ('unexpected-job' as JobId),
        }),
      });
      await ipcMain.invoke('library:create', {});

      for (const fixture of corpus) {
        selectedPath = fixtureSourceBytes(fixture.fileName, fixture.bytes);

        const response = await ipcMain.invoke('books:import-source', {});

        expect(response).toMatchObject({
          ok: true,
          data: {
            book: {
              id: fixture.bookId,
              title: path.basename(fixture.fileName, path.extname(fixture.fileName)),
            },
            sourceText: {
              id: fixture.sourceTextId,
              fileName: fixture.fileName,
              encoding: 'utf-8',
              sizeBytes: fixture.bytes.byteLength,
            },
            job: {
              id: fixture.jobId,
              state: 'completed',
            },
          },
        });
        expect(readFileSync(path.join(rootPath, 'source', fixture.sourceTextId, fixture.fileName))).toEqual(
          fixture.bytes,
        );
      }
    } finally {
      service.closeCurrent();
    }
  });

  it('cleans the copied source and rolls back SQLite when the completed job write fails', async () => {
    const rootPath = libraryRootPath();
    const sourcePath = fixtureSourceFile('Job Failure.md', '# Job failure\n');
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
    });

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'Job Failure Library' }),
          selectOpenRoot: () => rootPath,
        },
        books: createBookImportIpcDependencies({
          service,
          showOpenDialog: async () => ({
            canceled: false,
            filePaths: [sourcePath],
          }),
          now: () => now,
          createBookId: () => 'book-job-failure' as BreakdownBookId,
          createSourceTextId: () => 'source-job-failure' as SourceTextId,
          createJobId: () => 'job-existing' as JobId,
        }),
      });
      await ipcMain.invoke('library:create', {});
      service.getUnitOfWork().write((session) => {
        session.database.prepare(`
          INSERT INTO jobs (
            id, book_id, kind, state, completed_units, total_units,
            payload_schema_version, payload_json, error_code, error_details_json, created_at, updated_at
          )
          VALUES (?, NULL, 'source_import', 'completed', 1, 1, 1, '{}', NULL, NULL, ?, ?)
        `).run('job-existing', now, now);
      });

      await expect(ipcMain.invoke('books:import-source', {})).resolves.toMatchObject({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          details: {
            reason: 'database_write_failed',
          },
        },
      });
      expect(readImportRows(rootPath)).toEqual({
        books: [],
        sourceTexts: [],
      });
      expect(existsSync(path.join(rootPath, 'source', 'source-job-failure', 'Job Failure.md'))).toBe(false);
    } finally {
      service.closeCurrent();
    }
  });

  it('maps a real unique content-hash constraint failure back to the competing source ids', async () => {
    const rootPath = libraryRootPath();
    const sourceBytes = Buffer.from('# Concurrent duplicate\n');
    const sourcePath = fixtureSourceBytes('Concurrent Duplicate.md', sourceBytes);
    const contentHash = `sha256:${createHash('sha256').update(sourceBytes).digest('hex')}`;
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
    });
    let injected = false;

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'Concurrent Duplicate Library' }),
          selectOpenRoot: () => rootPath,
        },
        books: createBookImportIpcDependencies({
          service,
          showOpenDialog: async () => ({
            canceled: false,
            filePaths: [sourcePath],
          }),
          now: () => now,
          createBookId: () => {
            if (!injected) {
              injected = true;
              service.getUnitOfWork().write((session) => {
                session.database.prepare(`
                INSERT INTO books (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
              `).run('book-race-existing', 'Existing Concurrent Book', now, now);
                session.database.prepare(`
                INSERT INTO source_texts (
                  id, book_id, format, content_hash, encoding, source_edition,
                  relative_path, imported_at, original_file_name, size_bytes
                ) VALUES (?, ?, 'md', ?, 'utf-8', 1, ?, ?, ?, ?)
              `).run(
                'source-race-existing',
                'book-race-existing',
                contentHash,
                'source/source-race-existing/Concurrent Duplicate.md',
                now,
                'Concurrent Duplicate.md',
                sourceBytes.byteLength,
              );
                session.database.prepare('UPDATE books SET current_source_text_id = ? WHERE id = ?')
                  .run('source-race-existing', 'book-race-existing');
              });
            }

            return 'book-race-new' as BreakdownBookId;
          },
          createSourceTextId: () => 'source-race-new' as SourceTextId,
          createJobId: () => 'job-race-new' as JobId,
        }),
      });
      await ipcMain.invoke('library:create', {});

      await expect(ipcMain.invoke('books:import-source', {})).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            reason: 'duplicate_source_hash',
            existingBookId: 'book-race-existing',
            existingSourceTextId: 'source-race-existing',
          },
        },
      });
      expect(readImportRows(rootPath)).toEqual({
        books: [{
          id: 'book-race-existing',
          title: 'Existing Concurrent Book',
          current_source_text_id: 'source-race-existing',
        }],
        sourceTexts: [{
          id: 'source-race-existing',
          book_id: 'book-race-existing',
          original_file_name: 'Concurrent Duplicate.md',
          relative_path: 'source/source-race-existing/Concurrent Duplicate.md',
        }],
      });
      expect(existsSync(path.join(rootPath, 'source', 'source-race-new', 'Concurrent Duplicate.md'))).toBe(false);
    } finally {
      service.closeCurrent();
    }
  });

  it('returns an actionable encoding choice for GB18030 and imports through manual retry token', async () => {
    const rootPath = libraryRootPath();
    const gb18030Bytes = Buffer.from('c4e3bac3a3b1a3b2a3b30d0a', 'hex');
    const sourcePath = fixtureSourceBytes('GB18030 Source.txt', gb18030Bytes);
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
    });

    try {
      const books = createBookImportIpcDependencies({
        service,
        showOpenDialog: async () => ({
          canceled: false,
          filePaths: [sourcePath],
        }),
        now: () => now,
        createBookId: () => bookId,
        createSourceTextId: () => sourceTextId,
        createJobId: () => jobId,
        createPendingImportId: () => 'pending-gb18030',
      });
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath, name: 'GB18030 Retry Library' }),
          selectOpenRoot: () => rootPath,
        },
        books,
      });
      await ipcMain.invoke('library:create', {});

      await expect(ipcMain.invoke('books:import-source', {})).resolves.toEqual({
        ok: false,
        error: {
          code: 'IMPORT_ERROR',
          message: 'Source file encoding could not be confirmed as UTF-8. Choose an encoding to continue.',
          recoverable: true,
          details: {
            reason: 'encoding_required',
            pendingImportId: 'pending-gb18030',
            supportedEncodings: ['gb18030'],
          },
        },
      });
      books.clearPendingImports();
      await expect(ipcMain.invoke('books:import-source', {
        pendingImportId: 'pending-gb18030',
        encodingOverride: 'gb18030',
      })).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            reason: 'pending_import_not_found',
          },
        },
      });
      await expect(ipcMain.invoke('books:import-source', {})).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            reason: 'encoding_required',
            pendingImportId: 'pending-gb18030',
          },
        },
      });
      await expect(ipcMain.invoke('books:import-source', {
        pendingImportId: 'pending-gb18030',
        encodingOverride: 'gb18030',
      })).resolves.toMatchObject({
        ok: true,
        data: {
          book: {
            id: bookId,
            title: 'GB18030 Source',
          },
          sourceText: {
            id: sourceTextId,
            fileName: 'GB18030 Source.txt',
            encoding: 'gb18030',
            sizeBytes: gb18030Bytes.byteLength,
          },
        },
      });
      expect(readFileSync(path.join(rootPath, 'source', sourceTextId, 'GB18030 Source.txt'))).toEqual(gb18030Bytes);
    } finally {
      service.closeCurrent();
    }
  });

  it('rejects an import whose native dialog resolves after the library session changes', async () => {
    const rootPathA = libraryRootPath();
    const rootPathB = libraryRootPath();
    const sourcePath = fixtureSourceFile('Stale Session.md', '# stale\n');
    const ipcMain = new MockIpcMain();
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => libraryId,
      createLibrarySessionId: (() => {
        let next = 0;
        return () => `session-${++next}`;
      })(),
    });
    let releaseDialog!: () => void;
    let dialogStarted!: () => void;
    const dialogReady = new Promise<void>((resolve) => {
      releaseDialog = resolve;
    });
    const started = new Promise<void>((resolve) => {
      dialogStarted = resolve;
    });
    const setupService = new LibraryService({
      appVersion: '0.1.0-test',
      now: () => now,
      createLibraryId: () => 'library-b' as LibraryId,
    });
    setupService.create({ rootPath: rootPathB, name: 'Library B' });
    setupService.closeCurrent();
    const books = createBookImportIpcDependencies({
      service,
      showOpenDialog: async () => {
        dialogStarted();
        await dialogReady;
        return {
          canceled: false,
          filePaths: [sourcePath],
        };
      },
      now: () => now,
      createPendingImportId: () => 'pending-stale-session',
      createBookId: () => 'book-stale-session' as BreakdownBookId,
      createSourceTextId: () => 'source-stale-session' as SourceTextId,
      createJobId: () => 'job-stale-session' as JobId,
    });

    try {
      registerProductIpc(ipcMain, undefined, {
        library: {
          service,
          selectCreateRoot: () => ({ rootPath: rootPathA, name: 'Library A' }),
          selectOpenRoot: () => rootPathB,
        },
        books,
      });
      await ipcMain.invoke('library:create', {});

      const importPromise = ipcMain.invoke('books:import-source', {});
      await started;
      await ipcMain.invoke('library:open', {});
      releaseDialog();

      await expect(importPromise).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            reason: 'library_session_changed',
          },
        },
      });
      await expect(ipcMain.invoke('books:import-source', {
        pendingImportId: 'pending-stale-session',
        encodingOverride: 'gb18030',
      })).resolves.toMatchObject({
        ok: false,
        error: {
          details: {
            reason: 'pending_import_not_found',
          },
        },
      });
      expect(readImportRows(rootPathA)).toEqual({ books: [], sourceTexts: [] });
      expect(readImportRows(rootPathB)).toEqual({ books: [], sourceTexts: [] });
    } finally {
      service.closeCurrent();
      setupService.closeCurrent();
    }
  });
});

function libraryRootPath(): string {
  return path.join(tempDirectory('writestorm-book-import-ipc-parent-'), 'library');
}

function fixtureSourceFile(fileName: string, content: string): string {
  return fixtureSourceBytes(fileName, Buffer.from(content));
}

function fixtureSourceBytes(fileName: string, bytes: Buffer): string {
  const sourceRoot = tempDirectory('writestorm-book-import-source-');
  const sourcePath = path.join(sourceRoot, fileName);
  writeFileSync(sourcePath, bytes);

  return sourcePath;
}

function tempDirectory(prefix: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function readImportRows(rootPath: string) {
  const database = new Database(path.join(rootPath, 'writestorm.sqlite'), { readonly: true });

  try {
    return {
      books: database.prepare('SELECT id, title, current_source_text_id FROM books ORDER BY id').all(),
      sourceTexts: database.prepare(`
        SELECT id, book_id, original_file_name, relative_path
        FROM source_texts
        ORDER BY id
      `).all(),
    };
  } finally {
    database.close();
  }
}
