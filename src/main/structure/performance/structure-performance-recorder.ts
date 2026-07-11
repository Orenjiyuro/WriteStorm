import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { StructureWorkerDetectionTelemetry } from '../worker/structure-worker-protocol';

export const STRUCTURE_PERFORMANCE_PROVISIONAL_ADVISORY_LINES = {
  mainElapsedMs: 10_000,
  workerMaxRssBytes: 512 * 1024 * 1024,
} as const;
export const WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER_ENV =
  'WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER';
export const WRITESTORM_STRUCTURE_PERFORMANCE_RESULT_ENV =
  'WRITESTORM_STRUCTURE_PERFORMANCE_RESULT';

export type StructurePerformanceRuntime = {
  readonly platform: string;
  readonly arch: string;
  readonly node: string;
  readonly electron: string;
};

export type StructurePerformanceSampleInput = {
  readonly fixture: string;
  readonly inputBytes: number;
  readonly inputCharacters: number;
  readonly mainElapsedMs: number;
  readonly workerPid: number;
  readonly worker: StructureWorkerDetectionTelemetry;
};

export type StructurePerformanceRecorder = {
  readonly record: (sample: StructurePerformanceSampleInput) => void;
};

export type StructurePerformanceRecorderOptions = {
  readonly resultPath: string;
  readonly now?: () => string;
  readonly runtime?: StructurePerformanceRuntime;
};

export function createStructurePerformanceRecorder(
  options: StructurePerformanceRecorderOptions,
): StructurePerformanceRecorder {
  const document = {
    schemaVersion: 1,
    thresholdPolicy: 'observation_only',
    recordedAt: (options.now ?? (() => new Date().toISOString()))(),
    runtime: options.runtime ?? currentRuntime(),
    provisionalAdvisoryLines: STRUCTURE_PERFORMANCE_PROVISIONAL_ADVISORY_LINES,
    samples: [] as Array<StructurePerformanceSampleInput & { advisories: string[] }>,
  } as const;

  return {
    record: (sample) => {
      document.samples.push({
        ...sample,
        advisories: sampleAdvisories(sample),
      });
      mkdirSync(path.dirname(options.resultPath), { recursive: true });
      writeFileSync(options.resultPath, JSON.stringify(document, null, 2), 'utf8');
    },
  };
}

export function createOptionalStructurePerformanceRecorder(
  env: NodeJS.ProcessEnv = process.env,
): StructurePerformanceRecorder | null {
  const resultPath = env[WRITESTORM_STRUCTURE_PERFORMANCE_RESULT_ENV];
  if (env[WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER_ENV] !== '1' || !resultPath) {
    return null;
  }

  return createStructurePerformanceRecorder({ resultPath });
}

function sampleAdvisories(sample: StructurePerformanceSampleInput): string[] {
  const advisories: string[] = [];
  if (sample.mainElapsedMs > STRUCTURE_PERFORMANCE_PROVISIONAL_ADVISORY_LINES.mainElapsedMs) {
    advisories.push('main_elapsed_above_provisional_line');
  }
  if (sample.worker.maxRssBytes > STRUCTURE_PERFORMANCE_PROVISIONAL_ADVISORY_LINES.workerMaxRssBytes) {
    advisories.push('worker_max_rss_above_provisional_line');
  }
  return advisories;
}

function currentRuntime(): StructurePerformanceRuntime {
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    electron: process.versions.electron ?? 'not_electron',
  };
}
