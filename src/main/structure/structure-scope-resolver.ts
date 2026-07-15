import type { ScopeRef } from '../../shared/domain';
import type {
  BreakdownBookId,
  FrozenStructureSet,
  StructureNodeId,
  StorySegmentRangeId,
} from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import { StructureDraftRepository } from './persistence/structure-draft-repository';

export type ResolvedFrozenScope = {
  readonly scope: ScopeRef;
  readonly frozenSet: FrozenStructureSet;
  readonly target: FrozenStructureSet | FrozenStructureSet['nodes'][number] |
    FrozenStructureSet['storyRanges'][number];
};

export class StructureScopeResolutionError extends Error {
  constructor(readonly reason: 'scope_not_found' | 'scope_not_frozen' | 'scope_kind_mismatch' | 'scope_book_mismatch') {
    super(reason);
    this.name = 'StructureScopeResolutionError';
  }
}

export class StructureScopeResolver {
  constructor(private readonly libraryService: Pick<LibraryService, 'getUnitOfWork'>) {}

  resolve(scope: ScopeRef, expectedBookId?: BreakdownBookId): ResolvedFrozenScope {
    return this.libraryService.getUnitOfWork().read((session) => {
      const repository = new StructureDraftRepository(session.database);
      if (scope.kind === 'book') {
        const frozenSet = repository.getCurrentFrozen(scope.bookId);
        if (!frozenSet) throw new StructureScopeResolutionError('scope_not_frozen');
        this.assertBook(frozenSet, expectedBookId);
        return { scope, frozenSet, target: frozenSet };
      }
      const reference = scope.kind === 'story_segment_range'
        ? this.findRange(session.database, scope.rangeId)
        : this.findNode(session.database, scope.nodeId);
      if (!reference) throw new StructureScopeResolutionError('scope_not_found');
      const frozenSet = repository.getFrozenById(reference.structureSetId);
      if (!frozenSet) throw new StructureScopeResolutionError('scope_not_frozen');
      this.assertBook(frozenSet, expectedBookId);
      const target = scope.kind === 'story_segment_range'
        ? frozenSet.storyRanges.find(({ id }) => id === scope.rangeId)
        : frozenSet.nodes.find(({ id }) => id === scope.nodeId);
      if (!target) throw new StructureScopeResolutionError('scope_not_found');
      if (scope.kind !== 'story_segment_range' && 'kind' in target && target.kind !== scope.kind) {
        throw new StructureScopeResolutionError('scope_kind_mismatch');
      }
      return { scope, frozenSet, target };
    });
  }

  private findNode(database: import('../db/sqlite').SqliteDatabase, nodeId: StructureNodeId) {
    return database.prepare('SELECT structure_set_id AS structureSetId FROM structure_nodes WHERE id = ?')
      .get(nodeId) as { structureSetId: import('../../shared/domain').StructureSetId } | undefined;
  }

  private findRange(database: import('../db/sqlite').SqliteDatabase, rangeId: StorySegmentRangeId) {
    return database.prepare('SELECT structure_set_id AS structureSetId FROM story_segment_ranges WHERE id = ?')
      .get(rangeId) as { structureSetId: import('../../shared/domain').StructureSetId } | undefined;
  }

  private assertBook(set: FrozenStructureSet, expectedBookId?: BreakdownBookId): void {
    if (expectedBookId && set.bookId !== expectedBookId) {
      throw new StructureScopeResolutionError('scope_book_mismatch');
    }
  }
}
