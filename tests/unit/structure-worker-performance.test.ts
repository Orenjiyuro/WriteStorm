import { describe, expect, it } from 'vitest';
import { measureStructureWorkerDetection } from '../../src/main/structure/worker/structure-worker-performance';

describe('structure worker performance telemetry', () => {
  it('records detector duration, memory endpoints, and process-lifetime max RSS', () => {
    const times = [100, 112.5];
    const memory = [
      { rss: 40_000_000, heapUsed: 8_000_000 },
      { rss: 45_000_000, heapUsed: 10_000_000 },
    ];

    const measured = measureStructureWorkerDetection({
      bookTitle: 'Performance fixture',
      sourceText: 'Chapter 1: Start\nBody',
    }, {
      now: () => times.shift()!,
      memoryUsage: () => memory.shift()!,
      maxRssKilobytes: () => 46_875,
    });

    expect(measured.result.structure.status).toBe('candidate_ready');
    expect(measured.telemetry).toEqual({
      durationMs: 12.5,
      rssBeforeBytes: 40_000_000,
      rssAfterBytes: 45_000_000,
      heapUsedBeforeBytes: 8_000_000,
      heapUsedAfterBytes: 10_000_000,
      maxRssBytes: 48_000_000,
    });
  });
});
