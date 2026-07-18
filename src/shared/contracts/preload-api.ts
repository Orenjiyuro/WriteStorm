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
  typeLibrary: {
    listOptions(
      request?: ContractRequest<'type-library:list-options'>,
    ): Promise<ContractResponse<'type-library:list-options'>>;
    getBookBinding(
      request: ContractRequest<'type-library:get-book-binding'>,
    ): Promise<ContractResponse<'type-library:get-book-binding'>>;
    updateBookBinding(
      request: ContractRequest<'type-library:update-book-binding'>,
    ): Promise<ContractResponse<'type-library:update-book-binding'>>;
  };
  structure: {
    get(request: ContractRequest<'structure:get'>): Promise<ContractResponse<'structure:get'>>;
    detect(request: ContractRequest<'structure:detect'>): Promise<ContractResponse<'structure:detect'>>;
    recoverDetection(request: ContractRequest<'structure:recover-detection'>): Promise<ContractResponse<'structure:recover-detection'>>;
    createDraft(request: ContractRequest<'structure:create-draft'>): Promise<ContractResponse<'structure:create-draft'>>;
    createManualDraft(request: ContractRequest<'structure:create-manual-draft'>): Promise<ContractResponse<'structure:create-manual-draft'>>;
    discardDraft(request: ContractRequest<'structure:discard-draft'>): Promise<ContractResponse<'structure:discard-draft'>>;
    updateNode(request: ContractRequest<'structure:update-node'>): Promise<ContractResponse<'structure:update-node'>>;
    updateStoryRange(
      request: ContractRequest<'structure:update-story-range'>,
    ): Promise<ContractResponse<'structure:update-story-range'>>;
    freeze(request: ContractRequest<'structure:freeze'>): Promise<ContractResponse<'structure:freeze'>>;
    unfreeze(request: ContractRequest<'structure:unfreeze'>): Promise<ContractResponse<'structure:unfreeze'>>;
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
