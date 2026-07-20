export type Block6aEvidenceInputHash = {
  readonly evidenceId: string;
  readonly sha256: string;
};

export type Block6aEvidenceLineage = {
  readonly gitHeadAtRun: string;
  readonly criticalInputsCleanAtRun: boolean;
  readonly packageLockSha256: string;
  readonly runtimeBoundarySha256: string;
  readonly packagedArtifactSha256: string | null;
  readonly evidenceInputs: readonly Block6aEvidenceInputHash[];
};

export function createBlock6aLineageSnapshot(
  repositoryRoot: string,
  mode: string,
  packagedArtifactRoot?: string,
): Block6aEvidenceLineage;

export function verifyBlock6aEvidenceLineageAtRepository(
  lineage: Block6aEvidenceLineage,
  repositoryRoot: string,
  packagedArtifactRoot?: string,
): { readonly verified: true; readonly classification: 'evidence_lineage_verified' };

export function evaluateBlock6aEvidenceLineage(
  lineage: Block6aEvidenceLineage,
  current: {
    readonly finalHead: string;
    readonly isRunHeadAncestor: boolean;
    readonly changedPaths: readonly string[];
    readonly packageLockSha256: string;
    readonly runtimeBoundarySha256: string;
    readonly packagedArtifactSha256: string | null;
    readonly evidenceInputs: readonly Block6aEvidenceInputHash[];
  },
): { readonly verified: true; readonly classification: 'evidence_lineage_verified' };

export function isAllowedBlock6aEvidenceOnlyPath(filePath: string): boolean;
