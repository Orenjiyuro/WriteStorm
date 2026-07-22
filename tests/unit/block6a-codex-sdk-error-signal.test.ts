import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK6A_FEASIBILITY_MANIFEST } from '../../src/main/codex-feasibility/manifest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A remediation R5b pinned SDK error-signal audit', () => {
  it('proves 0.144.6 exports message-only failures and discards turn failure structure', () => {
    const packageRoot = path.join(rootDir, 'node_modules/@openai/codex-sdk');
    const packageManifest = JSON.parse(readFileSync(
      path.join(packageRoot, 'package.json'),
      'utf8',
    )) as { version: string };
    const declarations = readFileSync(path.join(packageRoot, 'dist/index.d.ts'), 'utf8');
    const implementation = readFileSync(path.join(packageRoot, 'dist/index.js'), 'utf8');

    expect(packageManifest.version).toBe(BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk);
    expect(declarations).toMatch(/type ThreadError = \{\s*message: string;\s*\};/);
    expect(declarations).toMatch(
      /type ThreadErrorEvent = \{\s*type: "error";\s*message: string;\s*\};/,
    );
    expect(implementation).toContain('throw new Error(turnFailure.message);');
    expect(implementation).toContain('stderrBuffer.toString("utf8")');
  });

  it('freezes the conservative blocker without persisting raw error text', () => {
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r5-error-classification.json',
    ), 'utf8')) as {
      source: string;
      sdkErrorSignalAudit: {
        sdkVersion: string;
        exportedFailureShape: string;
        runFailureShape: string;
        processFailureShape: string;
        inspectedPackageFiles: string[];
        officialSourceUrls: string[];
      };
      assertions: Record<string, boolean>;
    };
    const authority = readFileSync(path.join(
      rootDir,
      'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md',
    ), 'utf8');

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.sdkErrorSignalAudit).toMatchObject({
      sdkVersion: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
      exportedFailureShape: 'message_only',
      runFailureShape: 'plain_error_message_only',
      processFailureShape: 'plain_error_exit_and_stderr_text_only',
      inspectedPackageFiles: [
        'node_modules/@openai/codex-sdk/package.json',
        'node_modules/@openai/codex-sdk/dist/index.d.ts',
        'node_modules/@openai/codex-sdk/dist/index.js',
      ],
    });
    expect(evidence.sdkErrorSignalAudit.officialSourceUrls).toEqual([
      'https://github.com/openai/codex/blob/main/sdk/typescript/README.md',
      'https://github.com/openai/codex/blob/main/sdk/typescript/src/events.ts',
      'https://github.com/openai/codex/blob/main/sdk/typescript/src/thread.ts',
    ]);
    expect(evidence.assertions).toMatchObject({
      pinnedSdkThreadErrorIsMessageOnly: true,
      pinnedSdkThreadErrorEventIsMessageOnly: true,
      pinnedSdkRunDiscardsThreadFailureStructure: true,
      pinnedSdkNonzeroExitIsTextOnly: true,
      stableAuthSignalUnavailable: true,
      stableGitSignalUnavailable: true,
    });
    expect(authority).toContain('R5b pinned SDK error-signal audit');
    expect(JSON.stringify(evidence)).not.toMatch(/"(?:prompt|stdout|stderr|rawError)"\s*:/i);
  });
});
