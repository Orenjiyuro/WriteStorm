import { BLOCK6A_FEASIBILITY_MANIFEST } from './block6a-feasibility-manifest.mjs';

export const APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES = Object.freeze([
  ...BLOCK6A_FEASIBILITY_MANIFEST.windowsPlatformRuntimeFiles,
]);

/**
 * @param {readonly string[]} observedFiles
 * @returns {{
 *   readonly passed: boolean,
 *   readonly missing: string[],
 *   readonly extra: string[],
 *   readonly duplicates: string[],
 * }}
 */
export function evaluateWindowsPlatformRuntimeFiles(observedFiles) {
  const normalized = observedFiles.map((file) => file.replaceAll('\\', '/'));
  const counts = new Map();
  for (const file of normalized) counts.set(file, (counts.get(file) ?? 0) + 1);

  const approved = new Set(APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES);
  const observed = new Set(normalized);
  const missing = APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES.filter((file) => !observed.has(file));
  const extra = [...observed].filter((file) => !approved.has(file)).sort();
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([file]) => file)
    .sort();

  return {
    passed: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    missing,
    extra,
    duplicates,
  };
}
