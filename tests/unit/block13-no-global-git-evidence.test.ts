import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const evidencePath = path.join(
  rootDir,
  'docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json',
);

type Task135Evidence = {
  readonly evidenceId: string;
  readonly task: string;
  readonly classification: string;
  readonly gitHeadAtRun: string;
  readonly versions: Record<string, string>;
  readonly assertions: Record<string, boolean>;
  readonly environmentSummary: {
    readonly pathEntryCount: number;
    readonly valuesRecorded: boolean;
    readonly credentialsRecorded: boolean;
  };
  readonly artifact: {
    readonly boundaryId: string;
    readonly files: readonly {
      readonly id: string;
      readonly relativePath: string;
      readonly size: number;
      readonly sha256: string;
    }[];
    readonly asarEntries: readonly {
      readonly id: string;
      readonly archiveRelativePath: string;
      readonly entryPath: string;
      readonly size: number;
      readonly sha256: string;
    }[];
    readonly sha256: string;
  };
  readonly compatibilityFingerprint: {
    readonly boundaryId: string;
    readonly gitHead: string;
    readonly layers: Readonly<Record<
      'supplyChain' | 'productionProtocol' | 'probeArtifact',
      {
        readonly files: readonly {
          readonly relativePath: string;
          readonly sha256: string;
        }[];
        readonly sha256: string;
      }
    >>;
    readonly sha256: string;
  };
  readonly invocation: {
    readonly outerWhereGitUnavailable: boolean;
    readonly outerGetCommandGitUnavailable: boolean;
    readonly pathPolicy: string;
  };
};

describe('Block 13.5 packaged no-global-Git evidence', () => {
  const rawEvidence = readFileSync(evidencePath, 'utf8');
  const evidence = JSON.parse(rawEvidence) as Task135Evidence;

  it('records the exact Windows-only packaged result and pinned runtime versions', () => {
    expect(evidence).toMatchObject({
      evidenceId: 'block13-task13-5-windows-no-global-git-packaged-001',
      task: '13.5',
      classification: 'windows_packaged_no_global_git_verified',
      gitHeadAtRun: 'c6ee1086cc30691df03c2a95b37d414b0eba5940',
      versions: {
        electron: '43.0.0',
        codexSdk: '0.144.6',
        codexCli: '0.144.6',
        platformPackage: '0.144.6-win32-x64',
      },
      environmentSummary: {
        pathEntryCount: 3,
        valuesRecorded: false,
        credentialsRecorded: false,
      },
      invocation: {
        outerWhereGitUnavailable: true,
        outerGetCommandGitUnavailable: true,
        pathPolicy: 'windows-system-only-no-git-directories',
      },
    });
    expect(Object.values(evidence.assertions)).not.toContain(false);
  });

  it('binds the recorded compatibility files to their current bytes', () => {
    expect(evidence.compatibilityFingerprint.gitHead).toBe(evidence.gitHeadAtRun);
    for (const [layerName, layer] of Object.entries(
      evidence.compatibilityFingerprint.layers,
    )) {
      for (const entry of layer.files) {
        const currentHash = createHash('sha256')
          .update(normalizeSourceBytes(readFileSync(path.join(rootDir, entry.relativePath))))
          .digest('hex');
        expect(currentHash, entry.relativePath).toBe(entry.sha256);
      }
      const layerHash = createHash('sha256')
        .update(JSON.stringify({ layerName, files: layer.files }))
        .digest('hex');
      expect(layerHash, layerName).toBe(layer.sha256);
    }
    const fingerprintHash = createHash('sha256')
      .update(JSON.stringify({
        boundaryId: evidence.compatibilityFingerprint.boundaryId,
        layers: evidence.compatibilityFingerprint.layers,
      }))
      .digest('hex');
    expect(fingerprintHash).toBe(evidence.compatibilityFingerprint.sha256);
    expect(evidence.artifact.boundaryId).toBe(evidence.compatibilityFingerprint.boundaryId);
    expect(evidence.artifact.files.map((entry) => entry.id)).toEqual([
      'writestorm_executable',
      'app_asar',
      'codex_executable',
    ]);
    expect(evidence.artifact.asarEntries.map((entry) => entry.id)).toEqual([
      'certification_main_bundle',
      'codex_utility_bundle',
      'packaged_package_manifest',
    ]);
    for (const artifactEntry of [
      ...evidence.artifact.files,
      ...evidence.artifact.asarEntries,
    ]) {
      expect(artifactEntry.size).toBeGreaterThan(0);
      expect(artifactEntry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('contains no credential fields, prompt text, response body, path values or process IDs', () => {
    expect(rawEvidence).not.toMatch(/OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/i);
    expect(collectKeys(evidence)).not.toEqual(expect.arrayContaining([
      'accessToken',
      'refreshToken',
      'promptText',
      'responseBody',
      'processId',
      'utilityPath',
      'cliPath',
    ]));
  });

  it('keeps the same evidence identity in active technical records', () => {
    const technicalDesign = readFileSync(
      path.join(rootDir, 'docs/engineering/TECHNICAL_DESIGN.md'),
      'utf8',
    );
    const decisions = readFileSync(
      path.join(rootDir, 'docs/engineering/DECISIONS.md'),
      'utf8',
    );
    for (const document of [technicalDesign, decisions]) {
      expect(document).toContain('block13-task13-5-windows-no-global-git-packaged-001');
      expect(document).toContain('skipGitRepoCheck=true');
    }
    expect(decisions).toContain('## D099: Windows Packaged Codex Attempts Do Not Require Global Git');
    expect(decisions).toContain('## D102: Task 13.4–13.5 Review Gates Are Layered and Measured');
    expect(decisions).toContain('## D103: Offline DNS Promise Paths Are Blocked Without Transitive Imports');
  });
});

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
}

function normalizeSourceBytes(bytes: Buffer): Buffer {
  if (bytes.includes(0)) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}
