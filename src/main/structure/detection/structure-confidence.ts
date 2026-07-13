import type { StructureConfidence } from '../../../shared/domain';

export const STRUCTURE_CONFIDENCE_THRESHOLDS = Object.freeze({
  high: 0.85,
  medium: 0.65,
  low: 0.35,
} as const);

export function confidenceFromScore(score: number): StructureConfidence {
  const boundedScore = Math.min(1, Math.max(0, score));

  if (boundedScore >= STRUCTURE_CONFIDENCE_THRESHOLDS.high) {
    return createConfidence(boundedScore, 'high');
  }

  if (boundedScore >= STRUCTURE_CONFIDENCE_THRESHOLDS.medium) {
    return createConfidence(boundedScore, 'medium');
  }

  if (boundedScore >= STRUCTURE_CONFIDENCE_THRESHOLDS.low) {
    return createConfidence(boundedScore, 'low');
  }

  return createConfidence(boundedScore, 'unusable');
}

function createConfidence(
  score: number,
  level: StructureConfidence['level'],
): StructureConfidence {
  return {
    score,
    level,
    lowConfidenceResolution: level === 'low' ? 'unresolved' : null,
  };
}
