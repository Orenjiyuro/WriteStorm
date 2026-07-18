import { describe, expect, it } from 'vitest';
import { createWritestormPreloadApi } from '../../src/preload/writestorm-api';
import {
  PRODUCT_IPC_CHANNELS,
  type ContractRequest,
  type ProductIpcChannel,
} from '../../src/shared/contracts';
import { createNotImplementedError } from '../../src/shared/errors';
import type {
  AnalysisModuleInstanceId,
  BreakdownBookId,
  JobId,
  StorySegmentRangeId,
  StructureNodeId,
  StructureSetId,
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const nodeId = 'node-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const instanceId = 'instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;
const setId = 'set-1' as StructureSetId;

describe('preload WriteStorm API', () => {
  it('exposes narrow grouped namespaces without raw IPC escape hatches', () => {
    const api = createWritestormPreloadApi(async (channel) => {
      if (channel === 'internal:health') {
        return { ok: true, app: 'WriteStorm' };
      }

      return {
        ok: false,
        error: createNotImplementedError(channel),
      };
    });

    expect(Object.keys(api)).toEqual([
      'internal',
      'library',
      'books',
      'typeLibrary',
      'structure',
      'modules',
      'jobs',
      'exports',
    ]);
    expect(Object.keys(api.internal)).toEqual(['health']);
    expect(Object.keys(api.library)).toEqual(['create', 'open', 'getCurrent']);
    expect(Object.keys(api.books)).toEqual(['list', 'importSource']);
    expect(Object.keys(api.typeLibrary)).toEqual([
      'listOptions',
      'getBookBinding',
      'updateBookBinding',
    ]);
    expect(Object.keys(api.structure)).toEqual([
      'get',
      'detect',
      'recoverDetection',
      'createDraft',
      'createManualDraft',
      'discardDraft',
      'updateNode',
      'updateStoryRange',
      'freeze',
      'unfreeze',
    ]);
    expect(Object.keys(api.modules)).toEqual(['listInstances', 'updateBody']);
    expect(Object.keys(api.jobs)).toEqual(['list', 'get', 'cancel']);
    expect(Object.keys(api.exports)).toEqual(['getStatus']);
    expect('invoke' in api).toBe(false);
    expect('ipcRenderer' in api).toBe(false);
  });

  it('maps every product method to its allowlisted IPC channel and forwards the request object', async () => {
    const calls: Array<{ channel: ProductIpcChannel; request: unknown }> = [];
    const api = createWritestormPreloadApi(async (channel, request) => {
      if (channel === 'internal:health') {
        return { ok: true, app: 'WriteStorm' };
      }

      calls.push({ channel, request });
      return {
        ok: false,
        error: createNotImplementedError(channel),
      };
    });

    const importSourceRequest = {
      title: 'Example Book',
    } satisfies ContractRequest<'books:import-source'>;
    const bookRequest = { bookId } satisfies ContractRequest<'structure:get'>;
    const updateNodeRequest = {
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 1,
      command: { type: 'rename-node', nodeId, title: 'Renamed Chapter' },
    } satisfies ContractRequest<'structure:update-node'>;
    const updateStoryRangeRequest = {
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 1,
      command: { type: 'accept-range-low-confidence', rangeId },
    } satisfies ContractRequest<'structure:update-story-range'>;
    const createDraftRequest = { bookId, candidateSetId: setId } satisfies ContractRequest<'structure:create-draft'>;
    const discardDraftRequest = {
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 1,
    } satisfies ContractRequest<'structure:discard-draft'>;
    const freezeRequest = {
      bookId,
      draftSetId: setId,
      expectedDraftRevision: 1,
    } satisfies ContractRequest<'structure:freeze'>;
    const unfreezeRequest = { bookId, frozenSetId: setId } satisfies ContractRequest<'structure:unfreeze'>;
    const updateBodyRequest = {
      instanceId,
      body: 'Updated body',
    } satisfies ContractRequest<'modules:update-body'>;
    const jobRequest = { jobId } satisfies ContractRequest<'jobs:get'>;
    const typeLibraryUpdateRequest = {
      bookId,
      expectedRevision: 0,
      typeLibraryVersion: 1,
      mainType: null,
      contentFocuses: [],
    } satisfies ContractRequest<'type-library:update-book-binding'>;

    await api.library.create();
    await api.library.open();
    await api.library.getCurrent();
    await api.books.list();
    await api.books.importSource(importSourceRequest);
    await api.typeLibrary.listOptions();
    await api.typeLibrary.getBookBinding({ bookId });
    await api.typeLibrary.updateBookBinding(typeLibraryUpdateRequest);
    await api.structure.get(bookRequest);
    await api.structure.detect(bookRequest);
    await api.structure.recoverDetection(bookRequest);
    await api.structure.createDraft(createDraftRequest);
    await api.structure.createManualDraft({
      ...bookRequest,
      expectedFailedDetectionRunId: 'run-failed' as import('../../src/shared/domain').StructureDetectionRunId,
    });
    await api.structure.discardDraft(discardDraftRequest);
    await api.structure.updateNode(updateNodeRequest);
    await api.structure.updateStoryRange(updateStoryRangeRequest);
    await api.structure.freeze(freezeRequest);
    await api.structure.unfreeze(unfreezeRequest);
    await api.modules.listInstances(bookRequest);
    await api.modules.updateBody(updateBodyRequest);
    await api.jobs.list({ bookId });
    await api.jobs.get(jobRequest);
    await api.jobs.cancel(jobRequest);
    await api.exports.getStatus(bookRequest);

    expect(calls.map((call) => call.channel)).toEqual([...PRODUCT_IPC_CHANNELS]);
    expect(calls).toEqual([
      { channel: 'library:create', request: {} },
      { channel: 'library:open', request: {} },
      { channel: 'library:get-current', request: {} },
      { channel: 'books:list', request: {} },
      { channel: 'books:import-source', request: importSourceRequest },
      { channel: 'type-library:list-options', request: {} },
      { channel: 'type-library:get-book-binding', request: { bookId } },
      { channel: 'type-library:update-book-binding', request: typeLibraryUpdateRequest },
      { channel: 'structure:get', request: bookRequest },
      { channel: 'structure:detect', request: bookRequest },
      { channel: 'structure:recover-detection', request: bookRequest },
      { channel: 'structure:create-draft', request: createDraftRequest },
      { channel: 'structure:create-manual-draft', request: {
        ...bookRequest,
        expectedFailedDetectionRunId: 'run-failed',
      } },
      { channel: 'structure:discard-draft', request: discardDraftRequest },
      { channel: 'structure:update-node', request: updateNodeRequest },
      { channel: 'structure:update-story-range', request: updateStoryRangeRequest },
      { channel: 'structure:freeze', request: freezeRequest },
      { channel: 'structure:unfreeze', request: unfreezeRequest },
      { channel: 'modules:list-instances', request: bookRequest },
      { channel: 'modules:update-body', request: updateBodyRequest },
      { channel: 'jobs:list', request: { bookId } },
      { channel: 'jobs:get', request: jobRequest },
      { channel: 'jobs:cancel', request: jobRequest },
      { channel: 'exports:get-status', request: bookRequest },
    ]);
  });
});
