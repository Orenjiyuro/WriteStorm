export type Task135CompatibilityLayerName =
  | 'supplyChain'
  | 'productionProtocol'
  | 'probeArtifact';

export type Task135CompatibilityBoundary = {
  readonly schemaVersion: 2;
  readonly boundaryId: 'block13-task13-5-compatibility-v1';
  readonly layers: Readonly<Record<Task135CompatibilityLayerName, {
    readonly sourceDirectories: readonly string[];
    readonly sourceFiles: readonly string[];
  }>>;
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

export type Task135CompatibilityFingerprint = {
  readonly boundaryId: string;
  readonly gitHead?: string;
  readonly layers: Readonly<Record<Task135CompatibilityLayerName, {
    readonly files: readonly {
      readonly relativePath: string;
      readonly sha256: string;
    }[];
    readonly sha256: string;
  }>>;
  readonly sha256: string;
};

export type Task135CompatibilityEvaluation = {
  readonly status: 'fresh' | 'stale';
  readonly staleLayers: readonly Task135CompatibilityLayerName[];
  readonly layers: Readonly<Record<Task135CompatibilityLayerName, 'fresh' | 'stale'>>;
};

export type Task135ArtifactRecord = {
  readonly boundaryId: string;
  readonly files: readonly {
    readonly id: string;
    readonly relativePath: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly asarEntries: readonly {
    readonly id: string;
    readonly archiveRelativePath: string;
    readonly entryPath: string;
    readonly size: number;
    readonly sha256: string;
  }[];
  readonly sha256: string;
};

export function loadTask135CompatibilityBoundary(
  repositoryRoot: string,
): Task135CompatibilityBoundary;
export function createTask135CompatibilityFingerprint(
  repositoryRoot: string,
  boundary: Task135CompatibilityBoundary,
  gitHead?: string,
): Task135CompatibilityFingerprint;
export function evaluateTask135CompatibilityFreshness(
  current: Task135CompatibilityFingerprint,
  recorded: unknown,
): Task135CompatibilityEvaluation;
export function createTask135ArtifactRecord(
  artifactRoot: string,
  boundary: Task135CompatibilityBoundary,
): Task135ArtifactRecord;
export function assertTask135EvidenceMatches(input: {
  readonly evidence: unknown;
  readonly repositoryRoot: string;
  readonly artifactRoot: string;
  readonly boundary?: Task135CompatibilityBoundary;
}): {
  readonly compatibilityFingerprint: Task135CompatibilityFingerprint;
  readonly compatibility: Task135CompatibilityEvaluation;
  readonly artifact: Task135ArtifactRecord;
};
