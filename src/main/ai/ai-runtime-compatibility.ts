import type { AiCompatibilityAssessment } from './ai-connection-check-service';
import type {
  AiArtifactCompatibilityAssessment,
} from './ai-runtime-artifact-attestation';

declare const __WRITESTORM_AI_COMPATIBILITY_ASSESSMENT__:
  | {
    readonly state: 'fresh';
    readonly fingerprint: string;
  }
  | {
    readonly state: 'stale';
  };
declare const __WRITESTORM_AI_CERTIFICATION_MARKER__: string | null;

export function readAiBuildCompatibilityAssessment(): AiCompatibilityAssessment {
  const assessment = __WRITESTORM_AI_COMPATIBILITY_ASSESSMENT__;
  if (assessment.state !== 'fresh') return Object.freeze({ state: 'stale' });
  if (!/^[0-9a-f]{64}$/.test(assessment.fingerprint)) {
    return Object.freeze({ state: 'blocked' });
  }
  if (__WRITESTORM_AI_CERTIFICATION_MARKER__
    !== `block13-task13-certification-build-v1:${assessment.fingerprint}`) {
    return Object.freeze({ state: 'blocked' });
  }
  return Object.freeze({ ...assessment });
}

export function readAiRuntimeCompatibility(input: {
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly buildAssessment?: AiCompatibilityAssessment;
  readonly artifactAssessment?: AiArtifactCompatibilityAssessment;
}): AiCompatibilityAssessment {
  if (!input.isPackaged || input.platform !== 'win32' || input.architecture !== 'x64') {
    return Object.freeze({ state: 'blocked' });
  }
  const assessment = input.buildAssessment
    ?? readAiBuildCompatibilityAssessment();
  if (assessment.state !== 'fresh') return Object.freeze({ state: assessment.state });
  if (!/^[0-9a-f]{64}$/.test(assessment.fingerprint)) {
    return Object.freeze({ state: 'blocked' });
  }
  const artifact = input.artifactAssessment ?? { state: 'unverified' };
  if (artifact.state !== 'verified'
    || artifact.compatibilityFingerprint !== assessment.fingerprint) {
    return Object.freeze({ state: 'stale' });
  }
  return Object.freeze({
    state: 'fresh',
    fingerprint: assessment.fingerprint,
  });
}
