import { randomUUID } from 'node:crypto';
import type {
  AnalysisModuleDefinition,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  JobId,
  StructureSetId,
} from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import { JobService } from '../jobs/job-service';
import type {
  StructureEditionChange,
  StructureEditionChangeContext,
  StructureEditionChangePort,
} from '../structure/structure-edition-change-port';
import {
  createAnalysisModuleInstanceId,
  type AnalysisModuleInstanceIdFactory,
} from './analysis-module-instance-id';
import { AnalysisModuleRepository } from './analysis-module-repository';

export type AnalysisModuleInstanceEditionChangeErrorReason =
  | 'book_scope_instances_incomplete'
  | 'book_scope_instance_source_mismatch';

export class AnalysisModuleInstanceEditionChangeError extends Error {
  constructor(readonly reason: AnalysisModuleInstanceEditionChangeErrorReason) {
    super(reason === 'book_scope_instances_incomplete'
      ? 'Book-scope analysis module instances do not match the current module contract.'
      : 'Existing book-scope instances do not reference the expected source structure snapshot.');
    this.name = 'AnalysisModuleInstanceEditionChangeError';
  }
}

export type AnalysisModuleInstanceEditionChangePortOptions = {
  readonly createInstanceId?: AnalysisModuleInstanceIdFactory;
  readonly createJobId?: () => JobId;
  readonly now?: () => string;
};

type PersistedBookScopeInstance = {
  readonly moduleId: string;
  readonly sourceStructureSetId: StructureSetId;
  readonly structureEdition: number;
};

export class AnalysisModuleInstanceEditionChangePort implements StructureEditionChangePort {
  private readonly createInstanceId: AnalysisModuleInstanceIdFactory;
  private readonly createJobId: () => JobId;
  private readonly now: () => string;

  constructor(options: AnalysisModuleInstanceEditionChangePortOptions = {}) {
    this.createInstanceId = options.createInstanceId ?? createAnalysisModuleInstanceId;
    this.createJobId = options.createJobId ?? (() => randomUUID() as JobId);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  apply(
    change: StructureEditionChange,
    context: StructureEditionChangeContext,
  ): undefined {
    const definitions = new AnalysisModuleRepository().list(context.database);
    const existing = listBookScopeInstances(context.database, change.bookId);

    if (change.previousStructureEdition === null) {
      if (existing.length === 0) {
        this.createInitialBookScopeInstancesWithJob(change, context.database, definitions);
        return undefined;
      }

      assertCompleteBookScopeInstances(existing, definitions);
      if (existing.some((instance) =>
        instance.sourceStructureSetId !== change.frozenSetId ||
        instance.structureEdition !== change.structureEdition)) {
        throw new AnalysisModuleInstanceEditionChangeError('book_scope_instance_source_mismatch');
      }
      return undefined;
    }

    assertCompleteBookScopeInstances(existing, definitions);
    if (existing.some((instance) => instance.structureEdition >= change.structureEdition)) {
      throw new AnalysisModuleInstanceEditionChangeError('book_scope_instance_source_mismatch');
    }
    context.database.prepare(`
      UPDATE analysis_module_instances
      SET status = ?, updated_at = ?
      WHERE book_id = ?
    `).run(
      change.directives.analysisModuleInstances.affectedStatus,
      this.now(),
      change.bookId,
    );
    return undefined;
  }

  private createInitialBookScopeInstancesWithJob(
    change: StructureEditionChange,
    database: SqliteDatabase,
    definitions: readonly AnalysisModuleDefinition[],
  ): void {
    database.transaction(() => {
      const insert = database.prepare(`
        INSERT INTO analysis_module_instances (
          id, book_id, module_id, scope_kind, book_scope_book_id,
          volume_node_id, chapter_node_id, story_segment_range_id,
          source_structure_set_id, structure_edition, analysis_revision,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, 'book', ?, NULL, NULL, NULL, ?, ?, 0,
          'not_generated', ?, ?)
      `);
      const instanceIds: AnalysisModuleInstanceId[] = [];

      for (const definition of definitions) {
        const identity = {
          bookId: change.bookId,
          moduleId: definition.id,
          scope: { kind: 'book' as const, bookId: change.bookId },
        };
        const instanceId = this.createInstanceId(identity);
        const timestamp = this.now();
        insert.run(
          instanceId,
          change.bookId,
          definition.id,
          change.bookId,
          change.frozenSetId,
          change.structureEdition,
          timestamp,
          timestamp,
        );
        instanceIds.push(instanceId);
      }

      const jobs = new JobService({ database });
      const jobId = this.createJobId();
      const timestamp = this.now();
      const payload = {
        title: 'Create analysis module shells' as const,
        structureSetId: change.frozenSetId,
        structureEdition: change.structureEdition,
        instanceIds,
      };
      jobs.createQueued({
        id: jobId,
        bookId: change.bookId,
        kind: 'analysis_module_shell_creation',
        totalUnits: instanceIds.length,
        payloadSchemaVersion: 1,
        payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      jobs.transition(jobId, 'running', timestamp);
      jobs.completeWithCheckpoint(jobId, {
        bookId: change.bookId,
        completedUnits: instanceIds.length,
        totalUnits: instanceIds.length,
        updatedAt: timestamp,
        checkpoint: {
          id: `${jobId}:completed`,
          kind: 'analysis_module_shell_creation_completed',
          payloadSchemaVersion: 1,
          payload,
          createdAt: timestamp,
        },
      });
    })();
  }
}

function listBookScopeInstances(
  database: SqliteDatabase,
  bookId: BreakdownBookId,
): PersistedBookScopeInstance[] {
  return database.prepare(`
    SELECT module_id AS moduleId,
      source_structure_set_id AS sourceStructureSetId,
      structure_edition AS structureEdition
    FROM analysis_module_instances
    WHERE book_id = ? AND scope_kind = 'book'
    ORDER BY module_id ASC
  `).all(bookId) as PersistedBookScopeInstance[];
}

function assertCompleteBookScopeInstances(
  instances: readonly PersistedBookScopeInstance[],
  definitions: readonly AnalysisModuleDefinition[],
): void {
  const actualModuleIds = [...instances].map(({ moduleId }) => moduleId).sort();
  const expectedModuleIds = definitions.map(({ id }) => String(id)).sort();
  if (
    actualModuleIds.length !== expectedModuleIds.length ||
    actualModuleIds.some((moduleId, index) => moduleId !== expectedModuleIds[index])
  ) {
    throw new AnalysisModuleInstanceEditionChangeError('book_scope_instances_incomplete');
  }
}
