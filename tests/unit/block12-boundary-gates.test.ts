import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_IPC_CHANNELS } from '../../src/shared/contracts';
import {
  ANALYSIS_CONFIGURATION_SNAPSHOT_POLICY,
  ORIGINAL_REFERENCE_SNAPSHOT_POLICY,
  TECHNIQUE_EVIDENCE_CHAIN_POLICY,
} from '../../src/shared/domain';

const rootDirectory = path.resolve(__dirname, '../..');
const rendererDirectory = path.join(rootDirectory, 'src', 'renderer');

describe('Block 12 Task 12.14 cross-domain boundary gates', () => {
  it('keeps TechniqueEntry source provenance readonly and exposes no source mutation channel', () => {
    expect(TECHNIQUE_EVIDENCE_CHAIN_POLICY.techniqueEntry).toMatchObject({
      sourceSnapshotField: 'sourceSnapshot',
      mayUseEvidenceAnchorIds: false,
      mayMutateSourceEvidenceState: false,
      sourceEvidenceStateIsReadonly: true,
    });
    expect(PRODUCT_IPC_CHANNELS.filter(isTechniqueSourceMutationChannel)).toEqual([]);
    expect(isTechniqueSourceMutationChannel('techniques:update-source-evidence')).toBe(true);
    expect(isTechniqueSourceMutationChannel('techniques:write-observation')).toBe(true);
    expect(isTechniqueSourceMutationChannel('technique-library:update-source')).toBe(true);
  });

  it('keeps the Original shelf non-creating at domain and product boundaries', () => {
    expect(ORIGINAL_REFERENCE_SNAPSHOT_POLICY).toMatchObject({
      followsSourceMutations: false,
      createsOriginalBookData: false,
    });
    expect(PRODUCT_IPC_CHANNELS.filter(isOriginalCreationChannel)).toEqual([]);
    expect(isOriginalCreationChannel('originals:create-project')).toBe(true);
    expect(isOriginalCreationChannel('original-books:create')).toBe(true);
    expect(isOriginalCreationChannel('original-writing:generate')).toBe(true);

    const routeSource = readFileSync(
      path.join(rendererDirectory, 'routes', 'OriginalShelfRoute.tsx'),
      'utf8',
    );
    expect(routeSource).not.toMatch(/onCreate|onClick=|createOriginal|createProject/);
  });

  it('keeps every renderer import outside privileged and AI runtime boundaries', () => {
    const violations = sourceFiles(rendererDirectory).flatMap((filePath) =>
      importSpecifiers(readFileSync(filePath, 'utf8'))
        .filter((specifier) => isForbiddenRendererImport(filePath, specifier))
        .map((specifier) => ({
          file: path.relative(rootDirectory, filePath),
          specifier,
        })),
    );

    expect(violations).toEqual([]);
    for (const [filePath, specifier] of [
      ['src/renderer/probe.ts', 'node:fs'],
      ['src/renderer/probe.ts', 'better-sqlite3'],
      ['src/renderer/probe.ts', '@openai/codex-sdk'],
      ['src/renderer/probe.ts', '../main/db/sqlite'],
      ['src/renderer/probe.ts', '../preload/writestorm-api'],
    ] as const) {
      expect(isForbiddenRendererImport(path.join(rootDirectory, filePath), specifier)).toBe(true);
    }
    expect(importSpecifiers("const fileSystem = require('node:fs');")).toEqual(['node:fs']);
    expect(importSpecifiers('const electron = require("electron");')).toEqual(['electron']);

    expect(PRODUCT_IPC_CHANNELS.filter(isSensitiveOrAiChannel)).toEqual([]);
    for (const channel of [
      'codex:run',
      'secrets:get-token',
      'ai:run',
      'fs:read',
      'logging:upload',
      'observability:export',
      'crash-reports:upload',
      'telemetry:send',
    ]) {
      expect.soft(isSensitiveOrAiChannel(channel), channel).toBe(true);
    }
  });

  it('requires a new immutable snapshot and explicit impact plan instead of silent rerun', () => {
    expect(ANALYSIS_CONFIGURATION_SNAPSHOT_POLICY).toMatchObject({
      snapshotsAreImmutable: true,
      upgradesCreateNewSnapshot: true,
      upgradesRequireImpactPlan: true,
      selectiveRebuildOnly: true,
      completeRerunRequiresExplicitConfirmation: true,
      persistence: 'not_admitted',
    });
    expect(PRODUCT_IPC_CHANNELS.filter(isSilentTemplateUpgradeChannel)).toEqual([]);
    expect(isSilentTemplateUpgradeChannel('templates:upgrade-books')).toBe(true);
    expect(isSilentTemplateUpgradeChannel('templates:bulk-upgrade')).toBe(true);
    expect(isSilentTemplateUpgradeChannel('analysis-configuration:auto-rerun')).toBe(true);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) return sourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2] ?? match[3]);
  }
  return specifiers;
}

function isForbiddenRendererImport(importerPath: string, specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  if (['fs', 'path', 'child_process', 'electron', 'better-sqlite3', 'keytar'].includes(specifier)) {
    return true;
  }
  if (specifier.startsWith('@openai/') || specifier.includes('codex')) return true;
  if (!specifier.startsWith('.')) return false;

  const resolved = path.resolve(path.dirname(importerPath), specifier);
  return isInside(resolved, path.join(rootDirectory, 'src', 'main')) ||
    isInside(resolved, path.join(rootDirectory, 'src', 'preload')) ||
    isInside(resolved, path.join(rootDirectory, 'src', 'utility'));
}

function isTechniqueSourceMutationChannel(channel: string): boolean {
  return /^(?:techniques?|technique-library):/.test(channel) &&
    /(source|evidence|observation)/.test(channel) &&
    /(write|update|mutate|delete|replace)/.test(channel);
}

function isOriginalCreationChannel(channel: string): boolean {
  return /^(?:originals?|original-projects?|original-books?|original-writing):/.test(channel) &&
    /(create|import|generate|write)/.test(channel);
}

function isSensitiveOrAiChannel(channel: string): boolean {
  return /^(?:ai|codex|llm|models?|providers?|secrets?|credentials?|tokens?|secure-storage|fs|filesystem|file-system|shell|logging|logs|observability|crash-reports?|telemetry|usage-statistics):/.test(channel) ||
    /(secret|credential|token|secure-storage|filesystem|file-system|shell)/.test(channel);
}

function isSilentTemplateUpgradeChannel(channel: string): boolean {
  return /^(?:templates?|prompt-templates?|prompt-template-registry|analysis-configuration):/.test(channel) &&
    /(bulk-upgrade|upgrade-(?:all-)?books?|auto(?:matic)?-rerun|silent-rerun|rewrite-(?:book-)?snapshots?)/.test(channel);
}

function isInside(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
