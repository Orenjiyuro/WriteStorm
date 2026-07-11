import { describe, expect, it } from 'vitest';
import {
  STRUCTURE_PERFORMANCE_FIXTURES,
  generateStructurePerformanceFixture,
} from '../../src/main/structure/performance/structure-performance-fixtures';
import { executeStructureWorkerDetection } from '../../src/main/structure/worker/structure-worker-detection';

describe('structure performance fixtures', () => {
  it('generates deterministic exact-byte txt/md inputs for 50KB, 1MB, and 5MB', () => {
    expect(STRUCTURE_PERFORMANCE_FIXTURES.map((fixture) => fixture.name)).toEqual([
      '50kb-txt',
      '50kb-md',
      '1mb-txt',
      '1mb-md',
      '5mb-txt',
      '5mb-md',
    ]);

    for (const fixture of STRUCTURE_PERFORMANCE_FIXTURES) {
      const first = generateStructurePerformanceFixture(fixture);
      const second = generateStructurePerformanceFixture(fixture);
      expect(first).toBe(second);
      expect(Buffer.byteLength(first, 'utf8')).toBe(fixture.sizeBytes);
      expect(executeStructureWorkerDetection({
        bookTitle: fixture.name,
        sourceText: first,
      }).structure.status).not.toBe('structure_detection_failed');
    }
  });
});
