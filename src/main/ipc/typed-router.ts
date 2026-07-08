import { z } from 'zod';
import {
  getContract,
  PRODUCT_IPC_CHANNELS,
  type ContractRequest,
  type ContractResponse,
  type ProductIpcChannel,
} from '../../shared/contracts';
import {
  createDomainError,
  type DomainErrorCode,
  type DomainErrorDetails,
} from '../../shared/errors';
import { isTrustedSenderUrl as defaultIsTrustedSenderUrl } from '../security';

type MaybePromise<T> = T | Promise<T>;

export type IpcMainEventLike = {
  sender?: {
    id?: number;
  } | null;
  senderFrame?: {
    url?: string;
    routingId?: number;
    processId?: number;
  } | null;
};

export type IpcMainLike = {
  handle(
    channel: string,
    listener: (event: IpcMainEventLike, payload: unknown) => MaybePromise<unknown>,
  ): void;
};

export type TypedIpcHandlerContext<TChannel extends ProductIpcChannel> = {
  channel: TChannel;
  senderUrl: string;
  sender: IpcSenderIdentity;
};

export type TypedIpcHandler<TChannel extends ProductIpcChannel> = (
  request: ContractRequest<TChannel>,
  context: TypedIpcHandlerContext<TChannel>,
) => MaybePromise<ContractResponse<TChannel>>;

export type TypedIpcHandlerMap = Partial<{
  [TChannel in ProductIpcChannel]: TypedIpcHandler<TChannel>;
}>;

export type TypedIpcRouterOptions = {
  trustedDevServerOrigins?: ReadonlySet<string>;
  isTrustedSender?: (sender: IpcSenderIdentity) => boolean;
  isTrustedSenderUrl?: (senderUrl: string) => boolean;
};

export type IpcSenderIdentity = {
  url: string;
  webContentsId?: number;
  frameRoutingId?: number;
  frameProcessId?: number;
};

export function registerTypedIpcHandlers(
  ipcMain: IpcMainLike,
  handlers: TypedIpcHandlerMap,
  options: TypedIpcRouterOptions = {},
): void {
  for (const channel of PRODUCT_IPC_CHANNELS) {
    const handler = handlers[channel];

    if (handler) {
      registerTypedIpcHandler(
        ipcMain,
        channel,
        handler as TypedIpcHandler<typeof channel>,
        options,
      );
    }
  }
}

export function registerTypedIpcHandler<TChannel extends ProductIpcChannel>(
  ipcMain: IpcMainLike,
  channel: TChannel,
  handler: TypedIpcHandler<TChannel>,
  options: TypedIpcRouterOptions = {},
): void {
  const contract = getContract(channel);

  ipcMain.handle(channel, async (event, payload) => {
    const sender = resolveSenderIdentity(event);

    if (!isTrustedSender(sender, options)) {
      return createFailureResponse(channel, 'UNTRUSTED_IPC_SENDER', 'IPC sender is not trusted.', false, {
        senderUrl: sender.url,
      });
    }

    const requestResult = contract.request.safeParse(payload);

    if (!requestResult.success) {
      return createFailureResponse(
        channel,
        'INVALID_REQUEST',
        'IPC request did not match the channel contract.',
        true,
        zodErrorDetails(requestResult.error),
      );
    }

    try {
      const response = await handler(requestResult.data as ContractRequest<TChannel>, {
        channel,
        senderUrl: sender.url,
        sender,
      });
      const responseResult = contract.response.safeParse(response);

      if (!responseResult.success) {
        return createFailureResponse(
          channel,
          'INVALID_RESPONSE',
          'IPC response did not match the channel contract.',
          false,
          zodErrorDetails(responseResult.error),
        );
      }

      return responseResult.data;
    } catch (error) {
      return createFailureResponse(channel, 'INTERNAL_ERROR', 'IPC handler failed.', false);
    }
  });
}

function resolveSenderIdentity(event: IpcMainEventLike): IpcSenderIdentity {
  const identity: IpcSenderIdentity = {
    url: event.senderFrame?.url ?? '',
  };

  if (typeof event.sender?.id === 'number') {
    identity.webContentsId = event.sender.id;
  }

  if (typeof event.senderFrame?.routingId === 'number') {
    identity.frameRoutingId = event.senderFrame.routingId;
  }

  if (typeof event.senderFrame?.processId === 'number') {
    identity.frameProcessId = event.senderFrame.processId;
  }

  return identity;
}

function isTrustedSender(sender: IpcSenderIdentity, options: TypedIpcRouterOptions): boolean {
  if (options.isTrustedSender) {
    return options.isTrustedSender(sender);
  }

  if (options.isTrustedSenderUrl) {
    return options.isTrustedSenderUrl(sender.url);
  }

  return defaultIsTrustedSenderUrl(sender.url, options.trustedDevServerOrigins ?? new Set());
}

function createFailureResponse<TChannel extends ProductIpcChannel>(
  channel: TChannel,
  code: DomainErrorCode,
  message: string,
  recoverable: boolean,
  details: DomainErrorDetails = {},
): ContractResponse<TChannel> {
  const contract = getContract(channel);
  const response = {
    ok: false as const,
    error: createDomainError({
      code,
      message,
      recoverable,
      details: {
        channel,
        ...details,
      },
    }),
  };

  return contract.response.parse(response) as ContractResponse<TChannel>;
}

function zodErrorDetails(error: z.ZodError): DomainErrorDetails {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map(String),
    })),
  };
}
