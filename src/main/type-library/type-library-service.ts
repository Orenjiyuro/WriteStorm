import type {
  BookClassificationTarget,
  BookTypeBindingDetail,
  BookTypeBindingRead,
  BreakdownBookId,
  ContentFocusVersionReference,
  TypeDefinitionKind,
  TypeDefinitionVersionReference,
  TypeLibraryReleaseOptions,
} from '../../shared/domain';
import { CONTENT_FOCUS_BINDING_LIMIT } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import type { LibraryUnitOfWork } from '../library/library-unit-of-work';
import {
  TypeLibraryRepository,
  TypeLibraryRepositoryError,
} from './type-library-repository';

export type UpdateBookTypeBindingCommand = {
  readonly bookId: BreakdownBookId;
  readonly expectedRevision: number;
  readonly typeLibraryVersion: number;
  readonly mainType: TypeDefinitionVersionReference | null;
  readonly contentFocuses: readonly Omit<ContentFocusVersionReference, 'priority'>[];
};

export type TypeLibraryServiceErrorReason =
  | 'no_current_library'
  | 'book_not_found'
  | 'revision_conflict'
  | 'type_library_version_unavailable'
  | 'type_definition_version_unavailable'
  | 'type_kind_mismatch'
  | 'duplicate_content_focus'
  | 'too_many_content_focuses'
  | 'invalid_persisted_book_type_binding';

const ERROR_MESSAGES: Record<TypeLibraryServiceErrorReason, string> = {
  no_current_library: 'Open or create a library before using TypeLibrary.',
  book_not_found: 'The selected Book does not exist.',
  revision_conflict: 'The Book type binding changed before this update could commit.',
  type_library_version_unavailable: 'The selected TypeLibrary version is unavailable.',
  type_definition_version_unavailable: 'A selected type definition version is unavailable.',
  type_kind_mismatch: 'A selected type definition has the wrong kind.',
  duplicate_content_focus: 'ContentFocus selections must be unique.',
  too_many_content_focuses: `A Book can select at most ${CONTENT_FOCUS_BINDING_LIMIT} ContentFocus entries.`,
  invalid_persisted_book_type_binding: 'The persisted Book type binding is invalid.',
};

export class TypeLibraryServiceError extends Error {
  constructor(
    readonly reason: TypeLibraryServiceErrorReason,
    options?: ErrorOptions,
  ) {
    super(ERROR_MESSAGES[reason], options);
    this.name = 'TypeLibraryServiceError';
  }
}

export interface TypeLibraryLibraryPort {
  getCurrent(): unknown | null;
  getUnitOfWork(): LibraryUnitOfWork;
}

export class TypeLibraryBookBindingMutationPort {
  constructor(
    private readonly repository: TypeLibraryRepository = new TypeLibraryRepository(),
  ) {}

  updateInTransaction(
    database: SqliteDatabase,
    command: UpdateBookTypeBindingCommand,
    updatedAt: string,
  ): BookClassificationTarget {
    try {
      const current = this.repository.getBookBinding(database, command.bookId);
      if (!current) throw new TypeLibraryServiceError('book_not_found');
      if (current.revision !== command.expectedRevision) {
        throw new TypeLibraryServiceError('revision_conflict');
      }

      const release = this.repository.listReleaseOptions(database, command.typeLibraryVersion);
      this.validateSelections(database, release, current, command);
      return this.repository.replaceBookBinding(database, { ...command, updatedAt });
    } catch (error) {
      if (error instanceof TypeLibraryServiceError) throw error;
      if (error instanceof TypeLibraryRepositoryError) {
        throw new TypeLibraryServiceError(error.reason, { cause: error });
      }
      throw error;
    }
  }

  private validateSelections(
    database: SqliteDatabase,
    release: TypeLibraryReleaseOptions,
    current: BookTypeBindingRead,
    command: UpdateBookTypeBindingCommand,
  ): void {
    if (command.contentFocuses.length > CONTENT_FOCUS_BINDING_LIMIT) {
      throw new TypeLibraryServiceError('too_many_content_focuses');
    }

    const definitionIds = new Set<string>();
    const definitionVersionIds = new Set<string>();
    for (const focus of command.contentFocuses) {
      if (definitionIds.has(focus.typeDefinitionId) ||
        definitionVersionIds.has(focus.typeDefinitionVersionId)) {
        throw new TypeLibraryServiceError('duplicate_content_focus');
      }
      definitionIds.add(focus.typeDefinitionId);
      definitionVersionIds.add(focus.typeDefinitionVersionId);
    }

    if (command.mainType) {
      this.assertAvailableKind(
        database,
        release,
        command.mainType,
        'main_type',
        command.typeLibraryVersion === current.typeLibraryVersion ? current.mainType : null,
      );
    }
    for (const [index, focus] of command.contentFocuses.entries()) {
      this.assertAvailableKind(
        database,
        release,
        focus,
        'content_focus',
        command.typeLibraryVersion === current.typeLibraryVersion
          ? current.contentFocuses[index] ?? null
          : null,
      );
    }
  }

  private assertAvailableKind(
    database: SqliteDatabase,
    release: TypeLibraryReleaseOptions,
    reference: TypeDefinitionVersionReference,
    expectedKind: TypeDefinitionKind,
    retainedReference: TypeDefinitionVersionReference | null,
  ): void {
    const state = this.repository.getDefinitionVersionState(database, reference);
    if (state === null) {
      throw new TypeLibraryServiceError('type_definition_version_unavailable');
    }
    if (state.kind !== expectedKind) {
      throw new TypeLibraryServiceError('type_kind_mismatch');
    }
    if (state.archived) {
      if (!sameReference(reference, retainedReference)) {
        throw new TypeLibraryServiceError('type_definition_version_unavailable');
      }
      return;
    }
    const isReleased = release.options.some((option) =>
      option.kind === expectedKind &&
      option.typeDefinitionId === reference.typeDefinitionId &&
      option.typeDefinitionVersionId === reference.typeDefinitionVersionId);
    if (!isReleased) {
      throw new TypeLibraryServiceError('type_definition_version_unavailable');
    }
  }
}

export class TypeLibraryService {
  private readonly libraryService: TypeLibraryLibraryPort;
  private readonly repository: TypeLibraryRepository;
  private readonly mutations: TypeLibraryBookBindingMutationPort;
  private readonly now: () => string;

  constructor(options: {
    readonly libraryService: TypeLibraryLibraryPort;
    readonly repository?: TypeLibraryRepository;
    readonly mutationPort?: TypeLibraryBookBindingMutationPort;
    readonly now?: () => string;
  }) {
    this.libraryService = options.libraryService;
    this.repository = options.repository ?? new TypeLibraryRepository();
    this.mutations = options.mutationPort ?? new TypeLibraryBookBindingMutationPort(this.repository);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  listReleaseOptions(version?: number): TypeLibraryReleaseOptions {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().read((session) => {
      try {
        return this.repository.listReleaseOptions(session.database, version);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    });
  }

  getBookBinding(bookId: BreakdownBookId): BookTypeBindingRead | null {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().read((session) => {
      try {
        return this.repository.getBookBinding(session.database, bookId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    });
  }

  getBookBindingDetail(bookId: BreakdownBookId): BookTypeBindingDetail | null {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().read((session) => {
      try {
        return this.repository.getBookBindingDetail(session.database, bookId);
      } catch (error) {
        throw mapRepositoryError(error);
      }
    });
  }

  updateBookBinding(command: UpdateBookTypeBindingCommand): BookClassificationTarget {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().write((session) =>
      this.mutations.updateInTransaction(session.database, command, this.now()));
  }

  private requireCurrent(): void {
    if (!this.libraryService.getCurrent()) {
      throw new TypeLibraryServiceError('no_current_library');
    }
  }
}

function sameReference(
  left: TypeDefinitionVersionReference,
  right: TypeDefinitionVersionReference | null,
): boolean {
  return right !== null &&
    left.typeDefinitionId === right.typeDefinitionId &&
    left.typeDefinitionVersionId === right.typeDefinitionVersionId;
}

function mapRepositoryError(error: unknown): Error {
  if (error instanceof TypeLibraryRepositoryError) {
    return new TypeLibraryServiceError(error.reason, { cause: error });
  }
  return error instanceof Error ? error : new Error('Unknown TypeLibrary repository error.');
}
