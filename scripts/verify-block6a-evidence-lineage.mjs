import path from 'node:path';
import { verifyBlock6aCertificationFilesAtRepository } from './block6a-certification-verifier.mjs';

const repositoryRoot = process.cwd();
const [artifactFlag, artifactPath, ...evidencePaths] = process.argv.slice(2);
if (artifactFlag !== '--artifact-root' || !artifactPath || evidencePaths.length !== 7) {
  throw new Error(
    'Expected --artifact-root <immutable-artifact-root> and exactly seven sanitized evidence paths.',
  );
}

try {
  const result = verifyBlock6aCertificationFilesAtRepository(
    evidencePaths,
    repositoryRoot,
    path.resolve(repositoryRoot, artifactPath),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch {
  process.stderr.write('Block 6A certification verification failed.\n');
  process.exitCode = 1;
}
