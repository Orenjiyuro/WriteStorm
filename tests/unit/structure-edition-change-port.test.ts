import { describe, expect, it } from 'vitest';
import {
  NOOP_STRUCTURE_EDITION_CHANGE_PORT,
  type StructureEditionChangePort,
} from '../../src/main/structure/structure-edition-change-port';
import type { BreakdownBookId, StructureSetId } from '../../src/shared/domain';

describe('StructureEditionChangePort', () => {
  it('defines synchronous downstream invalidation directives without claiming CompletionGate persistence', () => {
    const change = {
      bookId: 'book-1' as BreakdownBookId,
      frozenSetId: 'frozen-1' as StructureSetId,
      previousStructureEdition: null,
      structureEdition: 1,
      directives: {
        analysisModuleInstances: { affectedStatus: 'needs_rebuild' },
        evidence: { affectedStatus: 'stale' },
        perspectives: { affectedStatus: 'needs_refresh' },
        completionGate: { action: 'invalidate_for_future_owner', persisted: false },
      },
    } as const;

    expect(NOOP_STRUCTURE_EDITION_CHANGE_PORT.apply(change, { database: {} as never })).toBeUndefined();
  });

  it('rejects Promise-returning ports at the type boundary', () => {
    const invalidPort = {
      // @ts-expect-error Structure edition invalidation must be synchronous and DB-only.
      async apply() {},
    } satisfies StructureEditionChangePort;
    expect(invalidPort).toBeDefined();
  });
});
