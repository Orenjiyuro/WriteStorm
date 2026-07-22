export type Block6aCertificationVerdict = {
  readonly verified: true;
  readonly classification: 'conditional_go_windows_only_macos_deferred_by_user';
  readonly verdict: 'conditional Go — Windows-only feasibility verified; macOS deferred-by-user';
  readonly admissions: {
    readonly development: 'admitted_with_conditions' | 'admitted';
    readonly lifecycle: 'admitted';
    readonly packaged: 'admitted';
  };
  readonly conditionalLimitations: readonly string[];
  readonly evidenceInputs: ReadonlyArray<{
    readonly evidenceId: string;
    readonly source: string;
    readonly classification: string;
    readonly sha256: string;
  }>;
  readonly task13Point1Unblocked: false;
  readonly task13Point2Authorized: false;
  readonly fullGoClaimed: false;
  readonly crossPlatformCompatibilityClaimed: false;
  readonly releaseReadinessClaimed: false;
};

export function evaluateBlock6aCertificationEvidence(
  records: readonly Record<string, unknown>[],
  options: {
    readonly verifyLineage: (
      record: Record<string, unknown>,
      index: number,
    ) => { readonly verified: true; readonly classification: 'evidence_lineage_verified' };
    readonly evidenceSha256?: (record: Record<string, unknown>, index: number) => string;
  },
): Block6aCertificationVerdict;

export function verifyBlock6aCertificationFilesAtRepository(
  evidencePaths: readonly string[],
  repositoryRoot: string,
  packagedArtifactRoot: string,
): Block6aCertificationVerdict;
