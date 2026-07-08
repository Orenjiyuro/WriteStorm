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
} from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const nodeId = 'node-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const instanceId = 'instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;

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

    expect(Object.keys(api)).toEqual(['internal', 'library', 'books', 'structure', 'modules', 'jobs', 'exports']);
    expect(Object.keys(api.internal)).toEqual(['health']);
    expect(Object.keys(api.library)).toEqual(['create', 'open', 'getCurrent']);
    expect(Object.keys(api.books)).toEqual(['list', 'importSource']);
    expect(Object.keys(api.structure)).toEqual(['get', 'updateNode', 'updateStoryRange', 'freeze']);
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
      nodeId,
      patch: {
        title: 'Renamed Chapter',
      },
    } satisfies ContractRequest<'structure:update-node'>;
    const updateStoryRangeRequest = {
      rangeId,
      patch: {
        confidence: 0.75,
      },
    } satisfies ContractRequest<'structure:update-story-range'>;
    const updateBodyRequest = {
      instanceId,
      body: 'Updated body',
    } satisfies ContractRequest<'modules:update-body'>;
    const jobRequest = { jobId } satisfies ContractRequest<'jobs:get'>;

    await api.library.create();
    await api.library.open();
    await api.library.getCurrent();
    await api.books.list();
    await api.books.importSource(importSourceRequest);
    await api.structure.get(bookRequest);
    await api.structure.updateNode(updateNodeRequest);
    await api.structure.updateStoryRange(updateStoryRangeRequest);
    await api.structure.freeze(bookRequest);
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
      { channel: 'structure:get', request: bookRequest },
      { channel: 'structure:update-node', request: updateNodeRequest },
      { channel: 'structure:update-story-range', request: updateStoryRangeRequest },
      { channel: 'structure:freeze', request: bookRequest },
      { channel: 'modules:list-instances', request: bookRequest },
      { channel: 'modules:update-body', request: updateBodyRequest },
      { channel: 'jobs:list', request: { bookId } },
      { channel: 'jobs:get', request: jobRequest },
      { channel: 'jobs:cancel', request: jobRequest },
      { channel: 'exports:get-status', request: bookRequest },
    ]);
  });
});
