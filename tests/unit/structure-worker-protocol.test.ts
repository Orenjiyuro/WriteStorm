import { describe, expect, it } from 'vitest';
import { detectStructureCandidates } from '../../src/main/structure/detection/structure-detector';
import {
  STRUCTURE_WORKER_PROTOCOL_VERSION,
  isUtilityWorkerRequest,
  isUtilityWorkerResponse,
} from '../../src/main/structure/worker/structure-worker-protocol';

describe('structure utility worker protocol', () => {
  it('accepts a strict typed detection request without a source path', () => {
    expect(isUtilityWorkerRequest({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: 'detect-1',
      command: 'detect',
      input: {
        bookTitle: 'Fixture book',
        sourceText: 'Chapter 1: Start',
      },
    })).toBe(true);

    expect(isUtilityWorkerRequest({
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: 'detect-2',
      command: 'detect',
      input: {
        bookTitle: 'Fixture book',
        sourceText: 'Chapter 1: Start',
        sourcePath: 'C:\\private\\book.txt',
      },
    })).toBe(false);
  });

  it('accepts a typed real-detection response and rejects malformed results', () => {
    const structure = detectStructureCandidates({
      bookTitle: 'Fixture book',
      sourceText: 'Chapter 1: Start',
    });
    const response = {
      version: STRUCTURE_WORKER_PROTOCOL_VERSION,
      requestId: 'detect-1',
      command: 'detect',
      ok: true,
      workerPid: 4242,
      result: {
        structure,
        storyRanges: structure.status === 'structure_detection_failed'
          ? null
          : {
            status: 'no_reliable_story_ranges',
            reason: 'fewer_than_two_chapters',
            ranges: [],
            uncoveredChapterIds: structure.nodes
              .filter((node) => node.kind === 'chapter')
              .map((node) => node.id),
          },
      },
      telemetry: {
        durationMs: 12.5,
        rssBeforeBytes: 40_000_000,
        rssAfterBytes: 45_000_000,
        heapUsedBeforeBytes: 8_000_000,
        heapUsedAfterBytes: 10_000_000,
        maxRssBytes: 48_000_000,
      },
    };

    expect(isUtilityWorkerResponse(response)).toBe(true);
    expect(isUtilityWorkerResponse({
      ...response,
      result: {
        structure: { status: 'candidate_ready' },
        storyRanges: null,
      },
    })).toBe(false);
  });
});
