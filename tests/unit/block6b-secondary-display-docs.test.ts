import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6B secondary-display test gate', () => {
  it('provides one canonical packaged secondary-display command', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['test:e2e:secondary-display']).toBe(
      'npm run build && playwright test --grep @secondary-display',
    );
  });

  it('documents the environment contract, fail-fast rule, evidence, and screenshot gate', () => {
    const readme = readFileSync(path.join(rootDir, 'tests/e2e/README.md'), 'utf8');

    expect(readme).toContain('npm run test:e2e:secondary-display');
    expect(readme).toContain('WRITESTORM_E2E_DISPLAY_TARGET=secondary');
    expect(readme).toContain('exit code `86`');
    expect(readme).toContain('never falls back to the primary display');
    expect(readme).toContain('spawnPackagedAppOnSecondary');
    expect(readme).toContain('@secondary-display');
    expect(readme).toContain('actualWindowBounds');
    expect(readme).toContain('centerDisplayId');
  });

  it('keeps packaged process creation out of individual specs', () => {
    const e2eDirectory = path.join(rootDir, 'tests/e2e');
    const directSpawnSpecs = readdirSync(e2eDirectory)
      .filter((name) => name.endsWith('.spec.ts'))
      .filter((name) => /\bspawn\s*\(/.test(readFileSync(path.join(e2eDirectory, name), 'utf8')));

    expect(directSpawnSpecs).toEqual([]);
  });

  it('applies the local secondary-display policy from Playwright configuration', () => {
    const playwrightConfig = readFileSync(path.join(rootDir, 'playwright.config.ts'), 'utf8');

    expect(playwrightConfig).toContain('configureLocalE2EDisplayPolicy(process.env)');
  });
});
