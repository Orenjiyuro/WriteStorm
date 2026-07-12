import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LibraryService } from '../../../src/main/library/library-service';
import {
  createLibraryUnitOfWork,
  type InternalLibrarySession,
  LibraryUnitOfWorkError,
} from '../../../src/main/library/library-unit-of-work';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import type { LibraryId } from '../../../src/shared/domain';
import { getContract } from '../../../src/shared/contracts';

const tempDirs: string[] = [];
const sessionId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('LibrarySession and LibraryUnitOfWork boundary', () => {
  it('publishes an opaque session summary instead of a raw database context', () => {
    const rootPath = path.join(tempDirectory(), 'library');
    const service = new LibraryService({
      appVersion: '0.1.0-test',
      createLibraryId: () => 'library-unit-of-work' as LibraryId,
      createLibrarySessionId: () => sessionId,
    });

    try {
      const current = service.create({ rootPath, name: 'Session Library' });
      expect(current).toEqual({
        sessionId,
        library: {
          id: 'library-unit-of-work',
          name: 'Session Library',
          rootPath,
          schemaVersion: 1,
          appVersion: '0.1.0-test',
        },
      });
      expect(service.getCurrent()).toEqual(current);
      expect(current).not.toHaveProperty('database');
      expect(service.getUnitOfWork().read((session) => ({
        sessionId: session.sessionId,
        libraryId: session.library.id,
      }))).toEqual({
        sessionId,
        libraryId: 'library-unit-of-work',
      });
    } finally {
      service.closeCurrent();
    }
  });

  it('does not expose getCurrentContext as part of LibraryService', () => {
    const source = readFileSync(
      path.resolve('src/main/library/library-service.ts'),
      'utf8',
    );
    expect(source).not.toContain('getCurrentContext()');
    expect(source).not.toMatch(/export type LibraryContext[\s\S]*readonly database/);
  });

  it('uses LibrarySessionSummary for every library IPC response', () => {
    const data = {
      sessionId,
      library: {
        id: 'library-unit-of-work',
        name: 'Session Library',
        rootPath: 'C:\\Library',
        schemaVersion: 1,
        appVersion: '0.1.0-test',
      },
    };
    for (const channel of ['library:create', 'library:open', 'library:get-current'] as const) {
      const schema = getContract(channel).response;
      expect(schema.safeParse({ ok: true, data }).success).toBe(true);
      expect(schema.safeParse({ ok: true, data: data.library }).success).toBe(false);
    }
  });

  it('rolls back when the current session changes immediately before commit', () => {
    const sessionA = internalSession('session-a');
    const sessionB = internalSession('session-b');
    let current: InternalLibrarySession | null = sessionA;
    const unitOfWork = createLibraryUnitOfWork(() => current);

    try {
      sessionA.database.exec('CREATE TABLE proof (value TEXT NOT NULL)');
      expect(() => unitOfWork.write((session) => {
        session.database.prepare('INSERT INTO proof (value) VALUES (?)').run('must-roll-back');
        current = sessionB;
      })).toThrowError(expect.objectContaining({
        code: 'LIBRARY_SESSION_CHANGED',
      }));
      expect(sessionA.database.prepare('SELECT COUNT(*) FROM proof').pluck().get()).toBe(0);
    } finally {
      sessionA.database.close();
      sessionB.database.close();
    }
  });

  it('rejects reads when there is no current library session', () => {
    const unitOfWork = createLibraryUnitOfWork(() => null);
    expect(() => unitOfWork.read(() => 'unreachable')).toThrowError(
      new LibraryUnitOfWorkError('LIBRARY_SESSION_REQUIRED'),
    );
  });
});

function internalSession(sessionId: string): InternalLibrarySession {
  const databasePath = path.join(tempDirectory(), `${sessionId}.sqlite`);
  return {
    sessionId,
    library: {
      id: 'library-unit-of-work' as LibraryId,
      name: sessionId,
      rootPath: path.dirname(databasePath),
      schemaVersion: 1,
      appVersion: '0.1.0-test',
    },
    rootPath: path.dirname(databasePath),
    manifestPath: path.join(path.dirname(databasePath), 'manifest.json'),
    databasePath,
    database: openSqliteDatabase(databasePath),
  };
}

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-library-uow-'));
  tempDirs.push(directory);
  return directory;
}
