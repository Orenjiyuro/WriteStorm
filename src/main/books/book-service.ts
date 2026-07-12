import type { BookSummary } from '../../shared/contracts';
import type { BreakdownBookId } from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import { BookRepository, type PersistedBookRow } from './book-repository';

export type BookServiceErrorReason = 'no_current_library';

export class BookServiceError extends Error {
  readonly reason: BookServiceErrorReason;

  constructor(reason: BookServiceErrorReason) {
    super('Open or create a library before reading books.');
    this.name = 'BookServiceError';
    this.reason = reason;
  }
}

export class BookService {
  private readonly libraryService: LibraryService;
  private readonly repository: BookRepository;

  constructor(options: {
    readonly libraryService: LibraryService;
    readonly repository?: BookRepository;
  }) {
    this.libraryService = options.libraryService;
    this.repository = options.repository ?? new BookRepository();
  }

  list(): BookSummary[] {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().read((session) =>
      this.repository.list(session.database).map((row) => mapBook(row, session.library.id)));
  }

  get(bookId: BreakdownBookId): BookSummary | null {
    this.requireCurrent();
    return this.libraryService.getUnitOfWork().read((session) => {
      const row = this.repository.get(session.database, bookId);
      return row ? mapBook(row, session.library.id) : null;
    });
  }

  private requireCurrent(): void {
    if (!this.libraryService.getCurrent()) throw new BookServiceError('no_current_library');
  }
}

function mapBook(
  row: PersistedBookRow,
  libraryId: BookSummary['libraryId'],
): BookSummary {
  return {
    id: row.id,
    libraryId,
    title: row.title,
    sourceTextId: row.sourceTextId,
    sourceTextEdition: row.sourceTextEdition,
    structureEdition: null,
    updatedAt: row.updatedAt,
  };
}
