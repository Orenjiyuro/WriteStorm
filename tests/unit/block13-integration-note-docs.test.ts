import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const readText = (relativePath: string): string =>
  readFileSync(path.join(rootDir, relativePath), 'utf8');
const readJson = <T>(relativePath: string): T =>
  JSON.parse(readText(relativePath)) as T;

const context = readText('docs/engineering/CONTEXT.md');
const decisions = readText('docs/engineering/DECISIONS.md');
const status = readText('docs/engineering/V1-BLOCK-13-STATUS.md');
const technicalDesign = readText('docs/engineering/TECHNICAL_DESIGN.md');
const packageJson = readJson<{
  dependencies: Record<string, string>;
  engines: { node: string };
}>('package.json');
const packageLock = readJson<{
  packages: Record<string, {
    version?: string;
    resolved?: string;
    integrity?: string;
    scripts?: Record<string, string>;
  }>;
}>('package-lock.json');
const gate = readJson<{
  feasibility: string;
  platform: string;
  overallVerdict: string;
  verdictText: string;
}>('config/block13-ai-gate-v1.json');
const limitations = readJson<Record<string, unknown>>(
  'config/block13-release-limitations-v1.json',
);
const productEvidence = readJson<{
  compatibilityFingerprint: { gitHead: string; sha256: string };
  artifact: { sha256: string };
}>('docs/engineering/evidence/block13-task13-11-windows-product-packaged-001.json');
const noGitEvidence = readJson<{
  evidenceId: string;
  gitHeadAtRun: string;
  compatibilityFingerprint: { sha256: string };
  artifact: { sha256: string };
}>('docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json');

describe('Block 13.13 integration note', () => {
  it('keeps the exact versioned platform-limited Gate while evidence acceptance is pending', () => {
    expect(gate).toMatchObject({
      feasibility: 'windows_passed',
      platform: 'macos_deferred',
      overallVerdict: 'conditional_go',
    });
    expect(context).toContain(gate.verdictText);
    expect(status).toContain(gate.verdictText);
    expect(decisions).toContain(gate.verdictText);
    expect(status).toContain(
      'Status: Current Windows recertification evidence produced; total-thread acceptance required',
    );
    expect(status).toContain('| 13.13 | REOPENED; EVIDENCE ACCEPTANCE REQUIRED |');
    expect(context).toContain('Tasks 13.3–13.13');
    expect(decisions).toContain(
      '## D116: Block 13 Closes Under the Versioned Windows Conditional Gate',
    );
    expect(decisions).toContain(
      '## D117: Block 13 Review Remediation Makes Artifact Admission Exact',
    );
    expect(decisions).toContain(
      '## D118: Artifact Receipts Prove Byte Equality, Not Probe Provenance',
    );
    expect(decisions).toContain(
      '## D119: Current Windows Recertification Evidence Awaits Total-Thread Acceptance',
    );
    expect(technicalDesign).toContain(productEvidence.compatibilityFingerprint.gitHead);
    expect(technicalDesign).toContain(productEvidence.compatibilityFingerprint.sha256);
    expect(technicalDesign).toContain('await total-thread provenance acceptance');
  });

  it('records the pinned supply-chain source without changing dependencies', () => {
    const sdk = packageLock.packages['node_modules/@openai/codex-sdk'];
    const cli = packageLock.packages['node_modules/@openai/codex'];
    const platform = packageLock.packages['node_modules/@openai/codex-win32-x64'];

    expect(packageJson.dependencies['@openai/codex-sdk']).toBe('0.144.6');
    expect(packageJson.engines.node).toBe('>=22.12.0');
    expect(sdk.version).toBe('0.144.6');
    expect(cli.version).toBe('0.144.6');
    expect(platform.version).toBe('0.144.6-win32-x64');
    for (const entry of [sdk, cli, platform]) {
      expect(entry.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\/@openai\//);
      expect(entry.integrity).toMatch(/^sha512-/);
      expect(entry.scripts).toBeUndefined();
    }

    expect(status).toContain('`@openai/codex-sdk` `0.144.6`');
    expect(status).toContain('`@openai/codex` `0.144.6`');
    expect(status).toContain('`0.144.6-win32-x64`');
    expect(status).toContain('`package.json` and `package-lock.json`');
    expect(status).toContain('resolved registry source, integrity and dependency tree');
  });

  it('records both current Windows recertification evidence records without self-accepting them', () => {
    expect(productEvidence.compatibilityFingerprint.gitHead).toBe(
      noGitEvidence.gitHeadAtRun,
    );
    expect(productEvidence.compatibilityFingerprint.sha256).toBe(
      noGitEvidence.compatibilityFingerprint.sha256,
    );
    for (const value of [
      noGitEvidence.evidenceId,
      productEvidence.compatibilityFingerprint.gitHead,
      productEvidence.compatibilityFingerprint.sha256,
      productEvidence.artifact.sha256,
      noGitEvidence.artifact.sha256,
      'docs/engineering/evidence/block13-task13-11-windows-product-packaged-001.json',
      'docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json',
    ]) {
      expect(status).toContain(value);
    }
  });

  it('makes every compatibility drift and observation invalidation fail closed', () => {
    expect(status).toContain('supplyChain');
    expect(status).toContain('productionProtocol');
    expect(status).toContain('probeArtifact');
    expect(status).toContain(
      'SDK, CLI, platform binary, lockfile integrity, Node, Electron, Forge/Vite',
    );
    expect(status).toContain(
      'utility protocol, Gate projection, packaging boundary or evidence artifact',
    );
    expect(status).toContain('stale/blocked');
    expect(status).toContain(
      'Fingerprint drift immediately invalidates the prior auth/runtime observation',
    );
    expect(status).toContain(
      'Application restart and each newly admitted attempt begin from `unknown`',
    );
  });

  it('retains the exact deferred and unverified release limitations', () => {
    expect(limitations).toMatchObject({
      platforms: {
        windows: {
          productPackagedRuntime: 'current_recertification_evidence_pending_acceptance',
          cleanMachine: 'unverified',
          signing: 'unverified',
          defender: 'unverified',
        },
        macos: {
          productPackagedRuntime: 'deferred_by_user',
          signing: 'unverified',
          notarization: 'unverified',
        },
      },
      environments: {
        proxy: 'unverified',
        enterpriseCertificates: 'unverified',
        firewall: 'unverified',
        offline: 'unverified',
      },
      telemetry: {
        sdkTelemetry: 'unverified',
      },
      distribution: {
        sdkCliLicensesAndNotices: 'unverified',
        artifactReceiptProvenance: 'workflow_only_not_cryptographically_verified',
      },
    });
    for (const term of [
      'clean-machine',
      'signing',
      'notarization',
      'Defender',
      'proxy',
      'enterprise certificates',
      'firewall',
      'offline',
      'SDK telemetry',
      'SDK/CLI licenses and notices',
    ]) {
      expect(status).toContain(term);
    }
  });

  it('keeps fallback, production execution and persistence outside Block 13', () => {
    for (const prohibition of [
      'direct product `codex exec`',
      'app-server',
      'GUI automation',
      'API-key auth',
      'local-model provider',
      'alternate-provider fallback',
      'production AI Job',
      'JobCheckpoint',
      'AnalysisModuleInstance',
      'SQLite write or migration',
      'durable checkpoint',
      'resumable result',
      'automatic retry',
    ]) {
      expect(status).toContain(prohibition);
    }
    expect(status).toContain('Default regression remains offline');
    expect(status).toContain(
      'Real SDK/auth/network probes remain separate, explicit and separately authorized',
    );
  });

  it('does not overstate the active conclusion while preserving historical records', () => {
    const integrationNote = status.slice(status.indexOf('## Task 13.13 Integration note'));
    const activeConclusion = [
      status.match(/^Current verdict:.*$/m)?.[0] ?? '',
      integrationNote,
    ].join('\n');
    expect(activeConclusion).not.toMatch(
      /\bFull Go\b|\bWindows Go\b|\bCross-platform Go\b|\bAI ready\b|\brelease ready\b/,
    );
  });
});
