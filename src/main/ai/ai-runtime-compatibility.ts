import type { AiCompatibilityAssessment } from './ai-connection-check-service';

declare const __WRITESTORM_AI_COMPATIBILITY_ASSESSMENT__:
  | {
    readonly state: 'fresh';
    readonly fingerprint: string;
  }
  | {
    readonly state: 'stale';
  };

export function readAiRuntimeCompatibility(input: {
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly buildAssessment?: AiCompatibilityAssessment;
}): AiCompatibilityAssessment {
  if (!input.isPackaged || input.platform !== 'win32' || input.architecture !== 'x64') {
    return Object.freeze({ state: 'blocked' });
  }
  const assessment = input.buildAssessment
    ?? __WRITESTORM_AI_COMPATIBILITY_ASSESSMENT__;
  if (assessment.state !== 'fresh') return Object.freeze({ state: assessment.state });
  if (!/^[0-9a-f]{64}$/.test(assessment.fingerprint)) {
    return Object.freeze({ state: 'blocked' });
  }
  return Object.freeze({
    state: 'fresh',
    fingerprint: assessment.fingerprint,
  });
}
