export type Block6aProbeSummary = {
  readonly task: string;
  readonly source: string;
  readonly classification: string;
};

export type Block6aProbeEvaluation = {
  readonly evidenceAccepted: true;
  readonly admission: 'admitted' | 'admitted_with_conditions' | 'blocked';
  readonly recertificationAdmitted: boolean;
  readonly blockers: readonly (
    | 'authenticated_sdk_success_unavailable'
    | 'output_schema_guard_unavailable'
    | 'git_bypass_differential_unavailable'
  )[];
  readonly conditionalLimitations: readonly (
    | 'git_auth_structured_classification_unavailable'
    | 'isolated_auth_local_turn_deadline_observed'
    | 'isolated_auth_sdk_runtime_unavailable_observed'
    | 'current_auth_non_git_check_failure_generic_only'
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
