import type { SqliteDatabase } from '../db/sqlite';
import type {
  BreakdownBookId,
  ModuleInstanceStatus,
  PerspectiveInstanceStatus,
  ReviewAssetStatus,
  StructureSetId,
} from '../../shared/domain';

export type StructureEditionChange = {
  readonly bookId: BreakdownBookId;
  readonly frozenSetId: StructureSetId;
  readonly previousStructureEdition: number | null;
  readonly structureEdition: number;
  readonly directives: {
    readonly analysisModuleInstances: {
      readonly affectedStatus: Extract<ModuleInstanceStatus, 'needs_rebuild'>;
    };
    readonly evidence: {
      readonly affectedStatus: Extract<ReviewAssetStatus, 'stale'>;
    };
    readonly perspectives: {
      readonly affectedStatus: Extract<PerspectiveInstanceStatus, 'needs_refresh'>;
    };
    readonly completionGate: {
      readonly action: 'invalidate_for_future_owner';
      readonly persisted: false;
    };
  };
};

export type StructureEditionChangeContext = {
  readonly database: SqliteDatabase;
};

/**
 * Synchronous, DB-only transaction seam. Implementations must not start workers,
 * perform I/O, or return a Promise. Throwing rolls back the complete freeze UoW.
 */
export type StructureEditionChangePort = {
  apply(change: StructureEditionChange, context: StructureEditionChangeContext): undefined;
};

export const NOOP_STRUCTURE_EDITION_CHANGE_PORT: StructureEditionChangePort = {
  apply: () => undefined,
};

export function createStructureEditionChange(input: Omit<StructureEditionChange, 'directives'>): StructureEditionChange {
  return {
    ...input,
    directives: {
      analysisModuleInstances: { affectedStatus: 'needs_rebuild' },
      evidence: { affectedStatus: 'stale' },
      perspectives: { affectedStatus: 'needs_refresh' },
      completionGate: { action: 'invalidate_for_future_owner', persisted: false },
    },
  };
}
