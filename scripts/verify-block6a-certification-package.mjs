import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repositoryRoot = process.cwd();
const [artifactFlag, artifactValue, ...extraArguments] = process.argv.slice(2);
if (artifactFlag !== '--artifact-root' || !artifactValue || extraArguments.length > 0) {
  throw new Error('Expected --artifact-root <certification-artifact-root>.');
}
const artifactRoot = path.resolve(repositoryRoot, artifactValue);
const result = spawnSync(
  process.execPath,
  [
    path.join(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    'tests/certification/block6a-codex-certification-package-boundary.test.ts',
  ],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      WRITESTORM_BLOCK6A_CERTIFICATION_ARTIFACT_ROOT: artifactRoot,
    },
    stdio: 'inherit',
    windowsHide: true,
  },
);
if (result.status !== 0) process.exitCode = 1;
