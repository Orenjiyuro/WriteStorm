import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createOptionalStructurePerformanceRecorder,
  createStructurePerformanceRecorder,
} from '../../src/main/structure/performance/structure-performance-recorder';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe('structure performance recorder', () => {
  it('is disabled unless both the explicit probe flag and result path are present', () => {
    expect(createOptionalStructurePerformanceRecorder({})).toBeNull();
    expect(createOptionalStructurePerformanceRecorder({
      WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER: '1',
    })).toBeNull();

    const resultPath = path.join(tempDirectory(), 'enabled.json');
    expect(createOptionalStructurePerformanceRecorder({
      WRITESTORM_STRUCTURE_PERFORMANCE_RECORDER: '1',
      WRITESTORM_STRUCTURE_PERFORMANCE_RESULT: resultPath,
    })).not.toBeNull();
  });

  it('writes observation-only samples and advisory lines without turning them into pass/fail limits', () => {
    const resultPath = path.join(tempDirectory(), 'structure-performance.json');
    const recorder = createStructurePerformanceRecorder({
      resultPath,
      now: () => '2026-07-11T08:00:00.000Z',
      runtime: {
        platform: 'win32',
        arch: 'x64',
        node: '22.0.0',
        electron: '43.0.0',
      },
    });

    recorder.record({
      fixture: '5mb-md',
      inputBytes: 5 * 1024 * 1024,
      inputCharacters: 5 * 1024 * 1024,
      mainElapsedMs: 10_500,
      workerPid: 4242,
      worker: {
        durationMs: 10_250,
        rssBeforeBytes: 40_000_000,
        rssAfterBytes: 600_000_000,
        heapUsedBeforeBytes: 8_000_000,
        heapUsedAfterBytes: 550_000_000,
        maxRssBytes: 600_000_000,
      },
    });

    expect(JSON.parse(readFileSync(resultPath, 'utf8'))).toEqual({
      schemaVersion: 1,
      thresholdPolicy: 'observation_only',
      recordedAt: '2026-07-11T08:00:00.000Z',
      runtime: {
        platform: 'win32',
        arch: 'x64',
        node: '22.0.0',
        electron: '43.0.0',
      },
      provisionalAdvisoryLines: {
        mainElapsedMs: 10_000,
        workerMaxRssBytes: 536_870_912,
      },
      samples: [{
        fixture: '5mb-md',
        inputBytes: 5 * 1024 * 1024,
        inputCharacters: 5 * 1024 * 1024,
        mainElapsedMs: 10_500,
        workerPid: 4242,
        worker: expect.any(Object),
        advisories: ['main_elapsed_above_provisional_line', 'worker_max_rss_above_provisional_line'],
      }],
    });
  });
});

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'writestorm-structure-performance-'));
  tempDirs.push(directory);
  return directory;
}
