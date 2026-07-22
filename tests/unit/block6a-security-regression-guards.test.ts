import { describe, expect, it } from 'vitest';
import { findRestrictedModuleLoads } from '../../scripts/block6a-source-security-guard.mjs';
import {
  APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES,
  evaluateWindowsPlatformRuntimeFiles,
} from '../../scripts/block6a-windows-platform-package-guard.mjs';

describe('Block 6A security regression guards', () => {
  it('detects ESM, require and statically computable dynamic imports', () => {
    const source = [
      "import fs from 'node:fs';",
      "const shell = require('node:' + 'child_process');",
      "void import(`@openai/${'codex-sdk'}`);",
    ].join('\n');

    expect(findRestrictedModuleLoads(source, [
      'node:fs',
      'node:child_process',
    ])).toEqual([
      { kind: 'import', specifier: 'node:fs' },
      { kind: 'require', specifier: 'node:child_process' },
      { kind: 'dynamic-import', specifier: '@openai/codex-sdk' },
    ]);
  });

  it('fails closed for module loads whose computed target cannot be proven safe', () => {
    expect(findRestrictedModuleLoads(
      'void import(providerPackage); const fs = require(runtimeModule);',
      ['node:fs'],
    )).toEqual([
      { kind: 'dynamic-import', specifier: null },
      { kind: 'require', specifier: null },
    ]);
  });

  it('rejects missing, duplicate and extra Windows platform runtime files', () => {
    expect(evaluateWindowsPlatformRuntimeFiles(
      APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES,
    )).toEqual({ passed: true, missing: [], extra: [], duplicates: [] });

    const incomplete = APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES.slice(1);
    expect(evaluateWindowsPlatformRuntimeFiles(incomplete)).toMatchObject({
      passed: false,
      missing: [APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES[0]],
    });

    expect(evaluateWindowsPlatformRuntimeFiles([
      ...APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES,
      'codex-resources/unapproved-helper.exe',
      APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES[0],
    ])).toMatchObject({
      passed: false,
      extra: ['codex-resources/unapproved-helper.exe'],
      duplicates: [APPROVED_WINDOWS_PLATFORM_RUNTIME_FILES[0]],
    });
  });
});
