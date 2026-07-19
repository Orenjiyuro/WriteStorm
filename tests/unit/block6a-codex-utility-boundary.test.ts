import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';
import { PRODUCT_IPC_CHANNELS } from '../../src/shared/contracts';
import {
  isInsideProjectPlatformPackage,
  resolvePackagedCodexPath,
} from '../../src/main/codex-feasibility/utility-entry';

const rootDir = path.resolve(__dirname, '../..');
const utilityEntry = path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts');

describe('Block 6A.4 Codex utility boundary', () => {
  it('accepts only the exact adjacent ASAR-unpacked mirror of the project platform package', () => {
    const packageRoot = path.join(
      'C:\\package',
      'resources',
      'app.asar',
      'node_modules',
      '@openai',
      'codex-win32-x64',
    );
    expect(isInsideProjectPlatformPackage(
      path.join(packageRoot, 'vendor', 'bin', 'codex.exe'),
      packageRoot,
    )).toBe(true);
    expect(isInsideProjectPlatformPackage(
      path.join(
        'C:\\package',
        'resources',
        'app.asar.unpacked',
        'node_modules',
        '@openai',
        'codex-win32-x64',
        'vendor',
        'bin',
        'codex.exe',
      ),
      packageRoot,
    )).toBe(true);
    expect(isInsideProjectPlatformPackage('C:\\global\\codex.exe', packageRoot)).toBe(false);
    expect(isInsideProjectPlatformPackage(
      path.join(
        'C:\\package',
        'resources',
        'app.asar.unpacked',
        'node_modules',
        '@openai',
        'codex-darwin-arm64',
        'vendor',
        'codex',
      ),
      packageRoot,
    )).toBe(false);
  });

  it('uses only the exact packaged Windows CLI as the SDK path override', () => {
    const resourcesPath = 'C:\\package\\resources';
    let observedCandidate = '';
    const resolved = resolvePackagedCodexPath(resourcesPath, (candidate) => {
      observedCandidate = candidate;
      return true;
    });

    expect(resolved).toBe(observedCandidate);
    expect(observedCandidate).toBe(path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    ));
    expect(resolvePackagedCodexPath(resourcesPath, () => false)).toBeUndefined();
  });

  it('rejects malformed or secret-bearing protocol messages', () => {
    expect(isCodexFeasibilityRequest({
      version: 1,
      origin: 'main',
      requestId: 'request-1',
      command: 'inspect-runtime',
    })).toBe(true);
    expect(isCodexFeasibilityRequest({
      version: 1,
      origin: 'main',
      requestId: 'request-1',
      command: 'inspect-runtime',
      prompt: 'must be rejected',
    })).toBe(false);
    expect(isCodexFeasibilityResponse({
      version: 1,
      requestId: 'request-1',
      command: 'inspect-runtime',
      ok: false,
      utilityPid: 7,
      error: { code: 'SDK_IMPORT_FAILED', stderr: 'must be rejected' },
    })).toBe(false);
  });

  it('allows the SDK import only in the dedicated utility entry', () => {
    const sdkImporters = sourceFiles(path.join(rootDir, 'src')).filter((filePath) => {
      return importSpecifiers(readFileSync(filePath, 'utf8')).some((specifier) => (
        specifier === '@openai/codex-sdk' || specifier.startsWith('@openai/codex-sdk/')
      ));
    });
    const directCliImporters = sourceFiles(path.join(rootDir, 'src')).filter((filePath) => {
      return importSpecifiers(readFileSync(filePath, 'utf8')).some((specifier) => (
        specifier === '@openai/codex' || specifier.startsWith('@openai/codex/')
      ));
    });

    expect(sdkImporters).toEqual([utilityEntry]);
    expect(directCliImporters).toEqual([]);
  });

  it('keeps privileged imports and AI execution surfaces out of renderer, preload and shared', () => {
    const rendererFiles = sourceFiles(path.join(rootDir, 'src/renderer'));
    const preloadFiles = sourceFiles(path.join(rootDir, 'src/preload'));
    const sharedFiles = sourceFiles(path.join(rootDir, 'src/shared'));
    const rendererAndSharedOffenders = findForbiddenImports(
      [...rendererFiles, ...sharedFiles],
      ['electron', 'fs', 'node:fs', 'path', 'node:path', 'child_process', 'node:child_process'],
    );
    const preloadOffenders = findForbiddenImports(
      preloadFiles,
      ['fs', 'node:fs', 'path', 'node:path', 'child_process', 'node:child_process'],
    );
    const secretBearingIdentifiers = /\b(?:apiKey|accessToken|authToken|credentialValue|secretValue|secureStorageValue|codexSession)\b/;
    const secretBearingOffenders = [...rendererFiles, ...preloadFiles, ...sharedFiles].filter((filePath) => (
      secretBearingIdentifiers.test(readFileSync(filePath, 'utf8'))
    ));
    const preloadSource = preloadFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');

    expect(rendererAndSharedOffenders).toEqual([]);
    expect(preloadOffenders).toEqual([]);
    expect(secretBearingOffenders).toEqual([]);
    expect(PRODUCT_IPC_CHANNELS.filter((channel) => /ai|codex|openai|provider/i.test(channel))).toEqual([]);
    expect(preloadSource).not.toMatch(/@openai\/|codex|process\.env/i);

    expect(findForbiddenImportSpecifiers(
      "import { Codex } from '@openai/codex-sdk'; import fs from 'node:fs';",
      ['node:fs'],
    )).toEqual(['@openai/codex-sdk', 'node:fs']);
    expect(secretBearingIdentifiers.test('const accessToken = request.value')).toBe(true);
  });

  it('externalizes the SDK and CLI and packages only the approved Windows runtime paths', () => {
    const forgeConfig = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');
    const packageVerifier = readFileSync(
      path.join(rootDir, 'tests/verification/block6a-codex-package-boundary.test.ts'),
      'utf8',
    );
    const utilityViteConfig = readFileSync(
      path.join(rootDir, 'vite.codex-feasibility.config.ts'),
      'utf8',
    );

    expect(utilityViteConfig).toContain("'@openai/codex-sdk'");
    expect(utilityViteConfig).toContain("'@openai/codex'");
    expect(forgeConfig).toContain("entry: 'src/main/codex-feasibility/utility-entry.ts'");
    expect(forgeConfig).toContain("config: 'vite.codex-feasibility.config.ts'");
    expect(forgeConfig).toContain("'/node_modules/@openai/codex-sdk'");
    expect(forgeConfig).toContain("'/node_modules/@openai/codex'");
    expect(forgeConfig).toContain("'/node_modules/@openai/codex-win32-x64'");
    expect(forgeConfig).not.toMatch(/allowedPackageRuntimePaths[\s\S]*codex-(?:darwin|linux|win32-arm64)/);
    expect(forgeConfig).toContain(
      "'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc'",
    );
    expect(forgeConfig).toContain('unpackDir: windowsCodexRuntimeDirectory');
    expect(forgeConfig).toContain('**/*.node');
    expect(packageVerifier).toContain("from '@electron/asar'");
    expect(packageVerifier).toContain('app.asar.unpacked');
    expect(packageVerifier).toContain('.vite/renderer/main_window');
    expect(packageVerifier).toContain('codex-win32-x64/vendor/x86_64-pc-windows-msvc');
  });

  it('preserves the 6A.4 source/build boundary while recognizing later packaged proof', () => {
    const feasibility = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    const evidencePath = path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a4-utility-boundary.json',
    );

    expect(existsSync(evidencePath)).toBe(true);
    const records = JSON.parse(readFileSync(evidencePath, 'utf8')) as Array<{
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
    }>;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      source: 'static_manifest',
      classification: 'source_and_direct_build_boundary_verified_package_pending',
      assertions: {
        electronUtilityActuallyExecuted: false,
        packagedResourcesActuallyScanned: false,
        sdkTurnExecuted: false,
      },
    });
    expect(feasibility).toContain('## Task 6A.4 utility boundary and packaging rules');
    expect(feasibility).toContain('Task 6A.4 itself did not create or inspect an Electron package');
    expect(feasibility).toContain('Task 6A.8a later supplied the required packaged renderer, ASAR placement and real Electron SDK execution evidence');
    expect(feasibility).toContain('macOS package rules and runtime remain `deferred-by-user`');
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    return statSync(entryPath).isDirectory()
      ? sourceFiles(entryPath)
      : /\.(ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]|\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1] ?? match[2]);
  return specifiers;
}

function findForbiddenImportSpecifiers(source: string, forbiddenPackages: string[]): string[] {
  return importSpecifiers(source).filter((specifier) => (
    specifier.startsWith('@openai/') || forbiddenPackages.some((packageName) => (
      specifier === packageName || specifier.startsWith(`${packageName}/`)
    ))
  ));
}

function findForbiddenImports(files: string[], forbiddenPackages: string[]): string[] {
  return files.filter((filePath) => (
    findForbiddenImportSpecifiers(readFileSync(filePath, 'utf8'), forbiddenPackages).length > 0
  ));
}
