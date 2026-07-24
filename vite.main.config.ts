import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  createTask135CompatibilityFingerprint,
  evaluateTask135CompatibilityFreshness,
  loadTask135CompatibilityBoundary,
} from './scripts/task13-5-compatibility-boundary.mjs';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const task135Evidence = JSON.parse(readFileSync(path.join(
  repositoryRoot,
  'docs/engineering/evidence/block13-task13-5-windows-no-global-git-packaged.json',
), 'utf8')) as {
  readonly compatibilityFingerprint: unknown;
};
const currentCompatibility = createTask135CompatibilityFingerprint(
  repositoryRoot,
  loadTask135CompatibilityBoundary(repositoryRoot),
);
const compatibilityEvaluation = evaluateTask135CompatibilityFreshness(
  currentCompatibility,
  task135Evidence.compatibilityFingerprint,
);
const buildCompatibilityAssessment = compatibilityEvaluation.status === 'fresh'
  ? {
    state: 'fresh' as const,
    fingerprint: currentCompatibility.sha256,
  }
  : {
    state: 'stale' as const,
  };

export default defineConfig({
  define: {
    __WRITESTORM_AI_COMPATIBILITY_ASSESSMENT__:
      JSON.stringify(buildCompatibilityAssessment),
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
    target: 'node22',
  },
});
