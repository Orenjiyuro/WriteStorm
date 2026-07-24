import type {
  AiCompatibilityStateDto,
  AiConnectionCheckData,
  AiGateStateDto,
} from '../../shared/contracts';
import { AI_GATE_STATE } from '../../shared/contracts';
export type AiCompatibilityAssessment =
  | Readonly<{ state: 'fresh'; fingerprint: string }>
  | Readonly<{ state: 'stale' | 'blocked' | 'unknown' }>;

type AiRuntimeObservation = Readonly<{
  authState:
    | 'authenticated'
    | 'auth_required'
    | 'auth_expired'
    | 'permission_denied'
    | 'auth_runtime_unavailable'
    | 'unknown';
  observedAt: string | null;
  compatibilityFingerprint: string | null;
}>;

export const AI_CONNECTION_GATE: AiGateStateDto = AI_GATE_STATE;

export type AiConnectionCheckAttemptAdmission =
  | Readonly<{
    accepted: true;
    result: Promise<unknown>;
  }>
  | Readonly<{
    accepted: false;
    reason:
      | 'attempt_active'
      | 'cleanup_unverified'
      | 'admission_paused'
      | 'session_start_failed';
  }>;

export type AiConnectionCheckAttemptController = {
  beginExplicit(): AiConnectionCheckAttemptAdmission;
};

type AuthObservationAuthority = {
  setCompatibility(assessment: AiCompatibilityAssessment): void;
  acceptActualRuntime(input: unknown): boolean;
  clear(): void;
  read(): AiRuntimeObservation;
};

export class AiConnectionCheckService {
  private compatibility: AiCompatibilityAssessment = { state: 'unknown' };
  private observationEpoch = 0;

  constructor(private readonly dependencies: {
    readonly assessCompatibility: () => AiCompatibilityAssessment;
    readonly auth: AuthObservationAuthority;
    readonly attempts: AiConnectionCheckAttemptController;
  }) {
    this.refreshCompatibility();
  }

  checkConnection(): Promise<AiConnectionCheckData> {
    const compatibility = this.refreshCompatibility();
    if (compatibility.state !== 'fresh') {
      this.dependencies.auth.clear();
      return Promise.resolve(this.read());
    }

    const admission = this.dependencies.attempts.beginExplicit();
    if (!admission.accepted) return Promise.resolve(this.read());

    this.dependencies.auth.clear();
    const epoch = ++this.observationEpoch;
    return this.completeAttempt(admission.result, epoch, compatibility.fingerprint);
  }

  invalidate(): void {
    this.observationEpoch += 1;
    this.refreshCompatibility();
    this.dependencies.auth.clear();
  }

  read(): AiConnectionCheckData {
    const observation = this.dependencies.auth.read();
    return deepFreeze({
      gate: AI_CONNECTION_GATE,
      compatibility: toCompatibilityDto(this.compatibility),
      runtime: {
        authState: observation.authState,
        observedAt: observation.observedAt,
      },
    });
  }

  private async completeAttempt(
    result: Promise<unknown>,
    epoch: number,
    fingerprint: string,
  ): Promise<AiConnectionCheckData> {
    let observation: unknown;
    try {
      observation = await result;
    } catch {
      observation = null;
    }
    if (epoch !== this.observationEpoch) return this.read();

    const compatibility = this.refreshCompatibility();
    if (compatibility.state !== 'fresh'
      || compatibility.fingerprint !== fingerprint
      || observation === null) {
      this.dependencies.auth.clear();
      return this.read();
    }
    try {
      this.dependencies.auth.acceptActualRuntime(observation);
    } catch {
      this.dependencies.auth.clear();
    }
    return this.read();
  }

  private refreshCompatibility(): AiCompatibilityAssessment {
    const assessment = this.dependencies.assessCompatibility();
    this.compatibility = assessment.state === 'fresh'
      ? Object.freeze({ ...assessment })
      : Object.freeze({ state: assessment.state });
    this.dependencies.auth.setCompatibility(this.compatibility);
    return this.compatibility;
  }
}

function toCompatibilityDto(
  assessment: AiCompatibilityAssessment,
): AiCompatibilityStateDto {
  return assessment.state === 'fresh'
    ? Object.freeze({ state: 'fresh', fingerprint: assessment.fingerprint })
    : Object.freeze({ state: assessment.state, fingerprint: null });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
