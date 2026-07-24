import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13.11 explicit real product probe runner', () => {
  it('is absent from default checks and derives its only result root from OS temp', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const runner = readFileSync(
      path.join(rootDir, 'scripts/run-task13-11-product-packaged-probe.mjs'),
      'utf8',
    );

    expect(Object.values(packageJson.scripts).join(' ')).not.toContain(
      'run-task13-11-product-packaged-probe',
    );
    expect(runner).toContain("os.tmpdir()");
    expect(runner).toContain("WRITESTORM_TASK13_11_PRODUCT_PROBE: '1'");
    expect(runner).toContain('WRITESTORM_TASK13_11_RUN_ID: runId');
    expect(runner).toContain("cwd: os.tmpdir()");
    expect(runner).not.toMatch(/OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN/);
    expect(runner).not.toMatch(/Library|SQLite|SYNTHETIC_INPUT|RESULT_PATH/);
  });
});
