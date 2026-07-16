import {
  PRODUCT_IPC_CHANNELS,
  type ContractRequest,
  type ContractResponse,
  type LibrarySessionSummary,
  type ProductIpcChannel,
} from '../../shared/contracts';
import {
  createDomainError,
  createNotImplementedError,
} from '../../shared/errors';
import type {
  CreateLibraryInput,
  LibraryServiceError,
  LibraryService,
} from '../library/library-service';
import { LibraryServiceError as LibraryServiceErrorClass } from '../library/library-service';
import type { StructureDetectionIpcDependencies } from '../structure/structure-detection-ipc';
import type { StructureReviewIpcDependencies } from '../structure/structure-review-ipc';
import type { AnalysisModuleInstanceIpcDependencies } from '../modules/analysis-module-instance-ipc';
import type { JobIpcDependencies } from '../jobs/job-ipc';
import type { ExportStatusIpcDependencies } from '../exports/export-status-ipc';
import {
  registerTypedIpcHandlers,
  type IpcMainLike,
  type IpcSenderIdentity,
  type TypedIpcHandler,
  type TypedIpcHandlerMap,
  type TypedIpcRouterOptions,
} from './typed-router';

type MaybePromise<T> = T | Promise<T>;

export type SuccessfulLibrarySessionActivation = {
  readonly previousSessionId: string | null;
  readonly session: LibrarySessionSummary;
};

type LibrarySessionActivationErrorReason =
  | 'library_activation_mismatch'
  | 'restart_recovery_failed';

class LibrarySessionActivationError extends Error {
  constructor(readonly reason: LibrarySessionActivationErrorReason, options?: { readonly cause?: unknown }) {
    super(reason === 'library_activation_mismatch'
      ? 'The Library service did not publish the returned session.'
      : 'The Library opened, but restart recovery could not complete.', options);
    this.name = 'LibrarySessionActivationError';
  }
}

export type LibraryIpcDependencies = {
  readonly service: LibraryService;
  readonly selectCreateRoot: () => MaybePromise<CreateLibraryInput | null>;
  readonly selectOpenRoot: () => MaybePromise<string | null>;
};

export type ProductIpcRegistrationOptions = {
  readonly senderPolicy?: (sender: IpcSenderIdentity) => boolean;
  readonly beforeLibrarySessionChange?: () => MaybePromise<void>;
  readonly afterLibrarySessionChange?: () => MaybePromise<void>;
  readonly afterLibrarySessionActivated?: (
    activation: SuccessfulLibrarySessionActivation,
  ) => MaybePromise<void>;
  readonly library?: LibraryIpcDependencies;
  readonly books?: {
    readonly list?: () => MaybePromise<ContractResponse<'books:list'>>;
    readonly clearPendingImports?: () => void;
    readonly importSource: (
      request: ContractRequest<'books:import-source'>,
    ) => MaybePromise<ContractResponse<'books:import-source'>>;
  };
  readonly structure?: StructureDetectionIpcDependencies & StructureReviewIpcDependencies;
  readonly modules?: AnalysisModuleInstanceIpcDependencies;
  readonly jobs?: JobIpcDependencies;
  readonly exports?: ExportStatusIpcDependencies;
};

export function registerNotImplementedProductIpcHandlers(
  ipcMain: IpcMainLike,
  options: TypedIpcRouterOptions = {},
): void {
  registerTypedIpcHandlers(ipcMain, createNotImplementedProductHandlers(), options);
}

export function registerProductIpc(
  ipcMain: IpcMainLike,
  devServerUrl?: string,
  options: ProductIpcRegistrationOptions = {},
): void {
  registerTypedIpcHandlers(ipcMain, createProductHandlers(options), {
    trustedDevServerOrigins: createTrustedDevServerOrigins(devServerUrl),
    ...(options.senderPolicy ? { isTrustedSender: options.senderPolicy } : {}),
  });
}

export function createTrustedDevServerOrigins(devServerUrl?: string): Set<string> {
  return devServerUrl ? new Set([new URL(devServerUrl).origin]) : new Set<string>();
}

function createNotImplementedProductHandlers(): TypedIpcHandlerMap {
  return Object.fromEntries(
    PRODUCT_IPC_CHANNELS.map((channel) => [
      channel,
      () => notImplementedResponse(channel),
    ]),
  ) as TypedIpcHandlerMap;
}

function createProductHandlers(options: ProductIpcRegistrationOptions): TypedIpcHandlerMap {
  return {
    ...createNotImplementedProductHandlers(),
    ...(options.library ? createLibraryProductHandlers(
      options.library,
      options.beforeLibrarySessionChange,
      options.afterLibrarySessionChange,
      options.afterLibrarySessionActivated,
      options.books?.clearPendingImports,
    ) : {}),
    ...(options.books ? createBookProductHandlers(options.books) : {}),
    ...(options.structure ? createStructureProductHandlers(options.structure) : {}),
    ...(options.modules ? createModuleProductHandlers(options.modules) : {}),
    ...(options.jobs ? createJobProductHandlers(options.jobs) : {}),
    ...(options.exports ? createExportProductHandlers(options.exports) : {}),
  };
}

function createExportProductHandlers(
  exports: ExportStatusIpcDependencies,
): TypedIpcHandlerMap {
  return {
    'exports:get-status': (request) => exports['exports:get-status'](request),
  };
}

function createJobProductHandlers(jobs: JobIpcDependencies): TypedIpcHandlerMap {
  return {
    'jobs:list': (request) => jobs['jobs:list'](request),
    'jobs:get': (request) => jobs['jobs:get'](request),
    'jobs:cancel': (request) => jobs['jobs:cancel'](request),
  };
}

function createModuleProductHandlers(
  modules: AnalysisModuleInstanceIpcDependencies,
): TypedIpcHandlerMap {
  return {
    'modules:list-instances': (request) => modules['modules:list-instances'](request),
  };
}

function createLibraryProductHandlers(
  library: LibraryIpcDependencies,
  beforeLibrarySessionChange?: () => MaybePromise<void>,
  afterLibrarySessionChange?: () => MaybePromise<void>,
  afterLibrarySessionActivated?: (
    activation: SuccessfulLibrarySessionActivation,
  ) => MaybePromise<void>,
  onLibrarySessionChanged?: () => void,
): TypedIpcHandlerMap {
  const createHandler: TypedIpcHandler<'library:create'> = async () => {
    const selection = await library.selectCreateRoot();

    try {
      if (selection) {
        const previousSessionId = library.service.getCurrent()?.sessionId ?? null;
        await beforeLibrarySessionChange?.();
        const summary = library.service.create(selection);
        await completeLibraryActivation({
          library,
          previousSessionId,
          summary,
          afterLibrarySessionActivated,
          onLibrarySessionChanged,
        });
        return { ok: true, data: summary };
      }
      return { ok: true, data: null };
    } catch (error) {
      return libraryServiceErrorResponse('library:create', error);
    } finally {
      if (selection) await afterLibrarySessionChange?.();
    }
  };
  const openHandler: TypedIpcHandler<'library:open'> = async () => {
    const rootPath = await library.selectOpenRoot();

    try {
      if (rootPath) {
        const previousSessionId = library.service.getCurrent()?.sessionId ?? null;
        await beforeLibrarySessionChange?.();
        const summary = await library.service.open({ rootPath });
        await completeLibraryActivation({
          library,
          previousSessionId,
          summary,
          afterLibrarySessionActivated,
          onLibrarySessionChanged,
        });
        return { ok: true, data: summary };
      }
      return { ok: true, data: null };
    } catch (error) {
      return libraryServiceErrorResponse('library:open', error);
    } finally {
      if (rootPath) await afterLibrarySessionChange?.();
    }
  };
  const getCurrentHandler: TypedIpcHandler<'library:get-current'> = () => ({
    ok: true,
    data: library.service.getCurrent(),
  });

  return {
    'library:create': createHandler,
    'library:open': openHandler,
    'library:get-current': getCurrentHandler,
  };
}

async function completeLibraryActivation(input: {
  readonly library: LibraryIpcDependencies;
  readonly previousSessionId: string | null;
  readonly summary: LibrarySessionSummary;
  readonly afterLibrarySessionActivated?: (
    activation: SuccessfulLibrarySessionActivation,
  ) => MaybePromise<void>;
  readonly onLibrarySessionChanged?: () => void;
}): Promise<void> {
  const current = input.library.service.getCurrent();
  if (
    !current ||
    current.sessionId !== input.summary.sessionId ||
    input.summary.sessionId === input.previousSessionId
  ) {
    throw new LibrarySessionActivationError('library_activation_mismatch');
  }

  input.onLibrarySessionChanged?.();
  try {
    await input.afterLibrarySessionActivated?.({
      previousSessionId: input.previousSessionId,
      session: input.summary,
    });
  } catch (error) {
    if (input.library.service.getCurrent()?.sessionId === input.summary.sessionId) {
      input.library.service.closeCurrent();
    }
    throw new LibrarySessionActivationError('restart_recovery_failed', { cause: error });
  }
}

function createBookProductHandlers(
  books: NonNullable<ProductIpcRegistrationOptions['books']>,
): TypedIpcHandlerMap {
  const listHandler: TypedIpcHandler<'books:list'> = books.list
    ? () => books.list!()
    : () => notImplementedResponse('books:list');
  const importSourceHandler: TypedIpcHandler<'books:import-source'> = (request) => books.importSource(request);

  return {
    'books:list': listHandler,
    'books:import-source': importSourceHandler,
  };
}

function createStructureProductHandlers(
  structure: StructureDetectionIpcDependencies & StructureReviewIpcDependencies,
): TypedIpcHandlerMap {
  const detectHandler: TypedIpcHandler<'structure:detect'> = (request) => structure.detect(request);

  return {
    'structure:get': (request) => structure['structure:get'](request),
    'structure:detect': detectHandler,
    'structure:recover-detection': (request) => structure.recoverDetection(request),
    'structure:create-draft': (request) => structure['structure:create-draft'](request),
    'structure:create-manual-draft': (request) => structure['structure:create-manual-draft'](request),
    'structure:discard-draft': (request) => structure['structure:discard-draft'](request),
    'structure:update-node': (request) => structure['structure:update-node'](request),
    'structure:update-story-range': (request) => structure['structure:update-story-range'](request),
    'structure:freeze': (request) => structure['structure:freeze'](request),
    'structure:unfreeze': (request) => structure['structure:unfreeze'](request),
  };
}

function libraryServiceErrorResponse<TChannel extends 'library:create' | 'library:open'>(
  channel: TChannel,
  error: unknown,
): ContractResponse<TChannel> {
  if (!(error instanceof LibraryServiceErrorClass)) {
    if (error instanceof LibrarySessionActivationError) {
      return {
        ok: false,
        error: createDomainError({
          code: 'LIBRARY_ERROR',
          message: error.message,
          recoverable: true,
          details: { channel, reason: error.reason },
        }),
      } as ContractResponse<TChannel>;
    }
    throw error;
  }

  return {
    ok: false,
    error: createDomainError({
      code: 'LIBRARY_ERROR',
      message: error.message,
      recoverable: error.recoverable,
      details: {
        channel,
        reason: (error as LibraryServiceError).reason,
      },
    }),
  } as ContractResponse<TChannel>;
}

function notImplementedResponse<TChannel extends ProductIpcChannel>(
  channel: TChannel,
): ContractResponse<TChannel> {
  return {
    ok: false,
    error: createNotImplementedError(channel),
  } as ContractResponse<TChannel>;
}
