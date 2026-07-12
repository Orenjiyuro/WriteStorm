import type { LibrarySummary } from '../../shared/contracts';
import type { SqliteDatabase } from '../db/sqlite';

export type InternalLibrarySession = {
  readonly sessionId: string;
  readonly library: LibrarySummary;
  readonly rootPath: string;
  readonly manifestPath: string;
  readonly databasePath: string;
  readonly database: SqliteDatabase;
};

export type LibraryUnitOfWorkErrorCode =
  | 'LIBRARY_SESSION_REQUIRED'
  | 'LIBRARY_SESSION_CHANGED';

export class LibraryUnitOfWorkError extends Error {
  readonly code: LibraryUnitOfWorkErrorCode;

  constructor(code: LibraryUnitOfWorkErrorCode) {
    super(code === 'LIBRARY_SESSION_REQUIRED'
      ? 'An open library session is required.'
      : 'The library session changed before the transaction could commit.');
    this.name = 'LibraryUnitOfWorkError';
    this.code = code;
  }
}

export interface LibraryUnitOfWork {
  read<T>(operation: (session: InternalLibrarySession) => T): T;
  write<T>(operation: (session: InternalLibrarySession) => T): T;
}

export function createLibraryUnitOfWork(
  getCurrentSession: () => InternalLibrarySession | null,
): LibraryUnitOfWork {
  const requireCurrentSession = (): InternalLibrarySession => {
    const session = getCurrentSession();
    if (!session) throw new LibraryUnitOfWorkError('LIBRARY_SESSION_REQUIRED');
    return session;
  };

  return {
    read: (operation) => operation(requireCurrentSession()),
    write: (operation) => {
      const session = requireCurrentSession();
      return session.database.transaction(() => {
        const result = operation(session);
        if (getCurrentSession()?.sessionId !== session.sessionId) {
          throw new LibraryUnitOfWorkError('LIBRARY_SESSION_CHANGED');
        }
        return result;
      })();
    },
  };
}
