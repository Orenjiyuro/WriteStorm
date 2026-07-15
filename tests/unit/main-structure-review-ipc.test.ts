import { describe, expect, it } from 'vitest';
import {
  createStructureReviewIpcDependencies,
  type StructureReviewService,
} from '../../src/main/structure/structure-review-ipc';
import { StructureServiceError } from '../../src/main/structure/structure-service';
import { StructureSourceSnapshotError } from '../../src/main/structure/structure-source-snapshot';
import type { BreakdownBookId, StructureNodeId, StructureSetId } from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const setId = 'set-1' as StructureSetId;
const failedRunId = 'run-failed' as import('../../src/shared/domain').StructureDetectionRunId;

describe('structure review/freeze IPC', () => {
  it('exposes every review mutation and forwards one strict operation to the service', async () => {
    const calls: unknown[][] = [];
    const result = { marker: true };
    const service = {
      async getWorkspace(...args: unknown[]) { calls.push(['get', ...args]); return result; },
      createDraft(...args: unknown[]) { calls.push(['create', ...args]); return result; },
      async createManualDraft(...args: unknown[]) { calls.push(['manual', ...args]); return result; },
      discardDraft(...args: unknown[]) { calls.push(['discard', ...args]); return result; },
      updateNode(...args: unknown[]) { calls.push(['node', ...args]); return result; },
      updateStoryRange(...args: unknown[]) { calls.push(['range', ...args]); return result; },
      async freeze(...args: unknown[]) { calls.push(['freeze', ...args]); return result; },
      unfreeze(...args: unknown[]) { calls.push(['unfreeze', ...args]); return result; },
    } as unknown as StructureReviewService;
    const ipc = createStructureReviewIpcDependencies(service);
    expect(Object.keys(ipc)).toEqual([
      'structure:get', 'structure:create-draft', 'structure:create-manual-draft', 'structure:discard-draft',
      'structure:update-node', 'structure:update-story-range', 'structure:freeze', 'structure:unfreeze',
    ]);
    await ipc['structure:get']({ bookId });
    await ipc['structure:create-draft']({ bookId, candidateSetId: setId });
    await ipc['structure:create-draft']({
      bookId, candidateSetId: setId, replacementFrozenSetId: 'frozen-1' as StructureSetId,
    });
    await ipc['structure:create-manual-draft']({
      bookId, expectedFailedDetectionRunId: failedRunId,
    });
    await ipc['structure:discard-draft']({ bookId, draftSetId: setId, expectedDraftRevision: 2 });
    await ipc['structure:update-node']({
      bookId, draftSetId: setId, expectedDraftRevision: 2,
      command: { type: 'rename-node', nodeId: 'node-1' as StructureNodeId, title: 'Chapter' },
    });
    await ipc['structure:update-story-range']({
      bookId, draftSetId: setId, expectedDraftRevision: 2,
      command: { type: 'set-story-range-mode', mode: 'skipped_by_user' },
    });
    await ipc['structure:freeze']({ bookId, draftSetId: setId, expectedDraftRevision: 2 });
    await ipc['structure:unfreeze']({ bookId, frozenSetId: setId });
    expect(calls.map(([name]) => name)).toEqual([
      'get', 'create', 'create', 'manual', 'discard', 'node', 'range', 'freeze', 'unfreeze',
    ]);
    expect(calls[2]).toEqual(['create', bookId, setId, 'frozen-1']);
    expect(calls[3]).toEqual(['manual', bookId, failedRunId]);
  });

  it('maps revision mismatch to a refreshable stable STRUCTURE_ERROR', async () => {
    const error = new StructureServiceError('draft_revision_mismatch', 'Refresh the draft.', {
      expectedDraftRevision: 2, actualDraftRevision: 3, blockers: ['revision_changed'],
    });
    const unused = () => { throw error; };
    const ipc = createStructureReviewIpcDependencies({
      async getWorkspace() { return unused(); }, createDraft: unused, async createManualDraft() { return unused(); }, discardDraft: unused,
      updateNode: unused, updateStoryRange: unused, async freeze() { return unused(); }, unfreeze: unused,
    } as unknown as StructureReviewService);
    await expect(ipc['structure:update-node']({
      bookId, draftSetId: setId, expectedDraftRevision: 2,
      command: { type: 'rename-node', nodeId: 'node-1' as StructureNodeId, title: 'Chapter' },
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'STRUCTURE_ERROR', recoverable: true, details: {
        reason: 'draft_revision_mismatch', expectedDraftRevision: 2,
        actualDraftRevision: 3, refreshRequired: true, blockers: ['revision_changed'],
      } },
    });
  });

  it('maps an unknown structure:get book to the stable book_not_found envelope', async () => {
    const error = new StructureSourceSnapshotError(
      'book_not_found', 'Book was not found in the current library.',
    );
    const unused = () => { throw new Error('unused'); };
    const ipc = createStructureReviewIpcDependencies({
      async getWorkspace() { throw error; }, createDraft: unused, async createManualDraft() { return unused(); },
      discardDraft: unused, updateNode: unused, updateStoryRange: unused,
      async freeze() { return unused(); }, unfreeze: unused,
    } as unknown as StructureReviewService);

    await expect(ipc['structure:get']({ bookId })).resolves.toEqual({
      ok: false,
      error: {
        code: 'STRUCTURE_ERROR', message: error.message, recoverable: true,
        details: { reason: 'book_not_found' },
      },
    });
  });
});
