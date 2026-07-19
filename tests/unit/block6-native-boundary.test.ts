import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.join(rootDir, 'src');
const mainDbDir = path.join(srcDir, 'main', 'db');

describe('Block 6 native SQLite boundary', () => {
  it('declares better-sqlite3 as a production dependency and externalizes it from the main Vite bundle', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const mainViteConfig = readFileSync(path.join(rootDir, 'vite.main.config.ts'), 'utf8');

    expect(packageJson.dependencies?.['better-sqlite3']).toMatch(/^\^?\d+\.\d+\.\d+/);
    expect(packageJson.devDependencies?.['better-sqlite3']).toBeUndefined();
    expect(mainViteConfig).toContain('rollupOptions');
    expect(mainViteConfig).toContain('better-sqlite3');
  });

  it('packages external native SQLite runtime dependencies instead of falling back to workspace node_modules', () => {
    const forgeConfig = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');

    expect(forgeConfig).toContain('allowedPackageRuntimePaths');
    expect(forgeConfig).toContain('/node_modules/better-sqlite3');
    expect(forgeConfig).toContain('/node_modules/bindings');
    expect(forgeConfig).toContain('/node_modules/file-uri-to-path');
    expect(forgeConfig).toContain("'**/*.node'");
    expect(forgeConfig).toContain('asarUnpackPattern');
  });

  it('keeps direct better-sqlite3 imports inside DB adapters and the read-only library probe', () => {
    const readOnlyProbePath = path.join(srcDir, 'main', 'library', 'library-database-probe.ts');
    const offenders = sourceFiles(srcDir).filter((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const importsBetterSqlite = importSpecifiers(source).some((specifier) => specifier === 'better-sqlite3');

      return importsBetterSqlite && !isInside(filePath, mainDbDir) && filePath !== readOnlyProbePath;
    });

    expect(offenders.map((filePath) => path.relative(rootDir, filePath))).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return sourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1] ?? match[2]);
  }

  return specifiers;
}

function isInside(filePath: string, dir: string): boolean {
  const relative = path.relative(dir, filePath);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
