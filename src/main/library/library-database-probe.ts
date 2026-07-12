import Database from 'better-sqlite3';
import type { LibraryId } from '../../shared/domain';
import { createDomainError, type DomainError } from '../../shared/errors';
import type { Migration } from '../db/migration-runner';
import {
  WRITESTORM_SCHEMA_EPOCH,
  WRITESTORM_SQLITE_APPLICATION_ID,
} from '../db/schema-identity';

export type LibraryDatabaseProbeResult =
  | {
      readonly ok: true;
      readonly identity: {
        readonly id: LibraryId;
        readonly name: string;
        readonly appVersion: string;
        readonly schemaEpoch: number;
      };
    }
  | {
      readonly ok: false;
      readonly error: DomainError;
    };

export function probeLibraryDatabase(
  databasePath: string,
  migrations: readonly Migration[],
): LibraryDatabaseProbeResult {
  let database: Database.Database | null = null;

  try {
    database = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    const applicationId = database.pragma('application_id', { simple: true });

    if (applicationId !== WRITESTORM_SQLITE_APPLICATION_ID) {
      return rejected(
        'LIBRARY_DATABASE_NOT_WRITESTORM',
        'The selected database is not a WriteStorm library.',
      );
    }

    const identity = database.prepare(`
      SELECT id, name, app_version AS appVersion, schema_epoch AS schemaEpoch
      FROM library
      WHERE singleton_key = 1
    `).get() as Record<string, unknown> | undefined;
    const migrationRows = database.prepare(
      'SELECT id, name FROM schema_migrations ORDER BY id',
    ).all() as Array<{ id: unknown; name: unknown }>;

    if (!isIdentityRow(identity)) {
      return rejected('LIBRARY_SCHEMA_INCOMPATIBLE', 'Library database identity is invalid.');
    }

    if (identity.schemaEpoch < WRITESTORM_SCHEMA_EPOCH) {
      return rejected(
        'DEV_SCHEMA_RESET_REQUIRED',
        'This development library uses an obsolete schema epoch and must be recreated.',
      );
    }

    if (
      identity.schemaEpoch !== WRITESTORM_SCHEMA_EPOCH ||
      !matchesMigrationRegistry(migrationRows, migrations)
    ) {
      return rejected('LIBRARY_SCHEMA_INCOMPATIBLE', 'Library migration history is incompatible.');
    }

    return {
      ok: true,
      identity: {
        id: identity.id as LibraryId,
        name: identity.name,
        appVersion: identity.appVersion,
        schemaEpoch: identity.schemaEpoch,
      },
    };
  } catch {
    return rejected('LIBRARY_SCHEMA_INCOMPATIBLE', 'Library database could not be validated.');
  } finally {
    database?.close();
  }
}

function isIdentityRow(row: Record<string, unknown> | undefined): row is {
  id: string;
  name: string;
  appVersion: string;
  schemaEpoch: number;
} {
  return Boolean(
    row &&
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.appVersion === 'string' &&
    typeof row.schemaEpoch === 'number',
  );
}

function matchesMigrationRegistry(
  rows: Array<{ id: unknown; name: unknown }>,
  migrations: readonly Migration[],
): boolean {
  return rows.length === migrations.length && rows.every((row, index) => (
    row.id === migrations[index]?.id && row.name === migrations[index]?.name
  ));
}

function rejected(code: DomainError['code'], message: string): LibraryDatabaseProbeResult {
  return {
    ok: false,
    error: createDomainError({
      code,
      message,
      recoverable: false,
    }),
  };
}
