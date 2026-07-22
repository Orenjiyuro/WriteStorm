export const APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES: readonly string[];

export function evaluateWindowsPlatformRuntimeFiles(
  observedFiles: readonly string[],
): {
  readonly passed: boolean;
  readonly missing: string[];
  readonly extra: string[];
  readonly duplicates: string[];
};
