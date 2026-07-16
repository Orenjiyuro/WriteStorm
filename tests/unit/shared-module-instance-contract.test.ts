import { describe, expect, it } from 'vitest';
import { moduleInstanceSummarySchema } from '../../src/shared/contracts/modules';

const baseSummary = {
  id: 'instance-1',
  bookId: 'book-1',
  moduleId: 'plot_causality',
  status: 'not_generated' as const,
  structureEdition: 1,
  analysisRevision: 0,
  updatedAt: '2026-07-15T00:00:00.000Z',
};

describe('analysis module instance contract', () => {
  it('accepts the four complete scope identities', () => {
    for (const scope of [
      { kind: 'book', bookId: 'book-1' },
      { kind: 'volume', nodeId: 'volume-1' },
      { kind: 'chapter', nodeId: 'chapter-1' },
      { kind: 'story_segment_range', rangeId: 'range-1' },
    ] as const) {
      expect(moduleInstanceSummarySchema.parse({ ...baseSummary, scope }).scope).toEqual(scope);
    }
  });

  it('requires a positive source structure edition and nonnegative analysis revision', () => {
    const scope = { kind: 'book' as const, bookId: 'book-1' };
    expect(moduleInstanceSummarySchema.safeParse({ ...baseSummary, scope, structureEdition: 0 }).success)
      .toBe(false);
    expect(moduleInstanceSummarySchema.safeParse({ ...baseSummary, scope, analysisRevision: -1 }).success)
      .toBe(false);
  });

  it('rejects ambiguous or incomplete scope references', () => {
    expect(moduleInstanceSummarySchema.safeParse({
      ...baseSummary,
      scope: { kind: 'chapter', nodeId: 'chapter-1', rangeId: 'range-1' },
    }).success).toBe(false);
    expect(moduleInstanceSummarySchema.safeParse({
      ...baseSummary,
      scope: { kind: 'volume' },
    }).success).toBe(false);
  });
});
