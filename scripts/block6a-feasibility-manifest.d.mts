export const BLOCK6A_FEASIBILITY_MANIFEST_RELATIVE_PATH:
  'config/block6a-feasibility-manifest-v1.json';

export type Block6aFeasibilityManifest = {
  readonly schemaVersion: 1;
  readonly manifestId: string;
  readonly versions: {
    readonly codexSdk: string;
    readonly codexCli: string;
    readonly platformPackage: string;
  };
  readonly syntheticFixture: {
    readonly path: string;
    readonly fixtureId: string;
    readonly inputSha256: string;
    readonly expectedSha256: string;
    readonly inputMaximumLength: number;
    readonly expectedMaximumLength: number;
  };
  readonly staticEvidenceInputs: readonly {
    readonly key: string;
    readonly evidenceId: string;
    readonly path: string;
  }[];
  readonly runtimeEvidence: {
    readonly capability: string;
    readonly outputSchema: string;
    readonly lifecycle: Readonly<Record<string, string>>;
    readonly packaged: string;
  };
  readonly windowsPlatformRuntimeFiles: readonly string[];
  readonly verdict: { readonly classification: string; readonly text: string };
};

export const BLOCK6A_FEASIBILITY_MANIFEST: Block6aFeasibilityManifest;
export function loadBlock6aFeasibilityManifest(repositoryRoot: string): Block6aFeasibilityManifest;
