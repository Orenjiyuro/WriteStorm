import { z } from 'zod';
import { contractResponseSchema, emptyRequestSchema } from './common';
import { bookRequestSchema, bookSummarySchema, optionalBookRequestSchema } from './books';
import { exportStatusSchema } from './exports';
import { importSourceRequestSchema, importSourceResponseSchema } from './source-import';
import { jobRequestSchema, jobSummarySchema } from './jobs';
import { librarySessionSummarySchema } from './library';
import { moduleInstanceSummarySchema, updateModuleBodyRequestSchema } from './modules';
import {
  freezeStructureResponseDataSchema,
  storySegmentRangeSchema,
  structureDetectionRequestSchema,
  structureDetectionResponseSchema,
  structureNodeSchema,
  structureWorkspaceSchema,
  updateStorySegmentRangeRequestSchema,
  updateStructureNodeRequestSchema,
} from './structure';
import type { ProductIpcChannel } from './channels';

export type IpcContract<
  TChannel extends ProductIpcChannel,
  TRequest extends z.ZodTypeAny,
  TResponse extends z.ZodTypeAny,
> = {
  channel: TChannel;
  request: TRequest;
  response: TResponse;
};

function createContract<
  TChannel extends ProductIpcChannel,
  TRequest extends z.ZodTypeAny,
  TResponse extends z.ZodTypeAny,
>(
  channel: TChannel,
  request: TRequest,
  response: TResponse,
): IpcContract<TChannel, TRequest, TResponse> {
  return {
    channel,
    request,
    response,
  };
}

export const CONTRACT_REGISTRY = {
  'library:create': createContract(
    'library:create',
    emptyRequestSchema,
    contractResponseSchema(librarySessionSummarySchema.nullable()),
  ),
  'library:open': createContract(
    'library:open',
    emptyRequestSchema,
    contractResponseSchema(librarySessionSummarySchema.nullable()),
  ),
  'library:get-current': createContract(
    'library:get-current',
    emptyRequestSchema,
    contractResponseSchema(librarySessionSummarySchema.nullable()),
  ),
  'books:list': createContract(
    'books:list',
    emptyRequestSchema,
    contractResponseSchema(z.array(bookSummarySchema)),
  ),
  'books:import-source': createContract(
    'books:import-source',
    importSourceRequestSchema,
    importSourceResponseSchema,
  ),
  'structure:get': createContract(
    'structure:get',
    bookRequestSchema,
    contractResponseSchema(structureWorkspaceSchema),
  ),
  'structure:detect': createContract(
    'structure:detect',
    structureDetectionRequestSchema,
    structureDetectionResponseSchema,
  ),
  'structure:update-node': createContract(
    'structure:update-node',
    updateStructureNodeRequestSchema,
    contractResponseSchema(structureNodeSchema),
  ),
  'structure:update-story-range': createContract(
    'structure:update-story-range',
    updateStorySegmentRangeRequestSchema,
    contractResponseSchema(storySegmentRangeSchema),
  ),
  'structure:freeze': createContract(
    'structure:freeze',
    bookRequestSchema,
    contractResponseSchema(freezeStructureResponseDataSchema),
  ),
  'modules:list-instances': createContract(
    'modules:list-instances',
    bookRequestSchema,
    contractResponseSchema(z.array(moduleInstanceSummarySchema)),
  ),
  'modules:update-body': createContract(
    'modules:update-body',
    updateModuleBodyRequestSchema,
    contractResponseSchema(moduleInstanceSummarySchema),
  ),
  'jobs:list': createContract(
    'jobs:list',
    optionalBookRequestSchema,
    contractResponseSchema(z.array(jobSummarySchema)),
  ),
  'jobs:get': createContract(
    'jobs:get',
    jobRequestSchema,
    contractResponseSchema(jobSummarySchema.nullable()),
  ),
  'jobs:cancel': createContract(
    'jobs:cancel',
    jobRequestSchema,
    contractResponseSchema(jobSummarySchema),
  ),
  'exports:get-status': createContract(
    'exports:get-status',
    bookRequestSchema,
    contractResponseSchema(exportStatusSchema),
  ),
} as const satisfies {
  [TChannel in ProductIpcChannel]: IpcContract<TChannel, z.ZodTypeAny, z.ZodTypeAny>;
};

export function getContract<TChannel extends ProductIpcChannel>(
  channel: TChannel,
): (typeof CONTRACT_REGISTRY)[TChannel] {
  return CONTRACT_REGISTRY[channel];
}

export type ContractRequest<TChannel extends ProductIpcChannel> = z.infer<
  (typeof CONTRACT_REGISTRY)[TChannel]['request']
>;

export type ContractResponse<TChannel extends ProductIpcChannel> = z.infer<
  (typeof CONTRACT_REGISTRY)[TChannel]['response']
>;
