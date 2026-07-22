export type Block6aCertificationStaging = {
  readonly stagingRoot: string;
  readonly finalRoot: string;
};

export function assertBlock6aWindowsArtifactRootPathBudget(artifactRoot: string): string;

export function createBlock6aCertificationStaging(
  publishRoot: string,
  certificationId: string,
): Block6aCertificationStaging;

export function finalizeBlock6aCertificationBundle(options: {
  readonly certificationId: string;
  readonly stagingRoot: string;
  readonly finalRoot: string;
  readonly artifactRoot: string;
  readonly evidencePaths: readonly string[];
  readonly verdict: Record<string, unknown> & {
    readonly verified: true;
    readonly classification: 'conditional_go_windows_only_macos_deferred_by_user';
  };
  readonly gitHeadAtRun: string;
}): {
  readonly finalRoot: string;
  readonly artifactSha256: string;
  readonly artifactManifestSha256: string;
  readonly bundleManifestSha256: string;
};
