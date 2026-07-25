export type Task1311ProductArtifactBoundary = {
  readonly schemaVersion: 1;
  readonly boundaryId: 'block13-task13-11-product-artifact-v1';
  readonly artifactFiles: readonly {
    readonly id: string;
    readonly relativePath: string;
  }[];
  readonly asarEntries: readonly {
    readonly id: string;
    readonly archiveRelativePath: string;
    readonly entryPath: string;
  }[];
};

export type Task1311ProductArtifactRecord = {
  readonly boundaryId: string;
  readonly files: readonly {
    readonly id: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly asarEntries: readonly {
    readonly id: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly sha256: string;
};

export type Task1311CompactCompatibilityFingerprint = {
  readonly boundaryId: string;
  readonly gitHead: string | undefined;
  readonly layers: {
    readonly supplyChain: string;
    readonly productionProtocol: string;
    readonly probeArtifact: string;
  };
  readonly sha256: string;
};

export function loadTask1311ProductArtifactBoundary(
  repositoryRoot: string,
): Task1311ProductArtifactBoundary;
export function createTask1311ProductArtifactRecord(
  artifactRoot: string,
  boundary: Task1311ProductArtifactBoundary,
): Task1311ProductArtifactRecord;
export function assertTask1311CertificationBuildArtifact(
  artifactRoot: string,
  boundary: Task1311ProductArtifactBoundary,
  compatibilityFingerprint: string,
): void;
export function compactTask1311CompatibilityFingerprint(fingerprint: {
  readonly boundaryId: string;
  readonly gitHead?: string;
  readonly layers: {
    readonly supplyChain: {
      readonly sha256: string;
      readonly files?: readonly unknown[];
    };
    readonly productionProtocol: {
      readonly sha256: string;
      readonly files?: readonly unknown[];
    };
    readonly probeArtifact: {
      readonly sha256: string;
      readonly files?: readonly unknown[];
    };
  };
  readonly sha256: string;
}): Task1311CompactCompatibilityFingerprint;

export const task1311RuntimeAttestationFile:
  'writestorm-ai-runtime-attestation-v1.json';

export function createTask1311RuntimeAttestation(
  compatibilityFingerprint: Task1311CompactCompatibilityFingerprint,
  artifact: Task1311ProductArtifactRecord,
): {
  readonly schemaVersion: 1;
  readonly authority: 'block13-runtime-artifact-attestation-v1';
  readonly platform: 'win32';
  readonly architecture: 'x64';
  readonly compatibilityFingerprint: string;
  readonly artifact: {
    readonly boundaryId: string;
    readonly files: Task1311ProductArtifactRecord['files'];
    readonly sha256: string;
  };
};
