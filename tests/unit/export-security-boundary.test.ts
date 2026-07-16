import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const exportProductionDirectory = new URL('../../src/main/exports/', import.meta.url);

describe('Export status security boundary', () => {
  it('uses a narrow library read port instead of the filesystem-capable LibraryService', () => {
    const serviceSource = readFileSync(
      new URL('export-status-service.ts', exportProductionDirectory),
      'utf8',
    );

    expect(serviceSource).not.toContain('../library/library-service');
    expect(serviceSource).toContain('ExportStatusLibraryReadPort');
    expect(serviceSource).toContain('../library/library-unit-of-work');
  });

  it('does not read sensitive sources anywhere in its runtime dependency graph', () => {
    const productionFiles = listTypeScriptFiles(exportProductionDirectory);
    const source = collectRuntimeDependencyGraph(productionFiles)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    for (const forbiddenPattern of [
      /\bprocess\.env\b/,
      /\bsafeStorage\b/,
      /\bsecureStorage\b/,
      /from ['"]node:fs/,
      /from ['"]electron['"]/,
      /\b(?:get|read|load)(?:Credential|AuthenticationToken|AuthToken|SecretKey)\b/i,
      /\blog(?:Body|Entry|Content)\b/i,
    ]) {
      expect(source).not.toMatch(forbiddenPattern);
    }
  });

  it('allows only reviewed runtime imports at the Export boundary', () => {
    const allowedImports = new Set([
      '../../shared/contracts',
      '../../shared/domain',
      '../../shared/errors',
      '../modules/analysis-module-instance-repository',
      '../modules/analysis-module-repository',
      './export-status-calculator',
      './export-status-repository',
      './export-status-service',
    ]);
    const runtimeImports = listTypeScriptFiles(exportProductionDirectory)
      .flatMap((file) => runtimeImportSpecifiers(readFileSync(file, 'utf8')))
      .filter((specifier) => !specifier.startsWith('node:'));

    expect(runtimeImports.every((specifier) => allowedImports.has(specifier))).toBe(true);
  });
});

function listTypeScriptFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) return listTypeScriptFiles(child);
    return entry.name.endsWith('.ts') ? [child] : [];
  });
}

function collectRuntimeDependencyGraph(entries: readonly URL[]): URL[] {
  const visited = new Map<string, URL>();
  const pending = [...entries];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file.href)) continue;
    visited.set(file.href, file);
    for (const specifier of runtimeImportSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const dependency = resolveTypeScriptImport(file, specifier);
      if (dependency) pending.push(dependency);
    }
  }

  return [...visited.values()];
}

function runtimeImportSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/\bimport\s+(?!type\b)[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
}

function resolveTypeScriptImport(importer: URL, specifier: string): URL | null {
  const base = new URL(specifier, importer);
  for (const candidate of [
    new URL(`${base.href}.ts`),
    new URL(`${base.href}.tsx`),
    new URL(`${base.href}/index.ts`),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
