import type {
  ContractRequest,
  ContractResponse,
  InternalHealthResponse,
  ProductIpcChannel,
  WritestormApi,
} from '../shared/contracts';

export type WritestormIpcInvoke = (
  channel: ProductIpcChannel | 'internal:health',
  request: unknown,
) => Promise<unknown>;

export function createWritestormPreloadApi(invoke: WritestormIpcInvoke): WritestormApi {
  const productInvoke = <TChannel extends ProductIpcChannel>(
    channel: TChannel,
    request: ContractRequest<TChannel>,
  ): Promise<ContractResponse<TChannel>> => {
    return invoke(channel, request) as Promise<ContractResponse<TChannel>>;
  };
  const emptyRequest = <TChannel extends ProductIpcChannel>(): ContractRequest<TChannel> => {
    return {} as ContractRequest<TChannel>;
  };

  return {
    internal: {
      health: () => invoke('internal:health', {}) as Promise<InternalHealthResponse>,
    },
    library: {
      create: () => productInvoke('library:create', emptyRequest<'library:create'>()),
      open: () => productInvoke('library:open', emptyRequest<'library:open'>()),
      getCurrent: () => productInvoke('library:get-current', emptyRequest<'library:get-current'>()),
    },
    books: {
      list: () => productInvoke('books:list', emptyRequest<'books:list'>()),
      importSource: (request) => productInvoke('books:import-source', request),
    },
    structure: {
      get: (request) => productInvoke('structure:get', request),
      detect: (request) => productInvoke('structure:detect', request),
      updateNode: (request) => productInvoke('structure:update-node', request),
      updateStoryRange: (request) => productInvoke('structure:update-story-range', request),
      freeze: (request) => productInvoke('structure:freeze', request),
    },
    modules: {
      listInstances: (request) => productInvoke('modules:list-instances', request),
      updateBody: (request) => productInvoke('modules:update-body', request),
    },
    jobs: {
      list: (request = emptyRequest<'jobs:list'>()) => productInvoke('jobs:list', request),
      get: (request) => productInvoke('jobs:get', request),
      cancel: (request) => productInvoke('jobs:cancel', request),
    },
    exports: {
      getStatus: (request) => productInvoke('exports:get-status', request),
    },
  };
}
