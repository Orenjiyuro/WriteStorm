import { performance } from 'node:perf_hooks';
import { executeStructureWorkerDetection } from './structure-worker-detection';
import type {
  StructureWorkerDetectionInput,
  StructureWorkerDetectionResult,
  StructureWorkerDetectionTelemetry,
} from './structure-worker-protocol';

type MemoryEndpoint = {
  readonly rss: number;
  readonly heapUsed: number;
};

export type StructureWorkerPerformanceClock = {
  readonly now: () => number;
  readonly memoryUsage: () => MemoryEndpoint;
  readonly maxRssKilobytes: () => number;
};

export function measureStructureWorkerDetection(
  input: StructureWorkerDetectionInput,
  clock: StructureWorkerPerformanceClock = defaultClock,
): {
  readonly result: StructureWorkerDetectionResult;
  readonly telemetry: StructureWorkerDetectionTelemetry;
} {
  const before = clock.memoryUsage();
  const startedAt = clock.now();
  const result = executeStructureWorkerDetection(input);
  const durationMs = Math.max(0, clock.now() - startedAt);
  const after = clock.memoryUsage();

  return {
    result,
    telemetry: {
      durationMs,
      rssBeforeBytes: before.rss,
      rssAfterBytes: after.rss,
      heapUsedBeforeBytes: before.heapUsed,
      heapUsedAfterBytes: after.heapUsed,
      maxRssBytes: Math.max(0, Math.round(clock.maxRssKilobytes() * 1024)),
    },
  };
}

const defaultClock: StructureWorkerPerformanceClock = {
  now: () => performance.now(),
  memoryUsage: () => process.memoryUsage(),
  maxRssKilobytes: () => process.resourceUsage().maxRSS,
};
