import { describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/main/db/migration-runner';
import { APP_MIGRATIONS } from '../../../src/main/db/migrations';
import { openSqliteDatabase } from '../../../src/main/db/sqlite';
import { JobApplicationService } from '../../../src/main/jobs/job-application-service';
import { JobService } from '../../../src/main/jobs/job-service';
import type { LibraryService } from '../../../src/main/library/library-service';
import {
  createLibraryUnitOfWork,
  type InternalLibrarySession,
} from '../../../src/main/library/library-unit-of-work';
import type { BreakdownBookId, JobId, LibraryId } from '../../../src/shared/domain';

const bookId = 'book-job-app' as BreakdownBookId;
const sourceJobId = 'job-source-app' as JobId;
const structureJobId = 'job-structure-app' as JobId;
const createdAt = '2026-07-16T06:00:00.000Z';
const cancelledAt = '2026-07-16T06:05:00.000Z';

describe('JobApplicationService', () => {
  it('reads Library-wide detail and delegates exact active cancellation before returning state', async () => {
    const fixture = jobApplicationFixture();
    const observations: unknown[] = [];
    const application = new JobApplicationService({
      libraryService: fixture.libraryService,
      sourceImports: {
        async cancelImport(jobId) {
          observations.push(['source', jobId, fixture.jobs.get(jobId)?.state]);
          fixture.jobs.cancel(jobId, cancelledAt, { runtimeOwner: 'confirmed_stopped' });
          return true;
        },
      },
      structure: {
        async cancelDetectionAndWait(jobId) {
          observations.push(['structure', jobId, fixture.jobs.get(jobId)?.state]);
          fixture.jobs.cancel(jobId, cancelledAt, { runtimeOwner: 'confirmed_stopped' });
          return true;
        },
      },
      now: () => cancelledAt,
    });

    expect(application.list().map(({ id }) => id)).toEqual([structureJobId, sourceJobId]);
    expect(application.list(bookId).map(({ id }) => id)).toEqual([structureJobId]);
    expect(application.get(structureJobId)).toMatchObject({
      id: structureJobId,
      type: 'structure_detection',
      checkpoints: [],
    });
    expect(application.get('missing-job' as JobId)).toBeNull();

    await expect(application.cancel(sourceJobId)).resolves.toMatchObject({
      id: sourceJobId,
      state: 'cancelled',
    });
    await expect(application.cancel(structureJobId)).resolves.toMatchObject({
      id: structureJobId,
      state: 'cancelled',
    });
    expect(observations).toEqual([
      ['source', sourceJobId, 'running'],
      ['structure', structureJobId, 'running'],
    ]);
    fixture.database.close();
  });

  it('cancels ownerless queued work but refuses running work without owner confirmation', async () => {
    const fixture = jobApplicationFixture({ transitionToRunning: false });
    const application = new JobApplicationService({
      libraryService: fixture.libraryService,
      sourceImports: { cancelImport: async () => false },
      structure: { cancelDetectionAndWait: async () => false },
      now: () => cancelledAt,
    });

    await expect(application.cancel(sourceJobId)).resolves.toMatchObject({ state: 'cancelled' });
    await expect(application.cancel(structureJobId)).rejects.toMatchObject({
      reason: 'runtime_owner_not_stopped',
    });
    expect(fixture.jobs.get(structureJobId)?.state).toBe('queued');
    fixture.jobs.transition(structureJobId, 'running', createdAt);
    await expect(application.cancel(structureJobId)).rejects.toMatchObject({
      reason: 'runtime_owner_not_stopped',
    });
    expect(fixture.jobs.get(structureJobId)?.state).toBe('running');
    fixture.database.close();
  });

  it('does not read or mutate a replacement Library after cancellation awaits its owner', async () => {
    const databaseA = openSqliteDatabase(':memory:');
    const databaseB = openSqliteDatabase(':memory:');
    runMigrations(databaseA, APP_MIGRATIONS);
    runMigrations(databaseB, APP_MIGRATIONS);
    seedSourceJob(databaseA);
    seedSourceJob(databaseB);
    const contextA = libraryContext(databaseA, 'session-a', 'library-a');
    const contextB = libraryContext(databaseB, 'session-b', 'library-b');
    let current: InternalLibrarySession | null = contextA;
    const unitOfWork = createLibraryUnitOfWork(() => current);
    const libraryService = {
      getCurrent: () => current
        ? { sessionId: current.sessionId, library: current.library }
        : null,
      getUnitOfWork: () => unitOfWork,
    } as LibraryService;
    let ownerStarted!: () => void;
    let releaseOwner!: () => void;
    const started = new Promise<void>((resolve) => { ownerStarted = resolve; });
    const ownerBarrier = new Promise<void>((resolve) => { releaseOwner = resolve; });
    const application = new JobApplicationService({
      libraryService,
      sourceImports: {
        async cancelImport() {
          ownerStarted();
          await ownerBarrier;
          return false;
        },
      },
      structure: { cancelDetectionAndWait: async () => false },
      now: () => cancelledAt,
    });

    const cancelling = application.cancel(sourceJobId);
    await started;
    current = contextB;
    releaseOwner();

    await expect(cancelling).rejects.toMatchObject({ code: 'LIBRARY_SESSION_CHANGED' });
    expect(new JobService({ database: databaseA }).get(sourceJobId)?.state).toBe('queued');
    expect(new JobService({ database: databaseB }).get(sourceJobId)?.state).toBe('queued');
    databaseA.close();
    databaseB.close();
  });
});

function jobApplicationFixture(options: { readonly transitionToRunning?: boolean } = {}) {
  const database = openSqliteDatabase(':memory:');
  runMigrations(database, APP_MIGRATIONS);
  database.prepare(`INSERT INTO books (id, title, created_at, updated_at)
    VALUES (?, 'Job Application Book', ?, ?)`).run(bookId, createdAt, createdAt);
  const context: InternalLibrarySession = {
    sessionId: 'session-job-app',
    rootPath: 'C:/job-app',
    manifestPath: 'C:/job-app/library.json',
    databasePath: ':memory:',
    database,
    library: {
      id: 'library-job-app' as LibraryId,
      name: 'Job Application',
      rootPath: 'C:/job-app',
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
  };
  const unitOfWork = createLibraryUnitOfWork(() => context);
  const libraryService = {
    getCurrent: () => ({ sessionId: context.sessionId, library: context.library }),
    getUnitOfWork: () => unitOfWork,
  } as LibraryService;
  const jobs = new JobService({ database });
  jobs.createQueued({
    id: sourceJobId,
    bookId: null,
    kind: 'source_import',
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { sourceTextId: 'source-job-app' },
    createdAt,
    updatedAt: createdAt,
  });
  jobs.createQueued({
    id: structureJobId,
    bookId,
    kind: 'structure_detection',
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: {
      title: 'Detect structure',
      sourceTextId: 'source-job-app',
      sourceTextEdition: 1,
      contentHash: 'sha256:job-app',
    },
    createdAt,
    updatedAt: '2026-07-16T06:01:00.000Z',
  });
  if (options.transitionToRunning !== false) {
    jobs.transition(sourceJobId, 'running', createdAt);
    jobs.transition(structureJobId, 'running', '2026-07-16T06:01:00.000Z');
  }
  return { database, libraryService, jobs };
}

function libraryContext(
  database: ReturnType<typeof openSqliteDatabase>,
  sessionId: string,
  libraryId: string,
): InternalLibrarySession {
  return {
    sessionId,
    rootPath: `C:/${libraryId}`,
    manifestPath: `C:/${libraryId}/library.json`,
    databasePath: ':memory:',
    database,
    library: {
      id: libraryId as LibraryId,
      name: libraryId,
      rootPath: `C:/${libraryId}`,
      schemaVersion: 5,
      appVersion: '0.1.0-test',
    },
  };
}

function seedSourceJob(database: ReturnType<typeof openSqliteDatabase>): void {
  new JobService({ database }).createQueued({
    id: sourceJobId,
    bookId: null,
    kind: 'source_import',
    totalUnits: 1,
    payloadSchemaVersion: 1,
    payload: { sourceTextId: 'source-job-app' },
    createdAt,
    updatedAt: createdAt,
  });
}
