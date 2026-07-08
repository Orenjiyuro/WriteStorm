import {
  PRODUCT_IPC_CHANNELS,
  type ContractResponse,
  type ProductIpcChannel,
} from '../../shared/contracts';
import { createNotImplementedError } from '../../shared/errors';
import {
  registerTypedIpcHandlers,
  type IpcMainLike,
  type TypedIpcHandlerMap,
  type TypedIpcRouterOptions,
} from './typed-router';

export function registerNotImplementedProductIpcHandlers(
  ipcMain: IpcMainLike,
  options: TypedIpcRouterOptions = {},
): void {
  registerTypedIpcHandlers(ipcMain, createNotImplementedProductHandlers(), options);
}

export function registerProductIpc(ipcMain: IpcMainLike, devServerUrl?: string): void {
  registerNotImplementedProductIpcHandlers(ipcMain, {
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

function notImplementedResponse<TChannel extends ProductIpcChannel>(
  channel: TChannel,
): ContractResponse<TChannel> {
  return {
    ok: false,
    error: createNotImplementedError(channel),
  } as ContractResponse<TChannel>;
}
