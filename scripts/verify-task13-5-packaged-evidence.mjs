import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertTask135EvidenceMatches,
  loadTask135CompatibilityBoundary,
} from './task13-5-compatibility-boundary.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const evidencePath = path.resolve(repositoryRoot, args.evidence);
const artifactRoot = path.resolve(repositoryRoot, args.artifactRoot);
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
const boundary = loadTask135CompatibilityBoundary(repositoryRoot);

assertTask135EvidenceMatches({
  evidence,
  repositoryRoot,
  artifactRoot,
  boundary,
});
process.stdout.write('Task 13.5 packaged evidence content verified.\n');

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!value) throw new Error('Incomplete Task 13.5 verifier arguments.');
    if (key === '--artifact-root') parsed.artifactRoot = value;
    else if (key === '--evidence') parsed.evidence = value;
    else throw new Error('Unknown Task 13.5 verifier argument.');
  }
  if (!parsed.artifactRoot || !parsed.evidence) {
    throw new Error('Task 13.5 verifier arguments are required.');
  }
  return parsed;
}
