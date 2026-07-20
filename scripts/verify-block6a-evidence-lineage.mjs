import { readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyBlock6aEvidenceLineageAtRepository } from './block6a-evidence-lineage.mjs';

const repositoryRoot = process.cwd();
const evidencePaths = process.argv.slice(2);
if (evidencePaths.length === 0) {
  throw new Error('Expected one or more sanitized Block 6A evidence JSON paths.');
}

const results = evidencePaths.map((evidencePath) => {
  const absolutePath = path.resolve(repositoryRoot, evidencePath);
  const evidence = JSON.parse(readFileSync(absolutePath, 'utf8'));
  if (!evidence || typeof evidence !== 'object' || !evidence.lineage) {
    throw new Error('Block 6A evidence lineage verification failed.');
  }
  const packagedArtifactRoot = evidence.lineage.packagedArtifactSha256 === null
    ? undefined
    : path.join(repositoryRoot, 'out', 'writestorm-win32-x64');
  const verified = verifyBlock6aEvidenceLineageAtRepository(
    evidence.lineage,
    repositoryRoot,
    packagedArtifactRoot,
  );
  return {
    evidenceId: evidence.evidenceId,
    classification: verified.classification,
  };
});

process.stdout.write(`${JSON.stringify({ verified: true, results })}\n`);
