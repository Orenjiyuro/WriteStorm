export const AI_RUNTIME_AUTH_STATES = [
  'authenticated',
  'auth_required',
  'auth_expired',
  'permission_denied',
  'auth_runtime_unavailable',
  'unknown',
] as const;

export type AiRuntimeAuthState = typeof AI_RUNTIME_AUTH_STATES[number];

export type AiCompatibilityAssessment =
  | {
    readonly state: 'fresh';
    readonly fingerprint: string;
  }
  | {
    readonly state: 'stale' | 'blocked' | 'unknown';
  };

export type AiRuntimeObservation = {
  readonly authState: AiRuntimeAuthState;
  readonly observedAt: string | null;
  readonly compatibilityFingerprint: string | null;
};

declare const observationReceiptBrand: unique symbol;

export interface AiRuntimeObservationReceipt extends AiRuntimeObservation {
  readonly [observationReceiptBrand]: never;
}

const UNKNOWN_AI_RUNTIME_OBSERVATION: AiRuntimeObservation = Object.freeze({
  authState: 'unknown',
  observedAt: null,
  compatibilityFingerprint: null,
});
const runtimeObservationReceipts = new WeakSet<AiRuntimeObservationReceipt>();

export function unknownAiRuntimeObservation(): AiRuntimeObservation {
  return UNKNOWN_AI_RUNTIME_OBSERVATION;
}

export class AiRuntimeObservationMemory {
  private compatibilityFingerprint: string | null = null;
  private observation: AiRuntimeObservation = UNKNOWN_AI_RUNTIME_OBSERVATION;

  setCompatibility(assessment: AiCompatibilityAssessment): void {
    if (assessment.state !== 'fresh') {
      this.compatibilityFingerprint = null;
      this.observation = UNKNOWN_AI_RUNTIME_OBSERVATION;
      return;
    }
    assertSha256(assessment.fingerprint);
    if (assessment.fingerprint !== this.compatibilityFingerprint) {
      this.observation = UNKNOWN_AI_RUNTIME_OBSERVATION;
    }
    this.compatibilityFingerprint = assessment.fingerprint;
  }

  accept(observation: AiRuntimeObservationReceipt): boolean {
    if (!this.compatibilityFingerprint
      || !runtimeObservationReceipts.has(observation)
      || observation.compatibilityFingerprint !== this.compatibilityFingerprint) {
      return false;
    }
    this.observation = Object.freeze({ ...observation });
    return true;
  }

  clear(): void {
    this.observation = UNKNOWN_AI_RUNTIME_OBSERVATION;
  }

  read(): AiRuntimeObservation {
    return this.observation;
  }
}

/** @internal Only reviewed provider runtime mappers may call this capability. */
export function mintAiRuntimeObservationReceipt(
  observation: AiRuntimeObservation,
): AiRuntimeObservationReceipt {
  const receipt = Object.freeze({ ...observation }) as AiRuntimeObservationReceipt;
  runtimeObservationReceipts.add(receipt);
  return receipt;
}

function assertSha256(value: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error('AI compatibility fingerprint must be a lowercase SHA-256 value.');
  }
}
