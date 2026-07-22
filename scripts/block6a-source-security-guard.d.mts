export type Block6aModuleLoad = {
  readonly kind: 'import' | 'export' | 'import-type' | 'dynamic-import' | 'require';
  readonly specifier: string | null;
};

export function findRestrictedModuleLoads(
  source: string,
  forbiddenPackages: readonly string[],
): Block6aModuleLoad[];
