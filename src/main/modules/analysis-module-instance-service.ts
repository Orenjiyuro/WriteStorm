import type { ModuleInstanceSummary } from '../../shared/contracts';
import {
  ANALYSIS_MODULE_ASSET_MATRIX,
  ANALYSIS_MODULE_DEPENDENCY_GRAPH,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_SCOPE_MATRIX,
  evaluateModuleWorkspaceGate,
  type BreakdownBookId,
  type ModuleWorkspaceGateBlocker,
} from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import {
  AnalysisModuleInstanceRepository,
} from './analysis-module-instance-repository';
import {
  AnalysisModuleRepository,
  AnalysisModuleRepositoryError,
} from './analysis-module-repository';

export type AnalysisModuleInstanceServiceErrorReason =
  | 'no_current_library'
  | ModuleWorkspaceGateBlocker
  | 'book_scope_instances_incomplete';

const ERROR_MESSAGES: Record<AnalysisModuleInstanceServiceErrorReason, string> = {
  no_current_library: 'Open or create a library before reading analysis modules.',
  book_not_found: 'Book was not found in the current library.',
  structure_not_frozen: 'Freeze the current structure before opening analysis modules.',
  structure_snapshot_mismatch: 'The current frozen structure does not match the Book structure edition.',
  module_contract_unavailable: 'The persisted analysis module contract is unavailable.',
  book_scope_instances_incomplete: 'The seven book-scope module instances are incomplete.',
};

export class AnalysisModuleInstanceServiceError extends Error {
  constructor(
    readonly reason: AnalysisModuleInstanceServiceErrorReason,
    options?: { readonly cause?: unknown },
  ) {
    super(ERROR_MESSAGES[reason], options);
    this.name = 'AnalysisModuleInstanceServiceError';
  }
}

export class AnalysisModuleInstanceService {
  private readonly libraryService: LibraryService;
  private readonly instances: AnalysisModuleInstanceRepository;
  private readonly modules: AnalysisModuleRepository;

  constructor(options: {
    readonly libraryService: LibraryService;
    readonly instanceRepository?: AnalysisModuleInstanceRepository;
    readonly moduleRepository?: AnalysisModuleRepository;
  }) {
    this.libraryService = options.libraryService;
    this.instances = options.instanceRepository ?? new AnalysisModuleInstanceRepository();
    this.modules = options.moduleRepository ?? new AnalysisModuleRepository();
  }

  list(bookId: BreakdownBookId): ModuleInstanceSummary[] {
    if (!this.libraryService.getCurrent()) {
      throw new AnalysisModuleInstanceServiceError('no_current_library');
    }

    return this.libraryService.getUnitOfWork().read((session) => {
      const prerequisites = this.instances.getPrerequisites(session.database, bookId);
      if (!prerequisites.book) {
        throw new AnalysisModuleInstanceServiceError('book_not_found');
      }
      if (
        prerequisites.structure.stage !== 'frozen' ||
        prerequisites.structure.frozenSetId === null ||
        prerequisites.structure.structureEdition === null ||
        prerequisites.book.structureEdition === null
      ) {
        throw new AnalysisModuleInstanceServiceError('structure_not_frozen');
      }

      let definitions;
      try {
        definitions = this.modules.list(session.database);
      } catch (error) {
        if (error instanceof AnalysisModuleRepositoryError) {
          throw new AnalysisModuleInstanceServiceError('module_contract_unavailable', { cause: error });
        }
        throw error;
      }
      const gate = evaluateModuleWorkspaceGate({
        bookSnapshot: prerequisites.book,
        structureSnapshot: prerequisites.structure,
        moduleContractSnapshot: {
          moduleKeys: ANALYSIS_MODULE_KEYS,
          definitions,
          scopeMatrix: ANALYSIS_MODULE_SCOPE_MATRIX,
          assetMatrix: ANALYSIS_MODULE_ASSET_MATRIX,
          dependencyGraph: ANALYSIS_MODULE_DEPENDENCY_GRAPH,
        },
      });
      if (!gate.ready) {
        throw new AnalysisModuleInstanceServiceError(gate.blocker);
      }

      const instances = this.instances.listByBook(session.database, bookId);
      assertCompleteBookScopeInstances(instances, definitions.map(({ id }) => id));
      return instances;
    });
  }
}

function assertCompleteBookScopeInstances(
  instances: readonly ModuleInstanceSummary[],
  expectedModuleIds: readonly string[],
): void {
  const actualModuleIds = instances
    .filter(({ scope }) => scope.kind === 'book')
    .map(({ moduleId }) => String(moduleId));
  if (
    actualModuleIds.length !== expectedModuleIds.length ||
    actualModuleIds.some((moduleId, index) => moduleId !== String(expectedModuleIds[index]))
  ) {
    throw new AnalysisModuleInstanceServiceError('book_scope_instances_incomplete');
  }
}
