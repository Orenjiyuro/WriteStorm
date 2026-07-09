import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LIBRARY_PERFORMANCE_BASELINE_LIMITS_MS,
  runLibraryPerformanceBaseline,
} from '../../../src/main/library/performance-baseline';

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('Block 6 SQLite and migration performance baseline', () => {
  it('records small and medium create/open/migration/summary-query timings under non-regression limits', () => {
    const rootParentPath = tempDirectory('writestorm-library-performance-');
    const results = runLibraryPerformanceBaseline({
      rootParentPath,
      appVersion: '0.1.0-test',
      now: () => '2026-07-09T00:00:00.000Z',
    });
    writePerformanceEvidence(results);

    expect(results.map((result) => result.fixture.name)).toEqual(['small', 'medium']);

    for (const result of results) {
      const limits = LIBRARY_PERFORMANCE_BASELINE_LIMITS_MS[result.fixture.name];

      expect(result.summary.itemCount).toBe(result.fixture.itemCount);
      expect(result.summary.schemaVersion).toBe(result.fixture.expectedSchemaVersion);
      expect(result.timingsMs.create).toBeGreaterThanOrEqual(0);
      expect(result.timingsMs.open).toBeGreaterThanOrEqual(0);
      expect(result.timingsMs.migration).toBeGreaterThanOrEqual(0);
      expect(result.timingsMs.summaryQuery).toBeGreaterThanOrEqual(0);
      expect(result.timingsMs.create).toBeLessThanOrEqual(limits.create);
      expect(result.timingsMs.open).toBeLessThanOrEqual(limits.open);
      expect(result.timingsMs.migration).toBeLessThanOrEqual(limits.migration);
      expect(result.timingsMs.summaryQuery).toBeLessThanOrEqual(limits.summaryQuery);
    }
  });
});

function tempDirectory(prefix: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);

  return tempDir;
}

function writePerformanceEvidence(results: ReturnType<typeof runLibraryPerformanceBaseline>): void {
  const evidencePath = path.resolve('test-results/block6-performance-baseline/latest.json');
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results,
        limitsMs: LIBRARY_PERFORMANCE_BASELINE_LIMITS_MS,
      },
      null,
      2,
    )}\n`,
  );
}
