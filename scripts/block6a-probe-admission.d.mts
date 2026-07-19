export type Block6aProbeSummary = {
  readonly task: string;
  readonly source: string;
  readonly classification: string;
};

export function admitBlock6aProbeResults(
  mode: string,
  results: readonly unknown[],
): Block6aProbeSummary[];
