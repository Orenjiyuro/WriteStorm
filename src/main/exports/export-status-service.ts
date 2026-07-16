import type { ExportStatusDto } from '../../shared/contracts';
import {
  ANALYSIS_MODULE_ASSET_MATRIX,
  ANALYSIS_MODULE_DEPENDENCY_GRAPH,
  ANALYSIS_MODULE_KEYS,
  ANALYSIS_MODULE_SCOPE_MATRIX,
  evaluateModuleWorkspaceGate,
  type BreakdownBookId,
} from '../../shared/domain';
import type { LibraryUnitOfWork } from '../library/library-unit-of-work';
import {
  AnalysisModuleInstanceRepository,
} from '../modules/analysis-module-instance-repository';
import {
  AnalysisModuleRepository,
  AnalysisModuleRepositoryError,
} from '../modules/analysis-module-repository';
import { calculateExportStatus } from './export-status-calculator';
import {
  ExportStatusRepository,
  type ExportModuleFact,
} from './export-status-repository';

export type ExportStatusServiceErrorReason =
  | 'no_current_library'
  | 'book_not_found'
  | 'structure_snapshot_mismatch'
  | 'module_contract_unavailable'
  | 'book_scope_instances_incomplete';

export interface ExportStatusLibraryReadPort {
  getCurrent(): { readonly sessionId: string } | null;
  getUnitOfWork(): LibraryUnitOfWork;
}

const ERROR_MESSAGES: Record<ExportStatusServiceErrorReason, string> = {
  no_current_library: 'Open or create a library before reading export status.',
  book_not_found: 'Book was not found in the current library.',
  structure_snapshot_mismatch: 'The current frozen structure does not match the Book structure edition.',
  module_contract_unavailable: 'The persisted analysis module contract is unavailable.',
  book_scope_instances_incomplete: 'The seven book-scope module instances are incomplete.',
};

export class ExportStatusServiceError extends Error {
  constructor(
    readonly reason: ExportStatusServiceErrorReason,
    options?: { readonly cause?: unknown },
  ) {
    super(ERROR_MESSAGES[reason], options);
    this.name = 'ExportStatusServiceError';
  }
}

export class ExportStatusService {
  private readonly libraryService: ExportStatusLibraryReadPort;
  private readonly instances: AnalysisModuleInstanceRepository;
  private readonly modules: AnalysisModuleRepository;
  private readonly exports: ExportStatusRepository;

  constructor(options: {
    readonly libraryService: ExportStatusLibraryReadPort;
    readonly instanceRepository?: AnalysisModuleInstanceRepository;
    readonly moduleRepository?: AnalysisModuleRepository;
    readonly exportRepository?: ExportStatusRepository;
  }) {
    this.libraryService = options.libraryService;
    this.instances = options.instanceRepository ?? new AnalysisModuleInstanceRepository();
    this.modules = options.moduleRepository ?? new AnalysisModuleRepository();
    this.exports = options.exportRepository ?? new ExportStatusRepository();
  }

  getStatus(bookId: BreakdownBookId): ExportStatusDto {
    if (!this.libraryService.getCurrent()) {
      throw new ExportStatusServiceError('no_current_library');
    }

    return this.libraryService.getUnitOfWork().read((session) => {
      const prerequisites = this.instances.getPrerequisites(session.database, bookId);
      if (!prerequisites.book) {
        throw new ExportStatusServiceError('book_not_found');
      }
      if (prerequisites.structure.stage !== 'frozen') {
        return calculateExportStatus({
          bookId,
          structure: { status: 'not_frozen', structureEdition: null },
          moduleInstances: [],
        });
      }
      if (
        prerequisites.book.structureEdition === null ||
        prerequisites.structure.frozenSetId === null ||
        prerequisites.structure.structureEdition === null
      ) {
        throw new ExportStatusServiceError('structure_snapshot_mismatch');
      }

      let definitions;
      try {
        definitions = this.modules.list(session.database);
      } catch (error) {
        if (error instanceof AnalysisModuleRepositoryError) {
          throw new ExportStatusServiceError('module_contract_unavailable', { cause: error });
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
        throw gate.blocker === 'structure_snapshot_mismatch'
          ? new ExportStatusServiceError('structure_snapshot_mismatch')
          : new ExportStatusServiceError('module_contract_unavailable');
      }

      const moduleFacts = this.exports.listBookScopeModuleFacts(session.database, bookId);
      assertCompleteBookScopeModuleFacts(
        moduleFacts,
        definitions.map(({ id }) => String(id)),
      );

      return calculateExportStatus({
        bookId,
        structure: {
          status: 'frozen',
          structureEdition: gate.structureEdition,
        },
        moduleInstances: moduleFacts,
      });
    });
  }
}

function assertCompleteBookScopeModuleFacts(
  facts: readonly ExportModuleFact[],
  expectedModuleIds: readonly string[],
): void {
  if (
    facts.length !== expectedModuleIds.length ||
    facts.some(({ moduleId }, index) => String(moduleId) !== expectedModuleIds[index])
  ) {
    throw new ExportStatusServiceError('book_scope_instances_incomplete');
  }
}
