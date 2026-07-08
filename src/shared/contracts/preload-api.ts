import type { ContractRequest, ContractResponse } from './registry';

export type InternalHealthResponse = {
  ok: true;
  app: 'WriteStorm';
};

export type WritestormApi = {
  internal: {
    health(): Promise<InternalHealthResponse>;
  };
  library: {
    create(): Promise<ContractResponse<'library:create'>>;
    open(): Promise<ContractResponse<'library:open'>>;
    getCurrent(): Promise<ContractResponse<'library:get-current'>>;
  };
  books: {
    list(): Promise<ContractResponse<'books:list'>>;
    importSource(request: ContractRequest<'books:import-source'>): Promise<ContractResponse<'books:import-source'>>;
  };
  structure: {
    get(request: ContractRequest<'structure:get'>): Promise<ContractResponse<'structure:get'>>;
    updateNode(request: ContractRequest<'structure:update-node'>): Promise<ContractResponse<'structure:update-node'>>;
    updateStoryRange(
      request: ContractRequest<'structure:update-story-range'>,
    ): Promise<ContractResponse<'structure:update-story-range'>>;
    freeze(request: ContractRequest<'structure:freeze'>): Promise<ContractResponse<'structure:freeze'>>;
  };
  modules: {
    listInstances(
      request: ContractRequest<'modules:list-instances'>,
    ): Promise<ContractResponse<'modules:list-instances'>>;
    updateBody(request: ContractRequest<'modules:update-body'>): Promise<ContractResponse<'modules:update-body'>>;
  };
  jobs: {
    list(request?: ContractRequest<'jobs:list'>): Promise<ContractResponse<'jobs:list'>>;
    get(request: ContractRequest<'jobs:get'>): Promise<ContractResponse<'jobs:get'>>;
    cancel(request: ContractRequest<'jobs:cancel'>): Promise<ContractResponse<'jobs:cancel'>>;
  };
  exports: {
    getStatus(request: ContractRequest<'exports:get-status'>): Promise<ContractResponse<'exports:get-status'>>;
  };
};
