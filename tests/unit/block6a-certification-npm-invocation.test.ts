import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveBlock6aNpmInvocation } from '../../scripts/block6a-npm-invocation.mjs';

describe('Block 6A certification npm invocation', () => {
  it('runs the npm CLI through the current Node executable without a command shell', () => {
    const npmExecPath = path.resolve('tooling/npm-cli.js');
    const invocation = resolveBlock6aNpmInvocation({
      nodeExecutable: process.execPath,
      npmExecPath,
      pathExists: (candidate) => candidate === npmExecPath,
    });

    expect(invocation).toEqual({
      executable: process.execPath,
      argsPrefix: [npmExecPath],
    });
  });

  it.each([
    { npmExecPath: undefined, pathExists: () => true },
    { npmExecPath: 'npm.cmd', pathExists: () => true },
    { npmExecPath: path.resolve('tooling/not-npm.js'), pathExists: () => true },
    { npmExecPath: path.resolve('missing/npm-cli.js'), pathExists: () => false },
  ])('fails closed for an unusable npm CLI locator', ({ npmExecPath, pathExists }) => {
    expect(() => resolveBlock6aNpmInvocation({
      nodeExecutable: process.execPath,
      npmExecPath,
      pathExists,
    })).toThrow('Block 6A npm invocation is unavailable.');
  });

  it('binds the npm invocation helper into evidence runtime lineage', () => {
    const lineage = readFileSync(
      path.resolve('scripts/block6a-evidence-lineage.mjs'),
      'utf8',
    );
    expect(lineage).toContain("'scripts/block6a-npm-invocation.mjs'");
    expect(lineage).toContain("'scripts/block6a-npm-invocation.d.mts'");
  });
});
