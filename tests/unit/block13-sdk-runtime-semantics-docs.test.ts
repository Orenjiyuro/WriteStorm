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
    expect(design).toContain('AiExecutionPort<Request, Execution>');
    expect(design).toContain('does not register an adapter');
    expect(design).toContain('does not execute an SDK turn');
  });
});
