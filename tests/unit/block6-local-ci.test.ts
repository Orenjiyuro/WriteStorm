import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Block 6 local CI gate', () => {
  it('includes SQLite integration tests in the canonical check command', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['test:integration']).toBe('vitest run tests/integration');
    expect(packageJson.scripts.check).toBe(
      'npm run typecheck && npm run test:unit && npm run test:integration && npm run test:e2e',
    );
  });
});
