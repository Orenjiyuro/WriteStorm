export type Block6aProbeSummary = {
  readonly task: string;
  readonly source: string;
  readonly classification: string;
};

export type Block6aProbeEvaluation = {
  readonly evidenceAccepted: true;
  readonly recertificationAdmitted: boolean;
  readonly blockers: readonly (
    | 'git_auth_structured_classification_unavailable'
    | 'authenticated_sdk_success_unavailable'
  )[];
  readonly results: Block6aProbeSummary[];
};

export function evaluateBlock6aProbeResults(
  mode: string,
  results: readonly unknown[],
): Block6aProbeEvaluation;

export function admitBlock6aProbeResults(
  mode: string,
  results: readonly unknown[],
): Block6aProbeSummary[];
