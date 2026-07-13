import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWritestormPreloadApi } from '../../src/preload/writestorm-api';
import {
  CONTRACT_REGISTRY,
  PRODUCT_IPC_CHANNELS,
  getContract,
  type ContractRequest,
  type ProductIpcChannel,
  type WritestormApi,
} from '../../src/shared/contracts';
import { createNotImplementedError } from '../../src/shared/errors';
import type {
  AnalysisModuleInstanceId,
  BreakdownBookId,
  JobId,
  StorySegmentRangeId,
  StructureNodeId,
} from '../../src/shared/domain';

type AssertExact<TActual, TExpected> = (<T>() => T extends TActual ? 1 : 2) extends <
  T,
>() => T extends TExpected ? 1 : 2
  ? (<T>() => T extends TExpected ? 1 : 2) extends <T>() => T extends TActual ? 1 : 2
    ? true
    : false
  : false;

type AssertTrue<T extends true> = T;

const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.join(rootDir, 'src');
const mainDir = path.join(srcDir, 'main');
const preloadDir = path.join(srcDir, 'preload');
const rendererDir = path.join(srcDir, 'renderer');
const sharedDir = path.join(srcDir, 'shared');

const bookId = 'book-1' as BreakdownBookId;
const nodeId = 'node-1' as StructureNodeId;
const rangeId = 'range-1' as StorySegmentRangeId;
const instanceId = 'instance-1' as AnalysisModuleInstanceId;
const jobId = 'job-1' as JobId;

const importSourceRequest = {
  title: 'Example Book',
} satisfies ContractRequest<'books:import-source'>;
const bookRequest = { bookId } satisfies ContractRequest<'structure:get'>;
const updateNodeRequest = {
  nodeId,
  patch: {
    title: 'Renamed Chapter',
  },
} satisfies ContractRequest<'structure:update-node'>;
const updateStoryRangeRequest = {
  rangeId,
  patch: {
    confidence: 0.75,
  },
} satisfies ContractRequest<'structure:update-story-range'>;
const updateBodyRequest = {
  instanceId,
  body: 'Updated body',
} satisfies ContractRequest<'modules:update-body'>;
const jobRequest = { jobId } satisfies ContractRequest<'jobs:get'>;

describe('IPC boundary consistency gate', () => {
  it('keeps renderer Window.writestorm exactly aligned with the shared preload API type', () => {
    const typeGate: AssertTrue<AssertExact<Window['writestorm'], WritestormApi>> = true;

    expect(typeGate).toBe(true);
  });

  it('keeps the registry allowlist and preload product methods in lockstep', async () => {
    const calls: Array<{ channel: ProductIpcChannel; request: unknown }> = [];
    const api = createWritestormPreloadApi(async (channel, request) => {
      if (channel === 'internal:health') {
        return { ok: true, app: 'WriteStorm' };
      }

      const contract = getContract(channel);
      const response = {
        ok: false,
        error: createNotImplementedError(channel),
      };

      expect(contract.request.safeParse(request).success).toBe(true);
      expect(contract.response.safeParse(response).success).toBe(true);
      calls.push({ channel, request });

      return response;
    });

    await invokeEveryProductMethod(api);

    expect(Object.keys(CONTRACT_REGISTRY)).toEqual([...PRODUCT_IPC_CHANNELS]);
    expect(calls.map((call) => call.channel)).toEqual([...PRODUCT_IPC_CHANNELS]);
    expect(new Set(calls.map((call) => call.channel)).size).toBe(PRODUCT_IPC_CHANNELS.length);
  });

  it('keeps shared, renderer, and preload imports inside their allowed process boundaries', () => {
    const offenders = [
      ...collectImportOffenders(sourceFiles(sharedDir), sharedImportRule),
      ...collectImportOffenders(sourceFiles(rendererDir), rendererImportRule),
      ...collectImportOffenders(sourceFiles(preloadDir), preloadImportRule),
    ];

    expect(offenders).toEqual([]);
  });

  it('keeps domain code independent from wire contracts after contract decomposition', () => {
    const domainDir = path.join(sharedDir, 'domain');
    const contractImports = sourceFiles(domainDir).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');

      return importSpecifiers(source)
        .filter((specifier) => specifier.includes('contracts/'))
        .map((specifier) => `${path.relative(rootDir, filePath)} -> ${specifier}`);
    });

    expect(contractImports).toEqual([]);
    const compatibilityBridge = readFileSync(
      path.join(sharedDir, 'contracts', 'schemas.ts'),
      'utf8',
    );
    expect(compatibilityBridge).toContain('Temporary Block 8 compatibility bridge');
    expect(compatibilityBridge).not.toContain('z.object');
    expect(compatibilityBridge).not.toContain('z.ZodType');
  });
});

async function invokeEveryProductMethod(api: WritestormApi): Promise<void> {
  await api.library.create();
  await api.library.open();
  await api.library.getCurrent();
  await api.books.list();
  await api.books.importSource(importSourceRequest);
  await api.structure.get(bookRequest);
  await api.structure.detect(bookRequest);
  await api.structure.updateNode(updateNodeRequest);
  await api.structure.updateStoryRange(updateStoryRangeRequest);
  await api.structure.freeze(bookRequest);
  await api.modules.listInstances(bookRequest);
  await api.modules.updateBody(updateBodyRequest);
  await api.jobs.list({ bookId });
  await api.jobs.get(jobRequest);
  await api.jobs.cancel(jobRequest);
  await api.exports.getStatus(bookRequest);
}

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

type ImportRule = (filePath: string, specifier: string) => string | null;

function collectImportOffenders(files: string[], rule: ImportRule): string[] {
  return files.flatMap((filePath) => {
    const source = readFileSync(filePath, 'utf8');

    return importSpecifiers(source).flatMap((specifier) => {
      const reason = rule(filePath, specifier);

      return reason ? [`${path.relative(rootDir, filePath)} -> ${specifier} (${reason})`] : [];
    });
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

function sharedImportRule(filePath: string, specifier: string): string | null {
  if (isPackageImport(specifier, ['electron', 'react', 'react-dom', 'better-sqlite3', 'sqlite3', '@openai/codex'])) {
    return 'shared cannot import process, UI, SQLite, or Codex packages';
  }

  if (isNodePrivilegedImport(specifier)) {
    return 'shared cannot import Node privileged modules';
  }

  if (pointsInside(filePath, specifier, [mainDir, preloadDir, rendererDir])) {
    return 'shared cannot import main, preload, or renderer source';
  }

  return null;
}

function rendererImportRule(filePath: string, specifier: string): string | null {
  if (isPackageImport(specifier, ['electron', 'better-sqlite3', 'sqlite3', '@openai/codex'])) {
    return 'renderer cannot import Electron, SQLite, or Codex packages';
  }

  if (isNodePrivilegedImport(specifier)) {
    return 'renderer cannot import Node privileged modules';
  }

  if (pointsInside(filePath, specifier, [mainDir, preloadDir])) {
    return 'renderer cannot import main or preload source';
  }

  return null;
}

function preloadImportRule(filePath: string, specifier: string): string | null {
  const isPreloadEntry = path.normalize(filePath) === path.join(preloadDir, 'index.ts');

  if (specifier === 'electron' && !isPreloadEntry) {
    return 'only preload entry may import Electron';
  }

  if (isPackageImport(specifier, ['react', 'react-dom', 'better-sqlite3', 'sqlite3', '@openai/codex'])) {
    return 'preload cannot import UI, SQLite, or Codex packages';
  }

  if (isNodePrivilegedImport(specifier)) {
    return 'preload cannot import Node privileged modules';
  }

  if (pointsInside(filePath, specifier, [mainDir, rendererDir])) {
    return 'preload cannot import main or renderer source';
  }

  return null;
}

function isPackageImport(specifier: string, packages: string[]): boolean {
  return packages.some((packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`));
}

function isNodePrivilegedImport(specifier: string): boolean {
  return isPackageImport(specifier, [
    'node:fs',
    'node:path',
    'node:child_process',
    'fs',
    'path',
    'child_process',
  ]);
}

function pointsInside(filePath: string, specifier: string, dirs: string[]): boolean {
  if (!specifier.startsWith('.')) {
    return false;
  }

  const resolved = path.resolve(path.dirname(filePath), specifier);

  return dirs.some((dir) => {
    const relative = path.relative(dir, resolved);

    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}
