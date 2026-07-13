import type { SourceTextFormat, SourceTextMetadata } from '../../shared/contracts';
import type { BreakdownBookId, SourceTextId } from '../../shared/domain';
import type { LibraryService } from '../library/library-service';
import {
  inspectSourceHealth,
  removeAutoRemovableSourceHealthIssues,
  type SourceHealthIssue,
} from './source-health';
import {
  assertSourceTextContentHash,
  buildCanonicalSourceTextRelativePath,
  buildSourceTextImportMetadata,
  type SourceTextImportMetadata,
} from './source-text-metadata';
import { SourceTextRepository, type PersistedSourceText } from './source-text-repository';

export class SourceTextService {
  private readonly libraryService: LibraryService;
  private readonly repository: SourceTextRepository;

  constructor(options: {
    readonly libraryService: LibraryService;
    readonly repository?: SourceTextRepository;
  }) {
    this.libraryService = options.libraryService;
    this.repository = options.repository ?? new SourceTextRepository();
  }

  get(sourceTextId: SourceTextId): SourceTextMetadata | null {
    return this.libraryService.getUnitOfWork().read((session) => {
      const row = this.repository.get(session.database, sourceTextId);
      return row ? toMetadata(row) : null;
    });
  }

  findByContentHash(contentHash: string): SourceTextMetadata | null {
    assertSourceTextContentHash(contentHash);
    return this.libraryService.getUnitOfWork().read((session) => {
      const row = this.repository.findByContentHash(session.database, contentHash);
      return row ? toMetadata(row) : null;
    });
  }

  getCurrentSourceFile(bookId: BreakdownBookId): {
    readonly sessionId: string;
    readonly libraryRootPath: string;
    readonly source: PersistedSourceText;
  } | null {
    return this.libraryService.getUnitOfWork().read((session) => {
      const source = this.repository.getCurrentForBook(session.database, bookId);
      return source ? {
        sessionId: session.sessionId,
        libraryRootPath: session.rootPath,
        source,
      } : null;
    });
  }

  isSessionCurrent(sessionId: string): boolean {
    return this.libraryService.getCurrent()?.sessionId === sessionId;
  }

  prepareImportMetadata(input: {
    readonly sourceTextId: SourceTextId;
    readonly bookId: BreakdownBookId;
    readonly originalFileName: string;
    readonly format: SourceTextFormat;
    readonly sizeBytes: number;
    readonly encoding: string;
    readonly contentHash: string;
    readonly importedAt: string;
  }): SourceTextImportMetadata {
    assertPositiveInteger(input.sizeBytes, 'Source text size bytes');
    assertSourceTextContentHash(input.contentHash);
    const relativePath = buildCanonicalSourceTextRelativePath(
      input.sourceTextId,
      input.originalFileName,
    );
    const fileName = relativePath.slice(relativePath.lastIndexOf('/') + 1);
    return this.libraryService.getUnitOfWork().read((session) => buildSourceTextImportMetadata({
      ...input,
      originalFileName: fileName,
      relativePath,
      sourceTextEdition: this.repository.nextEdition(session.database, input.bookId),
    }));
  }

  inspectHealth(options: { readonly staleStagingBefore: Date }): Promise<SourceHealthIssue[]> {
    const input = this.libraryService.getUnitOfWork().read((session) => ({
      libraryRootPath: session.rootPath,
      sourceTexts: this.repository.list(session.database),
      staleStagingBefore: options.staleStagingBefore,
    }));
    return inspectSourceHealth(input);
  }

  removeAutoRemovableHealthIssues(issues: readonly SourceHealthIssue[]): Promise<string[]> {
    const rootPath = this.libraryService.getUnitOfWork().read((session) => session.rootPath);
    return removeAutoRemovableSourceHealthIssues(rootPath, issues);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
}

function toMetadata(row: PersistedSourceText): SourceTextMetadata {
  return {
    id: row.id,
    bookId: row.bookId,
    fileName: row.fileName,
    format: row.format,
    sizeBytes: row.sizeBytes,
    encoding: row.encoding,
    contentHash: row.contentHash,
    sourceTextEdition: row.sourceTextEdition,
    importedAt: row.importedAt,
  };
}
