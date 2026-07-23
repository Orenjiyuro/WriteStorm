import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.3 SDK runtime semantics authority', () => {
  it('separates the admitted SDK implementation mechanism from forbidden product fallbacks', () => {
    const design = readFileSync(
      path.join(rootDir, 'docs/engineering/TECHNICAL_DESIGN.md'),
      'utf8',
    );

    expect(design).toContain('### Task 13.3 production AI execution boundary');
    expect(design).toContain('server-side ESM API');
    expect(design).toContain('SDK-owned pinned project-local CLI and JSONL mechanism');
    expect(design).toContain('is not a WriteStorm direct `codex exec` fallback');
    expect(design).toContain('must never spawn `codex exec` directly');
    expect(design).toContain('one non-generic `AiExecutionPort`');
    expect(design).toContain('unexported `unique symbol` brands');
    expect(design).toContain('does not register an adapter');
    expect(design).toContain('does not execute an SDK turn');
  });

  it('documents the Task 13.4 product utility boundary without promoting the probe runner', () => {
    const design = readFileSync(
      path.join(rootDir, 'docs/engineering/TECHNICAL_DESIGN.md'),
      'utf8',
    );

    expect(design).toContain('### Task 13.4 Codex adapter and utility boundary');
    expect(design).toContain('CodexProviderAdapter');
    expect(design).toContain('CodexUtilityLauncher');
    expect(design).toContain('rejects every message fail-closed');
    expect(design).toContain('does not import a Block 6A probe command, result or runner');
    expect(design).toContain('No SDK turn, auth check or network request is started');
  });
});
