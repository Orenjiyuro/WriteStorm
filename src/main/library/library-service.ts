import {
  readdirSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { LibraryId, LibrarySummary } from '../../shared/domain';
import { APP_MIGRATIONS } from '../db/migrations';
import {
  getCurrentSchemaVersion,
  runMigrations,
  type Migration,
} from '../db/migration-runner';
import { openSqliteDatabase, type SqliteDatabase } from '../db/sqlite';
import {
  buildLibraryFolderPaths,
  createLibraryManifest,
  LIBRARY_DATABASE_FILE_NAME,
  LIBRARY_DIRECTORY_NAMES,
  LIBRARY_MANIFEST_FILE_NAME,
  libraryManifestSchema,
  type LibraryManifest,
} from './folder-contract';
import {
  LibraryPathGuardError,
  resolveLibraryRelativePath,
} from './path-guard';

export type LibraryServiceOptions = {
  readonly appVersion: string;
  readonly now?: () => string;
  readonly createLibraryId?: () => LibraryId;
  readonly createLibrarySessionId?: () => string;
  readonly migrations?: readonly Migration[];
};

export type CreateLibraryInput = {
  readonly rootPath: string;
  readonly name: string;
};

export type OpenLibraryInput = {
  readonly rootPath: string;
};

export type LibraryContext = {
  readonly sessionId: string;
  readonly summary: LibrarySummary;
  readonly rootPath: string;
  readonly manifestPath: string;
  readonly databasePath: string;
  readonly database: SqliteDatabase;
};

type LibraryIdentity = {
  readonly id: LibraryId;
  readonly name: string;
  readonly appVersion: string;
};

export type LibraryServiceErrorReason =
  | 'root_not_directory'
  | 'root_not_empty'
  | 'folder_contract_invalid'
  | 'manifest_missing'
  | 'manifest_invalid'
  | 'database_missing'
  | 'database_open_failed'
  | 'library_identity_missing'
  | 'migration_failed'
  | 'path_guard_rejected';

export class LibraryServiceError extends Error {
  readonly reason: LibraryServiceErrorReason;
  readonly recoverable: boolean;

  constructor(
    reason: LibraryServiceErrorReason,
    message: string,
    options: {
      readonly recoverable: boolean;
      readonly cause?: unknown;
    },
  ) {
    super(message, options);
    this.name = 'LibraryServiceError';
    this.reason = reason;
    this.recoverable = options.recoverable;
  }
}

export class LibraryService {
  private currentContext: LibraryContext | null = null;
  private readonly appVersion: string;
  private readonly now: () => string;
  private readonly createLibraryId: () => LibraryId;
  private readonly createLibrarySessionId: () => string;
  private readonly migrations: readonly Migration[];

  constructor(options: LibraryServiceOptions) {
    this.appVersion = options.appVersion;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createLibraryId = options.createLibraryId ?? (() => randomUUID() as LibraryId);
    this.createLibrarySessionId = options.createLibrarySessionId ?? randomUUID;
    this.migrations = options.migrations ?? APP_MIGRATIONS;
  }

  create(input: CreateLibraryInput): LibrarySummary {
    return withLibraryServiceErrors(() => {
      const rootPath = path.resolve(input.rootPath);
      const paths = buildGuardedLibraryFolderPaths(rootPath);
      const rootExistedBeforeCreate = existsSync(paths.rootPath);

      assertCreatableLibraryRoot(paths.rootPath);

      mkdirSync(paths.rootPath, { recursive: true });

      try {
        for (const directoryName of LIBRARY_DIRECTORY_NAMES) {
          mkdirSync(paths.directories[directoryName], { recursive: true });
        }

        const manifest = createLibraryManifest({
          libraryId: this.createLibraryId(),
          name: input.name,
          appVersion: this.appVersion,
          now: this.now(),
        });
        writeManifest(paths.manifestPath, manifest);

        return this.openCreatedOrExisting(paths.rootPath, {
          allowCreateDatabase: true,
          createIdentity: {
            id: manifest.libraryId as LibraryId,
            name: manifest.name,
            appVersion: manifest.appVersion,
            now: manifest.createdAt,
          },
        });
      } catch (error) {
        cleanupFailedCreate(paths, rootExistedBeforeCreate);
        throw error;
      }
    });
  }

  open(input: OpenLibraryInput): LibrarySummary {
    return withLibraryServiceErrors(() => {
      const paths = buildGuardedLibraryFolderPaths(path.resolve(input.rootPath));
      readManifest(paths.manifestPath);

      if (!existsSync(paths.databasePath)) {
        throw new LibraryServiceError('database_missing', 'SQLite database is missing for the selected library.', {
          recoverable: true,
        });
      }
      assertExistingLibraryFolderContract(paths);

      return this.openCreatedOrExisting(paths.rootPath, { allowCreateDatabase: false });
    });
  }

  getCurrent(): LibrarySummary | null {
    return this.currentContext?.summary ?? null;
  }

  getCurrentContext(): LibraryContext | null {
    return this.currentContext;
  }

  closeCurrent(): void {
    this.currentContext?.database.close();
    this.currentContext = null;
  }

  private openCreatedOrExisting(
    rootPath: string,
    options: {
      readonly allowCreateDatabase: boolean;
      readonly createIdentity?: LibraryIdentity & {
        readonly now: string;
      };
    },
  ): LibrarySummary {
    const paths = buildGuardedLibraryFolderPaths(rootPath);
    if (!options.allowCreateDatabase && !existsSync(paths.databasePath)) {
      throw new LibraryServiceError('database_missing', 'SQLite database is missing for the selected library.', {
        recoverable: true,
      });
    }

    let database: SqliteDatabase;
    try {
      database = openSqliteDatabase(paths.databasePath);
    } catch (error) {
      throw new LibraryServiceError('database_open_failed', 'SQLite database could not be opened.', {
        recoverable: true,
        cause: error,
      });
    }

    try {
      runMigrations(database, this.migrations);
      if (options.createIdentity) {
        writeLibraryIdentity(database, options.createIdentity);
      }
      const identity = readLibraryIdentity(database);
      const summary: LibrarySummary = {
        id: identity.id,
        name: identity.name,
        rootPath: paths.rootPath,
        schemaVersion: getCurrentSchemaVersion(database),
        appVersion: identity.appVersion,
      };

      this.closeCurrent();
      this.currentContext = {
        sessionId: this.createLibrarySessionId(),
        summary,
        rootPath: paths.rootPath,
        manifestPath: paths.manifestPath,
        databasePath: paths.databasePath,
        database,
      };

      return summary;
    } catch (error) {
      database.close();
      if (error instanceof LibraryServiceError) {
        throw error;
      }

      throw new LibraryServiceError('migration_failed', 'Library migration failed.', {
        recoverable: false,
        cause: error,
      });
    }
  }
}

function buildGuardedLibraryFolderPaths(rootPath: string) {
  const paths = buildLibraryFolderPaths(rootPath);

  return {
    ...paths,
    manifestPath: resolveLibraryRelativePath(paths.rootPath, LIBRARY_MANIFEST_FILE_NAME),
    databasePath: resolveLibraryRelativePath(paths.rootPath, LIBRARY_DATABASE_FILE_NAME),
    directories: {
      source: resolveLibraryRelativePath(paths.rootPath, 'source'),
      exports: resolveLibraryRelativePath(paths.rootPath, 'exports'),
      logs: resolveLibraryRelativePath(paths.rootPath, 'logs'),
      cache: resolveLibraryRelativePath(paths.rootPath, 'cache'),
      mirrors: resolveLibraryRelativePath(paths.rootPath, 'mirrors'),
    },
  };
}

function assertCreatableLibraryRoot(rootPath: string): void {
  if (!existsSync(rootPath)) {
    return;
  }

  if (!statSync(rootPath).isDirectory()) {
    throw new LibraryServiceError('root_not_directory', 'Library root must be a directory.', {
      recoverable: true,
    });
  }

  if (readdirSync(rootPath).length > 0) {
    throw new LibraryServiceError('root_not_empty', 'Library root is not empty.', {
      recoverable: true,
    });
  }
}

function assertExistingLibraryFolderContract(paths: ReturnType<typeof buildGuardedLibraryFolderPaths>): void {
  if (!existsSync(paths.rootPath) || !statSync(paths.rootPath).isDirectory()) {
    throw new LibraryServiceError('root_not_directory', 'Library root must be a directory.', {
      recoverable: true,
    });
  }

  for (const directoryName of LIBRARY_DIRECTORY_NAMES) {
    const directoryPath = paths.directories[directoryName];

    if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
      throw new LibraryServiceError('folder_contract_invalid', 'Library folder is incomplete.', {
        recoverable: true,
      });
    }
  }
}

function writeLibraryIdentity(
  database: SqliteDatabase,
  identity: LibraryIdentity & {
    readonly now: string;
  },
): void {
  database.prepare(`
    INSERT INTO library (singleton_key, id, name, app_version, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run(identity.id, identity.name, identity.appVersion, identity.now, identity.now);
}

function readLibraryIdentity(database: SqliteDatabase): LibraryIdentity {
  const row = database
    .prepare('SELECT id, name, app_version AS appVersion FROM library WHERE singleton_key = 1')
    .get() as Partial<LibraryIdentity> | undefined;

  if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.appVersion !== 'string') {
    throw new LibraryServiceError('library_identity_missing', 'Library SQLite identity is missing.', {
      recoverable: true,
    });
  }

  return {
    id: row.id as LibraryId,
    name: row.name,
    appVersion: row.appVersion,
  };
}

function cleanupFailedCreate(
  paths: ReturnType<typeof buildGuardedLibraryFolderPaths>,
  rootExistedBeforeCreate: boolean,
): void {
  if (!existsSync(paths.rootPath)) {
    return;
  }

  if (!rootExistedBeforeCreate) {
    rmSync(paths.rootPath, { recursive: true, force: true });
    return;
  }

  rmSync(paths.manifestPath, { force: true });
  rmSync(paths.databasePath, { force: true });

  for (const directoryName of LIBRARY_DIRECTORY_NAMES) {
    rmSync(paths.directories[directoryName], { recursive: true, force: true });
  }
}

function readManifest(manifestPath: string): LibraryManifest {
  if (!existsSync(manifestPath)) {
    throw new LibraryServiceError('manifest_missing', 'Library manifest is missing.', {
      recoverable: true,
    });
  }

  try {
    return libraryManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  } catch (error) {
    throw new LibraryServiceError('manifest_invalid', 'Library manifest is invalid.', {
      recoverable: true,
      cause: error,
    });
  }
}

function writeManifest(manifestPath: string, manifest: LibraryManifest): void {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function withLibraryServiceErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof LibraryServiceError) {
      throw error;
    }

    if (error instanceof LibraryPathGuardError) {
      throw new LibraryServiceError('path_guard_rejected', error.message, {
        recoverable: true,
        cause: error,
      });
    }

    throw error;
  }
}
