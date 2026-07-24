import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveCodexProductRuntimePackage,
} from '../../config/codex-product-runtime-package';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.11 product package runtime configuration', () => {
  it('keeps the pinned Windows SDK, CLI and platform binary in the real product package', () => {
    expect(resolveCodexProductRuntimePackage('win32', 'x64')).toEqual({
      packageName: '@openai/codex-win32-x64',
      allowedPaths: [
        '/node_modules/@openai/codex-sdk',
        '/node_modules/@openai/codex',
        '/node_modules/@openai/codex-win32-x64',
      ],
      unpackDirectory:
        'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc',
      executableRelativePath:
        'vendor/x86_64-pc-windows-msvc/bin/codex.exe',
    });
  });

  it('uses the real product Main and shared product package resolver', () => {
    const source = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');

    expect(source).toContain("entry: 'src/main/main.ts'");
    expect(source).toContain('resolveCodexProductRuntimePackage');
    expect(source).toContain('codexRuntime.allowedPaths');
    expect(source).toContain('unpackDir: codexRuntime.unpackDirectory');
    expect(source).not.toMatch(/certification-main|forge\.block6a|codex-feasibility\/utility-entry/);
  });

  it('does not alter the pinned package or lockfile versions', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const lockfile = JSON.parse(readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));

    expect(packageJson.dependencies['@openai/codex-sdk']).toBe('0.144.6');
    expect(lockfile.packages['node_modules/@openai/codex-sdk'].version).toBe('0.144.6');
    expect(lockfile.packages['node_modules/@openai/codex'].version).toBe('0.144.6');
    expect(lockfile.packages['node_modules/@openai/codex-win32-x64'].version)
      .toBe('0.144.6-win32-x64');
  });
});
