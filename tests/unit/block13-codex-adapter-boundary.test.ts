import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CodexProviderAdapter } from '../../src/main/ai/providers/codex/codex-provider-adapter';
import {
  CodexUtilityLauncher,
  resolveCodexUtilityModulePath,
  type ForkCodexUtilityProcess,
} from '../../src/main/ai/providers/codex/codex-utility-launcher';

const rootDir = path.resolve(__dirname, '../..');
const productionAiRoot = path.join(rootDir, 'src/main/ai');
const utilityEntry = path.join(
  productionAiRoot,
  'providers/codex/codex-utility-entry.ts',
);

describe('Block 13.4 Codex adapter and utility boundary', () => {
  it('delegates once through an injected transport without fallback behavior', async () => {
    const execute = vi.fn(async (request: { readonly value: string }) => ({
      accepted: request.value,
    }));
    const adapter = new CodexProviderAdapter({
      capabilities: {
        structuredOutput: false,
        streamedEvents: false,
        cancellation: false,
      },
      transport: { execute },
    });

    await expect(adapter.execute({ value: 'synthetic' })).resolves.toEqual({
      accepted: 'synthetic',
    });
    expect(execute).toHaveBeenCalledTimes(1);

    const failure = new Error('transport failure');
    execute.mockRejectedValueOnce(failure);
    await expect(adapter.execute({ value: 'failure' })).rejects.toBe(failure);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('launches only one fixed utility module with no caller-controlled args or environment', () => {
    const mainBundleDirectory = 'C:\\app\\.vite\\build';
    const modulePath = resolveCodexUtilityModulePath(mainBundleDirectory);
    const child = {
      pid: 17,
      on: vi.fn(),
      removeListener: vi.fn(),
      postMessage: vi.fn(),
      kill: vi.fn(() => true),
    };
    const fork = vi.fn(() => child) as unknown as ForkCodexUtilityProcess;
    const launcher = new CodexUtilityLauncher({ mainBundleDirectory, fork });

    expect(launcher.launch()).toBe(child);
    expect(fork).toHaveBeenCalledWith(modulePath, [], {
      serviceName: 'WriteStorm AI Utility',
      stdio: 'pipe',
    });
    expect(() => new CodexUtilityLauncher({
      mainBundleDirectory: 'relative-build-directory',
      fork,
    })).toThrow('AI utility bundle directory must be absolute.');
  });

  it('allows the SDK import only in the production Codex utility entry', () => {
    const aiFiles = sourceFiles(productionAiRoot);
    const sdkImporters = aiFiles.filter((filePath) => (
      readFileSync(filePath, 'utf8').includes("from '@openai/codex-sdk'")
    ));
    const directCliImporters = aiFiles.filter((filePath) => (
      readFileSync(filePath, 'utf8').includes("from '@openai/codex'")
    ));

    expect(sdkImporters).toEqual([utilityEntry]);
    expect(directCliImporters).toEqual([]);

    for (const filePath of aiFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(/from\s+['"][^'"]*codex-feasibility/i);
      expect(source).not.toMatch(/claude|deepseek|app-server/i);
    }
  });

  it('keeps the not-yet-defined utility protocol fail-closed and offline', () => {
    const source = readFileSync(utilityEntry, 'utf8');

    expect(source).toContain("import { Codex } from '@openai/codex-sdk'");
    expect(source).toContain("if (typeof Codex !== 'function')");
    expect(source).toContain('process.exit(CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE)');
    expect(source).not.toMatch(/^const\s+\w+\s*=\s*new\s+Codex/m);
    expect(source).not.toMatch(/startThread|resumeThread|\.run\(|runStreamed|process\.env/);
    expect(source).not.toMatch(/codex exec|child_process|spawn\(/i);
  });

  it('builds the production utility as an isolated externalized Forge entry', () => {
    const forge = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');
    const vite = readFileSync(path.join(rootDir, 'vite.codex-utility.config.ts'), 'utf8');

    expect(forge).toContain("entry: 'src/main/ai/providers/codex/codex-utility-entry.ts'");
    expect(forge).toContain("config: 'vite.codex-utility.config.ts'");
    expect(vite).toContain("external: ['@openai/codex-sdk', '@openai/codex']");
    expect(vite).toContain("target: 'node22'");
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory()
      ? sourceFiles(entryPath)
      : entryPath.endsWith('.ts') ? [entryPath] : [];
  });
}
