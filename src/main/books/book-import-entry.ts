export const E2E_IMPORT_DIALOG_STUB_ENV = 'WRITESTORM_E2E_IMPORT_DIALOG_STUB';
export const E2E_IMPORT_SOURCE_PATH_ENV = 'WRITESTORM_E2E_IMPORT_SOURCE_PATH';

export type ImportFileDialogOptions = {
  readonly title: string;
  readonly buttonLabel: string;
  readonly properties: 'openFile'[];
  readonly filters: Array<{
    readonly name: string;
    readonly extensions: string[];
  }>;
};

export type ImportFileDialogResult = {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
};

export type ShowImportFileDialog = (
  options: ImportFileDialogOptions,
) => Promise<ImportFileDialogResult>;

export type SelectImportSourceFileOptions = {
  readonly env?: Record<string, string | undefined>;
  readonly showOpenDialog: ShowImportFileDialog;
};

export type PendingImportToken = {
  readonly pendingImportId: string;
  readonly expiresAt: number;
};

export type PendingImportRecord = {
  readonly libraryRootPath: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly title?: string;
  readonly jobId?: string;
  readonly sourceTextId?: string;
  readonly expiresAt: number;
};

export type PendingImportStoreOptions = {
  readonly createId: () => string;
  readonly now: () => number;
  readonly ttlMs: number;
};

export class PendingImportStore {
  private readonly createId: () => string;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly records = new Map<string, PendingImportRecord>();

  constructor(options: PendingImportStoreOptions) {
    this.createId = options.createId;
    this.now = options.now;
    this.ttlMs = options.ttlMs;
  }

  get size(): number {
    return this.records.size;
  }

  create(input: {
    readonly libraryRootPath: string;
    readonly sessionId: string;
    readonly sourcePath: string;
    readonly title?: string;
    readonly jobId?: string;
    readonly sourceTextId?: string;
  }): PendingImportToken {
    const pendingImportId = this.createId();
    const expiresAt = this.now() + this.ttlMs;

    this.records.set(pendingImportId, {
      libraryRootPath: input.libraryRootPath,
      sessionId: input.sessionId,
      sourcePath: input.sourcePath,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
      ...(input.sourceTextId === undefined ? {} : { sourceTextId: input.sourceTextId }),
      expiresAt,
    });

    return {
      pendingImportId,
      expiresAt,
    };
  }

  resolve(
    pendingImportId: string,
    options: {
      readonly libraryRootPath: string;
      readonly sessionId: string;
      readonly now: number;
    },
  ): PendingImportRecord | null {
    const record = this.records.get(pendingImportId);

    if (!record) {
      return null;
    }

    if (record.expiresAt <= options.now) {
      this.records.delete(pendingImportId);
      return null;
    }

    if (record.libraryRootPath !== options.libraryRootPath || record.sessionId !== options.sessionId) {
      return null;
    }

    return record;
  }

  take(
    pendingImportId: string,
    options: {
      readonly libraryRootPath: string;
      readonly sessionId: string;
      readonly now: number;
    },
  ): PendingImportRecord | null {
    const record = this.resolve(pendingImportId, options);
    if (record) this.records.delete(pendingImportId);
    return record;
  }

  clear(pendingImportId: string): void {
    this.records.delete(pendingImportId);
  }

  hasByJobId(
    jobId: string,
    options: {
      readonly libraryRootPath: string;
      readonly sessionId: string;
    },
  ): boolean {
    return [...this.records.values()].some((record) => (
      record.jobId === jobId &&
      record.libraryRootPath === options.libraryRootPath &&
      record.sessionId === options.sessionId
    ));
  }

  clearByJobId(
    jobId: string,
    options: {
      readonly libraryRootPath: string;
      readonly sessionId: string;
    },
  ): number {
    let cleared = 0;
    for (const [pendingImportId, record] of this.records) {
      if (
        record.jobId === jobId &&
        record.libraryRootPath === options.libraryRootPath &&
        record.sessionId === options.sessionId
      ) {
        this.records.delete(pendingImportId);
        cleared += 1;
      }
    }
    return cleared;
  }

  clearAll(): void {
    this.records.clear();
  }

  clearExpired(now: number): void {
    for (const [pendingImportId, record] of this.records) {
      if (record.expiresAt <= now) {
        this.records.delete(pendingImportId);
      }
    }
  }

  clearForLibrary(libraryRootPath: string): void {
    for (const [pendingImportId, record] of this.records) {
      if (record.libraryRootPath === libraryRootPath) {
        this.records.delete(pendingImportId);
      }
    }
  }
}

export async function selectImportSourceFile(
  options: SelectImportSourceFileOptions,
): Promise<string | null> {
  const env = options.env ?? process.env;
  const stubPath = resolveE2eStubSourcePath(env);

  if (stubPath) {
    return stubPath;
  }

  const result = await options.showOpenDialog({
    title: 'Import txt/md source',
    buttonLabel: 'Import source',
    properties: ['openFile'],
    filters: [
      {
        name: 'Text and Markdown',
        extensions: ['txt', 'md'],
      },
    ],
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

function resolveE2eStubSourcePath(env: Record<string, string | undefined>): string | null {
  if (env[E2E_IMPORT_DIALOG_STUB_ENV] !== '1') {
    return null;
  }

  const sourcePath = env[E2E_IMPORT_SOURCE_PATH_ENV]?.trim();

  if (!sourcePath) {
    throw new Error(`${E2E_IMPORT_SOURCE_PATH_ENV} is required when ${E2E_IMPORT_DIALOG_STUB_ENV}=1.`);
  }

  return sourcePath;
}
