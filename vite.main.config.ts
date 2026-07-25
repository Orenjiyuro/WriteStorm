import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  createTask135CompatibilityFingerprint,
  loadTask135CompatibilityBoundary,
} from './scripts/task13-5-compatibility-boundary.mjs';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const currentCompatibility = createTask135CompatibilityFingerprint(
  repositoryRoot,
  loadTask135CompatibilityBoundary(repositoryRoot),
);
const certificationBuild =
  process.env.WRITESTORM_TASK13_CERTIFICATION_BUILD === '1';
const certificationMarker = certificationBuild
  ? `block13-task13-certification-build-v1:${currentCompatibility.sha256}`
  : null;
const buildCompatibilityAssessment = certificationBuild
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
    __WRITESTORM_AI_CERTIFICATION_MARKER__:
      JSON.stringify(certificationMarker),
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'original-fs'],
    },
    target: 'node22',
  },
});
