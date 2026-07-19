import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const sdkManifestPath = 'node_modules/@openai/codex-sdk/package.json';
const sdkTypesPath = 'node_modules/@openai/codex-sdk/dist/index.d.ts';
const sdkImplementationPath = 'node_modules/@openai/codex-sdk/dist/index.js';
const feasibilityPath = 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md';
const evidencePath = 'docs/engineering/evidence/block6a-task6a3-runtime-semantics.json';

type EvidenceRecord = {
  schemaVersion: number;
  evidenceId: string;
  task: string;
  source: string;
  recordedAt: string;
  commandName: string;
  classification: string;
  versions: Record<string, string>;
  assertions: Record<string, boolean>;
};

describe('Block 6A.3 installed Codex SDK runtime semantics', () => {
  it('imports the server-side ESM package and resolves its project-local Windows CLI without starting a turn', async () => {
    const manifest = JSON.parse(readFileSync(sdkManifestPath, 'utf8')) as {
      version: string;
      type: string;
      exports: { '.': { import: string; types: string } };
    };
    const sdk = await import('@openai/codex-sdk');
    const codex = new sdk.Codex();
    const internals = codex as unknown as { exec: { executablePath: string } };
    const executablePath = realpathSync(internals.exec.executablePath);
    const workspacePath = realpathSync(process.cwd());
    const relativeExecutablePath = relative(workspacePath, executablePath);
    const thread = codex.startThread({
      workingDirectory: 'synthetic-workspace-not-executed',
      skipGitRepoCheck: true,
    });

    expect(manifest).toMatchObject({
      version: '0.144.6',
      type: 'module',
      exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
    });
    expect(typeof sdk.Codex).toBe('function');
    expect(thread.id).toBeNull();
    expect(typeof thread.run).toBe('function');
    expect(typeof thread.runStreamed).toBe('function');
    expect(isAbsolute(executablePath)).toBe(true);
    expect(relativeExecutablePath.startsWith(`..${sep}`)).toBe(false);
    expect(relativeExecutablePath).toContain(
      `node_modules${sep}@openai${sep}codex-win32-x64${sep}`,
    );
    expect(relativeExecutablePath.endsWith(`${sep}bin${sep}codex.exe`)).toBe(true);
  });

  it('locks the public abort/cwd/schema API and the SDK-owned spawn plus JSONL mechanism', () => {
    const types = readFileSync(sdkTypesPath, 'utf8');
    const implementation = readFileSync(sdkImplementationPath, 'utf8');

    expect(types).toContain('Use the `startThread()` method to start a new thread');
    expect(types).toContain('signal?: AbortSignal;');
    expect(types).toContain('workingDirectory?: string;');
    expect(types).toContain('skipGitRepoCheck?: boolean;');
    expect(types).toContain('outputSchema?: unknown;');
    expect(types).toContain('Top-level JSONL events emitted by codex exec.');

    expect(implementation).toContain('const commandArgs = ["exec", "--experimental-json"]');
    expect(implementation).toContain('commandArgs.push("--cd", args.workingDirectory)');
    expect(implementation).toContain('commandArgs.push("--output-schema", args.outputSchemaFile)');
    expect(implementation).toContain('const child = spawn(this.executablePath, commandArgs');
    expect(implementation).toContain('signal: args.signal');
    expect(implementation).toContain('child.stdin.write(args.input)');
    expect(implementation).toContain('input: child.stdout');
    expect(implementation).toContain('parsed = JSON.parse(item)');
    expect(implementation).toContain('Failed to parse item: ${item}');
    expect(implementation).toContain('stderrBuffer.toString("utf8")');
    expect(implementation).toContain('await fs.rm(schemaDir, { recursive: true, force: true })');
  });

  it('commits sanitized provenance without upgrading an import-only probe into a real turn', () => {
    expect(existsSync(evidencePath)).toBe(true);
    if (!existsSync(evidencePath)) return;

    const records = JSON.parse(readFileSync(evidencePath, 'utf8')) as EvidenceRecord[];
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.source)).toEqual(['static_manifest', 'real_sdk']);
    for (const record of records) {
      expect(record.schemaVersion).toBe(1);
      expect(record.task).toBe('6A.3');
      expect(record.versions.codexSdk).toBe('0.144.6');
      expect(record.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    expect(records[1]?.classification).toBe('esm_import_only_no_turn');
    expect(records[1]?.assertions.modelTurnExecuted).toBe(false);
    expect(records[1]?.assertions.cliProcessStarted).toBe(false);
  });

  it('documents the SDK-owned CLI boundary and the remaining runtime limitations', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');

    expect(feasibility).toContain('## Task 6A.3 installed SDK runtime semantics');
    expect(feasibility).toContain('server-side ESM');
    expect(feasibility).toContain('SDK-owned implementation mechanism');
    expect(feasibility).toContain('WriteStorm must not spawn `codex exec` directly');
    expect(feasibility).toContain('Node 24 runtime import verified');
    expect(feasibility).toContain('Node 22 runtime not exercised');
    expect(feasibility).toContain('No authenticated model turn ran in Task 6A.3');
    expect(feasibility).toContain('does not prove cancellation cleanup or absence of orphan processes');
    expect(feasibility).toContain('must not persist or forward the raw SDK error message');
  });
});
