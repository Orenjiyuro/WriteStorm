import { describe, expect, it } from 'vitest';
import {
  STRUCTURE_CONFIDENCE_THRESHOLDS,
  confidenceFromScore,
} from '../../src/main/structure/detection/structure-confidence';

describe('structure confidence', () => {
  it('marks low confidence as unresolved while high and medium remain resolution-free', () => {
    expect(confidenceFromScore(0.9)).toEqual({
      score: 0.9,
      level: 'high',
      lowConfidenceResolution: null,
    });
    expect(confidenceFromScore(0.7)).toEqual({
      score: 0.7,
      level: 'medium',
      lowConfidenceResolution: null,
    });
    expect(confidenceFromScore(0.5)).toEqual({
      score: 0.5,
      level: 'low',
      lowConfidenceResolution: 'unresolved',
    });
  });

  it('publishes stable inclusive thresholds and clamps scores at the domain bounds', () => {
    expect(STRUCTURE_CONFIDENCE_THRESHOLDS).toEqual({
      high: 0.85,
      medium: 0.65,
      low: 0.35,
    });
    expect(Object.isFrozen(STRUCTURE_CONFIDENCE_THRESHOLDS)).toBe(true);

    expect(confidenceFromScore(0.85).level).toBe('high');
    expect(confidenceFromScore(0.849_999).level).toBe('medium');
    expect(confidenceFromScore(0.65).level).toBe('medium');
    expect(confidenceFromScore(0.649_999).level).toBe('low');
    expect(confidenceFromScore(0.35).level).toBe('low');
    expect(confidenceFromScore(0.349_999).level).toBe('unusable');
    expect(confidenceFromScore(-1)).toMatchObject({ score: 0, level: 'unusable' });
    expect(confidenceFromScore(2)).toMatchObject({ score: 1, level: 'high' });
  });
});
