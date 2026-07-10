import {
  PRODUCT_IPC_CHANNELS,
  type ContractRequest,
  type ContractResponse,
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
import {
  registerTypedIpcHandlers,
  type IpcMainLike,
  type TypedIpcHandler,
  type TypedIpcHandlerMap,
  type TypedIpcRouterOptions,
} from './typed-router';

type MaybePromise<T> = T | Promise<T>;

export type LibraryIpcDependencies = {
  readonly service: LibraryService;
  readonly selectCreateRoot: () => MaybePromise<CreateLibraryInput | null>;
  readonly selectOpenRoot: () => MaybePromise<string | null>;
};

export type ProductIpcRegistrationOptions = {
  readonly library?: LibraryIpcDependencies;
  readonly books?: {
    readonly list?: () => MaybePromise<ContractResponse<'books:list'>>;
    readonly clearPendingImports?: () => void;
    readonly importSource: (
      request: ContractRequest<'books:import-source'>,
    ) => MaybePromise<ContractResponse<'books:import-source'>>;
  };
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
    ...(options.library ? createLibraryProductHandlers(options.library, options.books?.clearPendingImports) : {}),
    ...(options.books ? createBookProductHandlers(options.books) : {}),
  };
}

function createLibraryProductHandlers(
  library: LibraryIpcDependencies,
  onLibrarySessionChanged?: () => void,
): TypedIpcHandlerMap {
  const createHandler: TypedIpcHandler<'library:create'> = async () => {
    const selection = await library.selectCreateRoot();

    try {
      const summary = selection ? library.service.create(selection) : null;
      if (summary) {
        onLibrarySessionChanged?.();
      }

      return {
        ok: true,
        data: summary,
      };
    } catch (error) {
      return libraryServiceErrorResponse('library:create', error);
    }
  };
  const openHandler: TypedIpcHandler<'library:open'> = async () => {
    const rootPath = await library.selectOpenRoot();

    try {
      const summary = rootPath ? library.service.open({ rootPath }) : null;
      if (summary) {
        onLibrarySessionChanged?.();
      }

      return {
        ok: true,
        data: summary,
      };
    } catch (error) {
      return libraryServiceErrorResponse('library:open', error);
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

function libraryServiceErrorResponse<TChannel extends 'library:create' | 'library:open'>(
  channel: TChannel,
  error: unknown,
): ContractResponse<TChannel> {
  if (!(error instanceof LibraryServiceErrorClass)) {
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
