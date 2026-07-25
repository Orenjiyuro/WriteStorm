export type AiCompatibilityAssessment =
  | Readonly<{
    state: 'fresh';
    fingerprint: string;
  }>
  | Readonly<{
    state: 'stale' | 'blocked' | 'unknown';
  }>;
